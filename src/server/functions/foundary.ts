'use server'
import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq, inArray, or } from 'drizzle-orm'
import { z } from 'zod'
import { setCookie } from '@tanstack/react-start/server'
import { createHash, randomUUID } from 'node:crypto'
import { getDb } from '../db/runtime'
import {
  foundaryApplicationMessages,
  foundaryApplications,
  hostedSupportTicketMessages,
  hostedSupportTickets,
  organizationInvitations,
  organizationMembers,
  users,
} from '../db/schema'
import { requireOrganizerUser, requireStaffUser } from '../lib/access'
import { hashPassword, verifyPassword } from '../lib/password'
import { writeActivityLog } from './logs'

const FUNDING_PER_EVENT = 25
const INVITE_TTL_MS = 2 * 60 * 60 * 1000

const isMissingConfidentialityColumnsError = (error: unknown) => {
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  return (
    msg.includes('is_confidential') ||
    msg.includes('created_by_user_id') ||
    msg.includes('ticket_closed') ||
    msg.includes('ticket_closed_at') ||
    msg.includes('ticket_closed_by_user_id')
  )
}

const normalizeOrg = (value: string) => value.trim()
const getApplicationThreadId = (applicationId: number) => `<foundary-application-${applicationId}@lankoping.se>`
const getHostedSupportThreadId = (ticketId: number) => `<hosted-support-${ticketId}@lankoping.se>`

const getHostedBaseUrl = () => {
  const raw =
    process.env.baseurl ||
    process.env.BASEURL ||
    process.env.BASE_URL ||
    process.env.hostedurl ||
    process.env.HOSTEDURL ||
    process.env.HOSTED_URL ||
    process.env.APP_URL ||
    'http://localhost:3000'

  const trimmed = raw.trim()
  if (!trimmed) {
    return 'http://localhost:3000'
  }

  return /^https?:\/\//i.test(trimmed) ? trimmed.replace(/\/$/, '') : `https://${trimmed.replace(/\/$/, '')}`
}

async function sendOrganizationInviteEmail({
  to,
  invitedBy,
  link,
}: {
  to: string
  invitedBy: string
  link: string
}) {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    throw new Error('SMTP configuration missing: set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS')
  }

  const nodemailer = await import('nodemailer')
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })

  const text = [
    `Hi! you have been invited by ${invitedBy} to join their organisation on lanfoundary.`,
    '',
    'Click the link below to activate your account',
    '',
    link,
    '',
    "Your's truely The Lanfoundary team",
  ].join('\n')

  const html = `
    <p>Hi! you have been invited by <strong>${invitedBy}</strong> to join their organisation on lanfoundary.</p>
    <p>Click the link below to activate your account</p>
    <p><a href="${link}">${link}</a></p>
    <p>Your's truely The Lanfoundary team</p>
  `

  await transporter.sendMail({
    from: 'foundary@lankoping.se',
    to,
    subject: 'Lanfoundary organisation invite',
    text,
    html,
  })
}

async function sendApplicationThreadEmail({
  to,
  subject,
  text,
  html,
  applicationId,
}: {
  to: string
  subject: string
  text: string
  html: string
  applicationId: number
}) {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    throw new Error('SMTP configuration missing: set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS')
  }

  const nodemailer = await import('nodemailer')
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })

  const threadId = getApplicationThreadId(applicationId)

  await transporter.sendMail({
    from: 'foundary@lankoping.se',
    to,
    subject,
    text,
    html,
    headers: {
      'In-Reply-To': threadId,
      References: threadId,
    },
  })
}

async function sendHostedSupportThreadEmail({
  to,
  subject,
  text,
  html,
  ticketId,
}: {
  to: string
  subject: string
  text: string
  html: string
  ticketId: number
}) {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    throw new Error('SMTP configuration missing: set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS')
  }

  const nodemailer = await import('nodemailer')
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })

  const threadId = getHostedSupportThreadId(ticketId)

  await transporter.sendMail({
    from: 'foundary@lankoping.se',
    to,
    subject,
    text,
    html,
    headers: {
      'In-Reply-To': threadId,
      References: threadId,
    },
  })
}

const applicationSchema = z.object({
  applicantName: z.string().min(1),
  email: z.string().email(),
  age: z.coerce.number().int().min(13),
  cityCountry: z.string().min(1),
  organizationName: z.string().min(1),
  organizationStatus: z.enum(['registered_nonprofit', 'equivalent_in_my_country', 'individual_group_for_reimbursements_only']),
  hasHcbAccount: z.boolean(),
  hcbUsername: z.string().optional(),
  preferredPaymentMethod: z.enum(['direct_hcb_transfer', 'receipt_reimbursement']),
  eventName: z.string().min(1),
  plannedMonths: z.string().min(1),
  expectedAttendees: z.coerce.number().int().min(1),
  requestedFunds: z.coerce.number().int().min(1).max(100000),
  briefEventDescription: z.string().min(1),
  budgetJustification: z.string().min(1),
  accountPassword: z.string().min(8).max(72),
  termsAccepted: z.literal(true),
})

export const submitFoundaryApplicationFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => applicationSchema.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb()
    const normalizedEmail = data.email.trim().toLowerCase()
    const normalizedOrganizationName = normalizeOrg(data.organizationName)

    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1)

    let accountUser = existingUser[0]

    if (accountUser) {
      if (accountUser.active === false) {
        throw new Error('Account is locked')
      }

      if (accountUser.role === 'organizer') {
        throw new Error('Organizer accounts cannot submit hosted applications here')
      }

      if (!verifyPassword(data.accountPassword, accountUser.passwordHash)) {
        throw new Error('Invalid email or password for hosted account')
      }
    } else {
      const createdUser = await db
        .insert(users)
        .values({
          email: normalizedEmail,
          passwordHash: hashPassword(data.accountPassword),
          name: data.applicantName,
          role: 'volunteer',
          active: true,
        })
        .returning()

      accountUser = createdUser[0]
    }

    setCookie('session', accountUser.id.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    const duplicate = await db
      .select()
      .from(foundaryApplications)
      .where(and(eq(foundaryApplications.email, normalizedEmail), eq(foundaryApplications.status, 'pending')))
      .limit(1)

    if (duplicate[0]) {
      throw new Error('You already have a pending application')
    }

    const applicationValues = {
      applicantName: data.applicantName,
      email: normalizedEmail,
      age: data.age,
      cityCountry: data.cityCountry,
      organizationName: normalizedOrganizationName,
      organizationStatus: data.organizationStatus,
      hasHcbAccount: data.hasHcbAccount,
      hcbUsername: data.hasHcbAccount ? (data.hcbUsername?.trim() || null) : null,
      preferredPaymentMethod: data.preferredPaymentMethod,
      eventName: data.eventName,
      plannedMonths: data.plannedMonths,
      expectedAttendees: data.expectedAttendees,
      requestedEvents: 1,
      fundingRequestAmount: data.requestedFunds,
      briefEventDescription: data.briefEventDescription,
      budgetJustification: data.budgetJustification,
      termsAccepted: data.termsAccepted,
      createdByUserId: accountUser.id,
      isConfidential: true,
      status: 'pending' as const,
    }

    let created
    try {
      created = await db.insert(foundaryApplications).values(applicationValues).returning()
    } catch (error) {
      if (!isMissingConfidentialityColumnsError(error)) throw error
      const { createdByUserId: _createdByUserId, isConfidential: _isConfidential, ...legacyValues } = applicationValues
      created = await db.insert(foundaryApplications).values(legacyValues).returning()
    }

    const existingMembership = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, accountUser.id),
          eq(organizationMembers.organizationName, normalizedOrganizationName),
        ),
      )
      .limit(1)

    if (!existingMembership[0]) {
      await db.insert(organizationMembers).values({
        userId: accountUser.id,
        organizationName: normalizedOrganizationName,
        addedBy: accountUser.id,
      })
    }

    return created[0]
  })

export const getMyFoundaryApplicationsFn = createServerFn({ method: 'GET' }).handler(async () => {
  const currentUser = await requireStaffUser()
  const db = await getDb()

  let organizations = await db
    .select({ organizationName: organizationMembers.organizationName })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, currentUser.id))

  if (organizations.length === 0) {
    const legacyOrganizations = await db
      .select({ organizationName: foundaryApplications.organizationName })
      .from(foundaryApplications)
      .where(eq(foundaryApplications.email, (currentUser.email ?? '').trim().toLowerCase()))

    if (legacyOrganizations.length > 0) {
      for (const org of legacyOrganizations) {
        const normalized = normalizeOrg(org.organizationName)
        const hasMembership = await db
          .select({ id: organizationMembers.id })
          .from(organizationMembers)
          .where(and(eq(organizationMembers.userId, currentUser.id), eq(organizationMembers.organizationName, normalized)))
          .limit(1)

        if (!hasMembership[0]) {
          await db.insert(organizationMembers).values({
            userId: currentUser.id,
            organizationName: normalized,
            addedBy: currentUser.id,
          })
        }
      }

      organizations = await db
        .select({ organizationName: organizationMembers.organizationName })
        .from(organizationMembers)
        .where(eq(organizationMembers.userId, currentUser.id))
    }
  }

  const organizationNames = Array.from(new Set(organizations.map((org) => normalizeOrg(org.organizationName)).filter(Boolean)))

  if (organizationNames.length === 0) {
    return []
  }

  try {
    return await db
      .select({
        id: foundaryApplications.id,
        applicantName: foundaryApplications.applicantName,
        email: foundaryApplications.email,
        organizationName: foundaryApplications.organizationName,
        organizationStatus: foundaryApplications.organizationStatus,
        eventName: foundaryApplications.eventName,
        plannedMonths: foundaryApplications.plannedMonths,
        expectedAttendees: foundaryApplications.expectedAttendees,
        requestedEvents: foundaryApplications.requestedEvents,
        fundingRequestAmount: foundaryApplications.fundingRequestAmount,
        status: foundaryApplications.status,
        isConfidential: foundaryApplications.isConfidential,
        ticketClosed: foundaryApplications.ticketClosed,
        ticketClosedAt: foundaryApplications.ticketClosedAt,
        ticketClosedByUserId: foundaryApplications.ticketClosedByUserId,
        reviewNotes: foundaryApplications.reviewNotes,
        reviewedAt: foundaryApplications.reviewedAt,
        createdAt: foundaryApplications.createdAt,
        updatedAt: foundaryApplications.updatedAt,
      })
      .from(foundaryApplications)
      .where(
        and(
          inArray(foundaryApplications.organizationName, organizationNames),
          or(
            eq(foundaryApplications.isConfidential, false),
            eq(foundaryApplications.createdByUserId, currentUser.id),
            eq(foundaryApplications.email, currentUser.email),
          ),
        ),
      )
      .orderBy(desc(foundaryApplications.createdAt))
  } catch (error) {
    if (!isMissingConfidentialityColumnsError(error)) throw error
    return await db
      .select({
        id: foundaryApplications.id,
        applicantName: foundaryApplications.applicantName,
        email: foundaryApplications.email,
        organizationName: foundaryApplications.organizationName,
        organizationStatus: foundaryApplications.organizationStatus,
        eventName: foundaryApplications.eventName,
        plannedMonths: foundaryApplications.plannedMonths,
        expectedAttendees: foundaryApplications.expectedAttendees,
        requestedEvents: foundaryApplications.requestedEvents,
        fundingRequestAmount: foundaryApplications.fundingRequestAmount,
        status: foundaryApplications.status,
        ticketClosed: foundaryApplications.ticketClosed,
        ticketClosedAt: foundaryApplications.ticketClosedAt,
        ticketClosedByUserId: foundaryApplications.ticketClosedByUserId,
        reviewNotes: foundaryApplications.reviewNotes,
        reviewedAt: foundaryApplications.reviewedAt,
        createdAt: foundaryApplications.createdAt,
        updatedAt: foundaryApplications.updatedAt,
      })
      .from(foundaryApplications)
      .where(inArray(foundaryApplications.organizationName, organizationNames))
      .orderBy(desc(foundaryApplications.createdAt))
  }
})

export const getMyOrganizationMembersFn = createServerFn({ method: 'GET' }).handler(async () => {
  const currentUser = await requireStaffUser()
  const db = await getDb()

  const organizations = await db
    .select({ organizationName: organizationMembers.organizationName })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, currentUser.id))

  const organizationNames = Array.from(new Set(organizations.map((org) => normalizeOrg(org.organizationName)).filter(Boolean)))

  if (organizationNames.length === 0) {
    return []
  }

  const rows = await db
    .select({
      organizationName: organizationMembers.organizationName,
      userId: users.id,
      email: users.email,
      name: users.name,
      addedBy: organizationMembers.addedBy,
      createdAt: organizationMembers.createdAt,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(organizationMembers.userId, users.id))
    .where(inArray(organizationMembers.organizationName, organizationNames))

  return rows
})

export const createHostedFundingRequestFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        organizationName: z.string().min(1),
        eventName: z.string().min(1),
        plannedMonths: z.string().min(1),
        expectedAttendees: z.coerce.number().int().min(1),
        requestedFunds: z.coerce.number().int().min(1).max(100000),
        briefEventDescription: z.string().min(1),
        budgetJustification: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireStaffUser()
    const db = await getDb()

    const organizationName = normalizeOrg(data.organizationName)

    const membership = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.userId, currentUser.id), eq(organizationMembers.organizationName, organizationName)))
      .limit(1)

    if (!membership[0]) {
      throw new Error('You can only request funds for organizations you belong to')
    }

    const profileSource = await db
      .select()
      .from(foundaryApplications)
      .where(eq(foundaryApplications.organizationName, organizationName))
      .orderBy(desc(foundaryApplications.createdAt))
      .limit(1)

    if (!profileSource[0]) {
      throw new Error('No existing organization profile found. Submit an initial application first.')
    }

    const pendingExisting = await db
      .select({ id: foundaryApplications.id })
      .from(foundaryApplications)
      .where(and(eq(foundaryApplications.organizationName, organizationName), eq(foundaryApplications.status, 'pending')))
      .limit(1)

    if (pendingExisting[0]) {
      throw new Error('There is already a pending request for this organization')
    }

    const fundingValues = {
      applicantName: currentUser.name?.trim() || currentUser.email,
      email: currentUser.email,
      age: profileSource[0].age,
      cityCountry: profileSource[0].cityCountry,
      organizationName,
      organizationStatus: profileSource[0].organizationStatus,
      hasHcbAccount: profileSource[0].hasHcbAccount,
      hcbUsername: profileSource[0].hcbUsername,
      preferredPaymentMethod: profileSource[0].preferredPaymentMethod,
      eventName: data.eventName,
      plannedMonths: data.plannedMonths,
      expectedAttendees: data.expectedAttendees,
      requestedEvents: 1,
      fundingRequestAmount: data.requestedFunds,
      briefEventDescription: data.briefEventDescription,
      budgetJustification: data.budgetJustification,
      termsAccepted: true,
      createdByUserId: currentUser.id,
      isConfidential: true,
      status: 'pending' as const,
    }

    let created
    try {
      created = await db.insert(foundaryApplications).values(fundingValues).returning()
    } catch (error) {
      if (!isMissingConfidentialityColumnsError(error)) throw error
      const { createdByUserId: _createdByUserId, isConfidential: _isConfidential, ...legacyValues } = fundingValues
      created = await db.insert(foundaryApplications).values(legacyValues).returning()
    }

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'foundary.application.request_from_hosted',
      entityType: 'foundary_application',
      entityId: created[0].id,
      details: {
        organizationName,
        eventName: data.eventName,
        requestedFunds: data.requestedFunds,
      },
    })

    return created[0]
  })

export const inviteOrganizationMemberFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        organizationName: z.string().min(1),
        email: z.string().email(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireStaffUser()
    const db = await getDb()

    const organizationName = normalizeOrg(data.organizationName)
    const targetEmail = data.email.trim().toLowerCase()

    const inviterMembership = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, currentUser.id),
          eq(organizationMembers.organizationName, organizationName),
        ),
      )
      .limit(1)

    if (!inviterMembership[0]) {
      throw new Error('You can only invite members to organizations you belong to')
    }

    const token = createHash('sha256').update(`${organizationName}:${targetEmail}:${randomUUID()}`).digest('hex')
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS)

    await db.insert(organizationInvitations).values({
      token,
      email: targetEmail,
      organizationName,
      invitedBy: currentUser.id,
      expiresAt,
    })

    const inviteLink = `${getHostedBaseUrl()}/invite-register?invite=${token}`
    const inviterName = currentUser.name?.trim() || currentUser.email
    await sendOrganizationInviteEmail({
      to: targetEmail,
      invitedBy: inviterName,
      link: inviteLink,
    })

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'foundary.organization.member.invite',
      entityType: 'organization_member',
      details: {
        organizationName,
        invitedEmail: targetEmail,
        inviteToken: token,
      },
    })

    return {
      success: true,
      organizationName,
      invitedEmail: targetEmail,
      inviteLink,
    }
  })

export const getOrganizationInviteInfoFn = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => z.object({ token: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const db = await getDb()
    const invite = await db
      .select({
        id: organizationInvitations.id,
        email: organizationInvitations.email,
        organizationName: organizationInvitations.organizationName,
        expiresAt: organizationInvitations.expiresAt,
        acceptedAt: organizationInvitations.acceptedAt,
      })
      .from(organizationInvitations)
      .where(eq(organizationInvitations.token, data.token.trim()))
      .limit(1)

    if (!invite[0]) {
      throw new Error('Invitation not found')
    }

    return {
      email: invite[0].email,
      organizationName: invite[0].organizationName,
      expiresAt: invite[0].expiresAt,
      isExpired: invite[0].expiresAt.getTime() < Date.now(),
      isAccepted: Boolean(invite[0].acceptedAt),
    }
  })

export const registerInvitedMemberFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        token: z.string().min(1),
        name: z.string().min(1),
        password: z.string().min(8).max(72),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = await getDb()
    const token = data.token.trim()

    const invite = await db
      .select()
      .from(organizationInvitations)
      .where(eq(organizationInvitations.token, token))
      .limit(1)

    if (!invite[0]) {
      throw new Error('Invitation not found')
    }

    if (invite[0].acceptedAt) {
      throw new Error('Invitation already accepted')
    }

    if (invite[0].expiresAt.getTime() < Date.now()) {
      throw new Error('Invitation has expired')
    }

    const existing = await db
      .select({ id: users.id, role: users.role, active: users.active })
      .from(users)
      .where(eq(users.email, invite[0].email))
      .limit(1)

    if (existing[0]) {
      throw new Error('Account already exists for this invite. Please sign in instead.')
    }

    const createdUser = await db
      .insert(users)
      .values({
        email: invite[0].email,
        passwordHash: hashPassword(data.password),
        name: data.name.trim(),
        role: 'volunteer',
        active: true,
      })
      .returning()

    const user = createdUser[0]

    await db.insert(organizationMembers).values({
      userId: user.id,
      organizationName: invite[0].organizationName,
      addedBy: invite[0].invitedBy ?? user.id,
    })

    await db
      .update(organizationInvitations)
      .set({
        acceptedBy: user.id,
        acceptedAt: new Date(),
      })
      .where(eq(organizationInvitations.id, invite[0].id))

    setCookie('session', user.id.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    await writeActivityLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'foundary.organization.member.register_from_invite',
      entityType: 'organization_member',
      details: {
        organizationName: invite[0].organizationName,
      },
    })

    return {
      success: true,
      organizationName: invite[0].organizationName,
      email: user.email,
    }
  })

export const getFoundaryApplicationMessagesFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requireOrganizerUser()
  const db = await getDb()

  return await db
    .select({
      id: foundaryApplicationMessages.id,
      applicationId: foundaryApplicationMessages.applicationId,
      senderUserId: foundaryApplicationMessages.senderUserId,
      senderRole: foundaryApplicationMessages.senderRole,
      senderName: users.name,
      senderEmail: users.email,
      message: foundaryApplicationMessages.message,
      createdAt: foundaryApplicationMessages.createdAt,
    })
    .from(foundaryApplicationMessages)
    .innerJoin(users, eq(foundaryApplicationMessages.senderUserId, users.id))
    .orderBy(desc(foundaryApplicationMessages.createdAt))
})

export const getMyFoundaryApplicationMessagesFn = createServerFn({ method: 'GET' }).handler(async () => {
  const currentUser = await requireStaffUser()
  const db = await getDb()

  const organizations = await db
    .select({ organizationName: organizationMembers.organizationName })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, currentUser.id))

  const organizationNames = Array.from(new Set(organizations.map((org) => normalizeOrg(org.organizationName)).filter(Boolean)))
  if (organizationNames.length === 0) {
    return []
  }

  let scopedApplications
  try {
    scopedApplications = await db
      .select({ id: foundaryApplications.id })
      .from(foundaryApplications)
      .where(
        and(
          inArray(foundaryApplications.organizationName, organizationNames),
          or(
            eq(foundaryApplications.isConfidential, false),
            eq(foundaryApplications.createdByUserId, currentUser.id),
            eq(foundaryApplications.email, currentUser.email),
          ),
        ),
      )
  } catch (error) {
    if (!isMissingConfidentialityColumnsError(error)) throw error
    scopedApplications = await db
      .select({ id: foundaryApplications.id })
      .from(foundaryApplications)
      .where(inArray(foundaryApplications.organizationName, organizationNames))
  }

  const applicationIds = scopedApplications.map((item) => item.id)
  if (applicationIds.length === 0) {
    return []
  }

  return await db
    .select({
      id: foundaryApplicationMessages.id,
      applicationId: foundaryApplicationMessages.applicationId,
      senderUserId: foundaryApplicationMessages.senderUserId,
      senderRole: foundaryApplicationMessages.senderRole,
      senderName: users.name,
      senderEmail: users.email,
      message: foundaryApplicationMessages.message,
      createdAt: foundaryApplicationMessages.createdAt,
    })
    .from(foundaryApplicationMessages)
    .innerJoin(users, eq(foundaryApplicationMessages.senderUserId, users.id))
    .where(inArray(foundaryApplicationMessages.applicationId, applicationIds))
    .orderBy(desc(foundaryApplicationMessages.createdAt))
})

export const postFoundaryApplicationMessageFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        applicationId: z.number(),
        message: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireStaffUser()
    const db = await getDb()

    const application = await db
      .select()
      .from(foundaryApplications)
      .where(eq(foundaryApplications.id, data.applicationId))
      .limit(1)

    if (!application[0]) {
      throw new Error('Application not found')
    }

    if (currentUser.role !== 'organizer') {
      const membership = await db
        .select({ id: organizationMembers.id })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.userId, currentUser.id),
            eq(organizationMembers.organizationName, application[0].organizationName),
          ),
        )
        .limit(1)

      if (!membership[0]) {
        throw new Error('Forbidden')
      }

      const existingStaffMessage = await db
        .select({ id: foundaryApplicationMessages.id })
        .from(foundaryApplicationMessages)
        .where(
          and(
            eq(foundaryApplicationMessages.applicationId, application[0].id),
            eq(foundaryApplicationMessages.senderRole, 'organizer'),
          ),
        )
        .limit(1)

      if (!existingStaffMessage[0]) {
        throw new Error('Staff has not requested additional information for this request yet')
      }

      const latestThreadMessage = await db
        .select({
          senderUserId: foundaryApplicationMessages.senderUserId,
          senderRole: foundaryApplicationMessages.senderRole,
          createdAt: foundaryApplicationMessages.createdAt,
        })
        .from(foundaryApplicationMessages)
        .where(eq(foundaryApplicationMessages.applicationId, application[0].id))
        .orderBy(desc(foundaryApplicationMessages.createdAt))
        .limit(1)

      const latest = latestThreadMessage[0]
      if (latest && latest.senderRole !== 'organizer' && latest.senderUserId === currentUser.id) {
        throw new Error('Please wait for staff to reply before sending another message')
      }
    }

    const cleanMessage = data.message.trim()
    const created = await db
      .insert(foundaryApplicationMessages)
      .values({
        applicationId: application[0].id,
        senderUserId: currentUser.id,
        senderRole: currentUser.role,
        message: cleanMessage,
      })
      .returning()

    if (currentUser.role === 'organizer') {
      const staffName = currentUser.name?.trim() || currentUser.email
      const text = [
        'You have received a reply to your funding request.',
        '',
        `${staffName} replied to you:`,
        cleanMessage,
      ].join('\n')
      const html = `<p>You have received a reply to your funding request.</p><p><strong>${staffName}</strong> replied to you:</p><p>${cleanMessage.replace(/\n/g, '<br />')}</p>`
      await sendApplicationThreadEmail({
        to: application[0].email,
        subject: `Re: Lanfoundary funding request #${application[0].id}`,
        text,
        html,
        applicationId: application[0].id,
      })
    } else {
      const fromName = currentUser.name?.trim() || currentUser.email
      const text = `${fromName} replied on request #${application[0].id}\n\n${cleanMessage}`
      const html = `<p><strong>${fromName}</strong> replied on request #${application[0].id}</p><p>${cleanMessage.replace(/\n/g, '<br />')}</p>`
      await sendApplicationThreadEmail({
        to: 'foundary@lankoping.se',
        subject: `Re: Lanfoundary funding request #${application[0].id}`,
        text,
        html,
        applicationId: application[0].id,
      })
    }

    return created[0]
  })

export const acceptOrganizationInviteFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => z.object({ token: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const currentUser = await requireStaffUser()
    const db = await getDb()

    const token = data.token.trim()
    const invite = await db
      .select()
      .from(organizationInvitations)
      .where(eq(organizationInvitations.token, token))
      .limit(1)

    if (!invite[0]) {
      throw new Error('Invitation not found')
    }

    if (invite[0].acceptedAt) {
      return { success: true, alreadyAccepted: true, organizationName: invite[0].organizationName }
    }

    if (invite[0].expiresAt.getTime() < Date.now()) {
      throw new Error('Invitation has expired')
    }

    const currentEmail = (currentUser.email ?? '').trim().toLowerCase()
    if (invite[0].email !== currentEmail) {
      throw new Error('This invitation is for a different email account')
    }

    const existingMembership = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, currentUser.id),
          eq(organizationMembers.organizationName, invite[0].organizationName),
        ),
      )
      .limit(1)

    if (!existingMembership[0]) {
      await db.insert(organizationMembers).values({
        userId: currentUser.id,
        organizationName: invite[0].organizationName,
        addedBy: invite[0].invitedBy ?? currentUser.id,
      })
    }

    await db
      .update(organizationInvitations)
      .set({
        acceptedBy: currentUser.id,
        acceptedAt: new Date(),
      })
      .where(eq(organizationInvitations.id, invite[0].id))

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'foundary.organization.member.accept',
      entityType: 'organization_member',
      details: {
        organizationName: invite[0].organizationName,
      },
    })

    return {
      success: true,
      alreadyAccepted: false,
      organizationName: invite[0].organizationName,
    }
  })

export const getFoundaryApplicationsFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requireOrganizerUser()
  const db = await getDb()

  try {
    return await db
      .select({
        id: foundaryApplications.id,
        applicantName: foundaryApplications.applicantName,
        email: foundaryApplications.email,
        age: foundaryApplications.age,
        cityCountry: foundaryApplications.cityCountry,
        organizationName: foundaryApplications.organizationName,
        organizationStatus: foundaryApplications.organizationStatus,
        hasHcbAccount: foundaryApplications.hasHcbAccount,
        hcbUsername: foundaryApplications.hcbUsername,
        preferredPaymentMethod: foundaryApplications.preferredPaymentMethod,
        eventName: foundaryApplications.eventName,
        plannedMonths: foundaryApplications.plannedMonths,
        expectedAttendees: foundaryApplications.expectedAttendees,
        requestedEvents: foundaryApplications.requestedEvents,
        fundingRequestAmount: foundaryApplications.fundingRequestAmount,
        briefEventDescription: foundaryApplications.briefEventDescription,
        budgetJustification: foundaryApplications.budgetJustification,
        status: foundaryApplications.status,
        createdByUserId: foundaryApplications.createdByUserId,
        isConfidential: foundaryApplications.isConfidential,
        ticketClosed: foundaryApplications.ticketClosed,
        ticketClosedAt: foundaryApplications.ticketClosedAt,
        ticketClosedByUserId: foundaryApplications.ticketClosedByUserId,
        reviewNotes: foundaryApplications.reviewNotes,
        reviewedAt: foundaryApplications.reviewedAt,
        reviewerName: users.name,
        createdAt: foundaryApplications.createdAt,
      })
      .from(foundaryApplications)
      .leftJoin(users, eq(foundaryApplications.reviewedBy, users.id))
      .orderBy(desc(foundaryApplications.createdAt))
  } catch (error) {
    if (!isMissingConfidentialityColumnsError(error)) throw error
    const legacyRows = await db
      .select({
        id: foundaryApplications.id,
        applicantName: foundaryApplications.applicantName,
        email: foundaryApplications.email,
        age: foundaryApplications.age,
        cityCountry: foundaryApplications.cityCountry,
        organizationName: foundaryApplications.organizationName,
        organizationStatus: foundaryApplications.organizationStatus,
        hasHcbAccount: foundaryApplications.hasHcbAccount,
        hcbUsername: foundaryApplications.hcbUsername,
        preferredPaymentMethod: foundaryApplications.preferredPaymentMethod,
        eventName: foundaryApplications.eventName,
        plannedMonths: foundaryApplications.plannedMonths,
        expectedAttendees: foundaryApplications.expectedAttendees,
        requestedEvents: foundaryApplications.requestedEvents,
        fundingRequestAmount: foundaryApplications.fundingRequestAmount,
        briefEventDescription: foundaryApplications.briefEventDescription,
        budgetJustification: foundaryApplications.budgetJustification,
        status: foundaryApplications.status,
        reviewNotes: foundaryApplications.reviewNotes,
        reviewedAt: foundaryApplications.reviewedAt,
        reviewerName: users.name,
        createdAt: foundaryApplications.createdAt,
      })
      .from(foundaryApplications)
      .leftJoin(users, eq(foundaryApplications.reviewedBy, users.id))
      .orderBy(desc(foundaryApplications.createdAt))

    return legacyRows.map((row) => ({
      ...row,
      createdByUserId: null as number | null,
      isConfidential: true,
      ticketClosed: false,
      ticketClosedAt: null,
      ticketClosedByUserId: null,
    }))
  }
})

export const updateFoundaryApplicationStatusFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({
      applicationId: z.number(),
      status: z.enum(['pending', 'approved', 'rejected']),
      adjustedFundingAmount: z.number().int().positive().max(100000).optional(),
      requestMoreInfoMessage: z.string().optional(),
      reviewNotes: z.string().optional(),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireOrganizerUser()
    const db = await getDb()
    const now = new Date()

    const updated = await db
      .update(foundaryApplications)
      .set({
        status: data.status,
        fundingRequestAmount: data.adjustedFundingAmount,
        reviewNotes: data.reviewNotes?.trim() || null,
        reviewedBy: currentUser.id,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(foundaryApplications.id, data.applicationId))
      .returning()

    const requestMessage = data.requestMoreInfoMessage?.trim()
    if (requestMessage) {
      await db.insert(foundaryApplicationMessages).values({
        applicationId: data.applicationId,
        senderUserId: currentUser.id,
        senderRole: currentUser.role,
        message: requestMessage,
      })

      const staffName = currentUser.name?.trim() || currentUser.email
      const text = [
        'You have received a reply to your funding request.',
        '',
        `${staffName} replied to you:`,
        requestMessage,
      ].join('\n')
      const html = `<p>You have received a reply to your funding request.</p><p><strong>${staffName}</strong> replied to you:</p><p>${requestMessage.replace(/\n/g, '<br />')}</p>`

      await sendApplicationThreadEmail({
        to: updated[0].email,
        subject: `Re: Lanfoundary funding request #${data.applicationId}`,
        text,
        html,
        applicationId: data.applicationId,
      })
    }

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: `foundary.application.${data.status}`,
      entityType: 'foundary_application',
      entityId: data.applicationId,
      details: {
        reviewNotes: data.reviewNotes ?? null,
        adjustedFundingAmount: data.adjustedFundingAmount ?? null,
        requestMoreInfoMessage: requestMessage ?? null,
      },
    })

    return updated[0]
  })

export const updateFoundaryApplicationConfidentialityFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        applicationId: z.number(),
        isConfidential: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireOrganizerUser()
    const db = await getDb()

    const updated = await db
      .update(foundaryApplications)
      .set({
        isConfidential: data.isConfidential,
        reviewedBy: currentUser.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(foundaryApplications.id, data.applicationId))
      .returning()

    if (!updated[0]) {
      throw new Error('Application not found')
    }

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: data.isConfidential
        ? 'foundary.application.confidentiality.enabled'
        : 'foundary.application.confidentiality.disabled',
      entityType: 'foundary_application',
      entityId: data.applicationId,
      details: {
        isConfidential: data.isConfidential,
      },
    })

    return updated[0]
  })

export const closeFoundaryApplicationTicketFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        applicationId: z.number(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireOrganizerUser()
    const db = await getDb()

    const application = await db
      .select({
        id: foundaryApplications.id,
        ticketClosed: foundaryApplications.ticketClosed,
      })
      .from(foundaryApplications)
      .where(eq(foundaryApplications.id, data.applicationId))
      .limit(1)

    if (!application[0]) {
      throw new Error('Application not found')
    }

    if (application[0].ticketClosed) {
      return application[0]
    }

    const closed = await db
      .update(foundaryApplications)
      .set({
        ticketClosed: true,
        ticketClosedAt: new Date(),
        ticketClosedByUserId: currentUser.id,
        updatedAt: new Date(),
      })
      .where(eq(foundaryApplications.id, data.applicationId))
      .returning({
        id: foundaryApplications.id,
        ticketClosed: foundaryApplications.ticketClosed,
      })

    if (!closed[0]) {
      throw new Error('Could not close ticket')
    }

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'foundary.application.ticket.close',
      entityType: 'foundary_application',
      entityId: data.applicationId,
    })

    return closed[0]
  })

export const closeFoundaryApplicationFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        applicationId: z.number(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireOrganizerUser()
    const db = await getDb()

    const existing = await db
      .select({ id: foundaryApplications.id })
      .from(foundaryApplications)
      .where(eq(foundaryApplications.id, data.applicationId))
      .limit(1)

    if (!existing[0]) {
      throw new Error('Application not found')
    }

    const now = new Date()
    const closed = await db
      .update(foundaryApplications)
      .set({
        status: 'rejected',
        reviewedBy: currentUser.id,
        reviewedAt: now,
        ticketClosed: true,
        ticketClosedAt: now,
        ticketClosedByUserId: currentUser.id,
        updatedAt: now,
      })
      .where(eq(foundaryApplications.id, data.applicationId))
      .returning({
        id: foundaryApplications.id,
        status: foundaryApplications.status,
        ticketClosed: foundaryApplications.ticketClosed,
      })

    if (!closed[0]) {
      throw new Error('Could not close application')
    }

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'foundary.application.close',
      entityType: 'foundary_application',
      entityId: data.applicationId,
    })

    return closed[0]
  })

export const decideFoundaryApplicationFundingFromTicketFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        applicationId: z.number(),
        decision: z.enum(['approved', 'rejected']),
        reason: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireOrganizerUser()
    const db = await getDb()

    const application = await db
      .select()
      .from(foundaryApplications)
      .where(eq(foundaryApplications.id, data.applicationId))
      .limit(1)

    if (!application[0]) {
      throw new Error('Application not found')
    }

    if (data.decision === 'rejected' && !data.reason?.trim()) {
      throw new Error('Please provide a rejection reason')
    }

    const now = new Date()
    const cleanReason = data.reason?.trim() || null

    const updated = await db
      .update(foundaryApplications)
      .set({
        status: data.decision,
        reviewNotes: cleanReason,
        reviewedBy: currentUser.id,
        reviewedAt: now,
        ticketClosed: true,
        ticketClosedAt: now,
        ticketClosedByUserId: currentUser.id,
        updatedAt: now,
      })
      .where(eq(foundaryApplications.id, data.applicationId))
      .returning()

    const decisionLabel = data.decision === 'approved' ? 'approved' : 'rejected'
    const cleanMessage = [
      data.decision === 'approved'
        ? 'Funding request approved.'
        : 'Funding request rejected and ticket closed.',
      cleanReason ? `Reason: ${cleanReason}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')

    await db.insert(foundaryApplicationMessages).values({
      applicationId: data.applicationId,
      senderUserId: currentUser.id,
      senderRole: currentUser.role,
      message: cleanMessage,
    })

    const staffName = currentUser.name?.trim() || currentUser.email
    const emailText = [
      `Your funding request #${data.applicationId} has been ${decisionLabel}.`,
      '',
      `${staffName} wrote:`,
      cleanMessage,
    ].join('\n')
    const emailHtml = `<p>Your funding request #${data.applicationId} has been <strong>${decisionLabel}</strong>.</p><p><strong>${staffName}</strong> wrote:</p><p>${cleanMessage.replace(/\n/g, '<br />')}</p>`

    await sendApplicationThreadEmail({
      to: application[0].email,
      subject: `Lanfoundary funding request #${data.applicationId} ${decisionLabel}`,
      text: emailText,
      html: emailHtml,
      applicationId: data.applicationId,
    })

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action:
        data.decision === 'approved'
          ? 'foundary.application.ticket.approve'
          : 'foundary.application.ticket.reject_and_close',
      entityType: 'foundary_application',
      entityId: data.applicationId,
      details: {
        reason: cleanReason,
      },
    })

    return updated[0]
  })

export const createFoundaryApplicationTicketFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        applicationId: z.number(),
        message: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireOrganizerUser()
    const db = await getDb()

    const application = await db
      .select()
      .from(foundaryApplications)
      .where(eq(foundaryApplications.id, data.applicationId))
      .limit(1)

    if (!application[0]) {
      throw new Error('Application not found')
    }

    if (application[0].ticketClosed) {
      throw new Error('This ticket is closed')
    }

    const cleanMessage = data.message.trim()
    const created = await db
      .insert(foundaryApplicationMessages)
      .values({
        applicationId: application[0].id,
        senderUserId: currentUser.id,
        senderRole: currentUser.role,
        message: cleanMessage,
      })
      .returning()

    const staffName = currentUser.name?.trim() || currentUser.email
    const text = [
      'You have received a new ticket update on your funding request.',
      '',
      `${staffName} wrote:`,
      cleanMessage,
    ].join('\n')
    const html = `<p>You have received a new ticket update on your funding request.</p><p><strong>${staffName}</strong> wrote:</p><p>${cleanMessage.replace(/\n/g, '<br />')}</p>`

    await sendApplicationThreadEmail({
      to: application[0].email,
      subject: `Re: Lanfoundary funding request #${application[0].id}`,
      text,
      html,
      applicationId: application[0].id,
    })

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'foundary.application.ticket.create',
      entityType: 'foundary_application',
      entityId: application[0].id,
      details: {
        messageLength: cleanMessage.length,
      },
    })

    return created[0]
  })

export const createHostedApplicationTicketFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        applicationId: z.number(),
        message: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireStaffUser()
    if (currentUser.role === 'organizer') {
      throw new Error('Organizers should use admin ticket actions')
    }

    const db = await getDb()

    const application = await db
      .select()
      .from(foundaryApplications)
      .where(eq(foundaryApplications.id, data.applicationId))
      .limit(1)

    if (!application[0]) {
      throw new Error('Application not found')
    }

    if (application[0].ticketClosed) {
      throw new Error('This ticket is closed')
    }

    const membership = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, currentUser.id),
          eq(organizationMembers.organizationName, application[0].organizationName),
        ),
      )
      .limit(1)

    if (!membership[0]) {
      throw new Error('Forbidden')
    }

    if (application[0].isConfidential && application[0].createdByUserId && application[0].createdByUserId !== currentUser.id) {
      throw new Error('This request is confidential to the original creator')
    }

    const existingOrganizerMessage = await db
      .select({ id: foundaryApplicationMessages.id })
      .from(foundaryApplicationMessages)
      .where(
        and(
          eq(foundaryApplicationMessages.applicationId, data.applicationId),
          eq(foundaryApplicationMessages.senderRole, 'organizer'),
        ),
      )
      .limit(1)

    if (existingOrganizerMessage[0]) {
      throw new Error('A ticket thread already exists. Use reply instead.')
    }

    const latestThreadMessage = await db
      .select({
        senderUserId: foundaryApplicationMessages.senderUserId,
        senderRole: foundaryApplicationMessages.senderRole,
      })
      .from(foundaryApplicationMessages)
      .where(eq(foundaryApplicationMessages.applicationId, data.applicationId))
      .orderBy(desc(foundaryApplicationMessages.createdAt))
      .limit(1)

    const latest = latestThreadMessage[0]
    if (latest && latest.senderRole !== 'organizer' && latest.senderUserId === currentUser.id) {
      throw new Error('Please wait for staff to reply before sending another message')
    }

    const cleanMessage = data.message.trim()
    const created = await db
      .insert(foundaryApplicationMessages)
      .values({
        applicationId: data.applicationId,
        senderUserId: currentUser.id,
        senderRole: currentUser.role,
        message: cleanMessage,
      })
      .returning()

    const fromName = currentUser.name?.trim() || currentUser.email
    const text = `${fromName} opened a ticket on request #${application[0].id}\n\n${cleanMessage}`
    const html = `<p><strong>${fromName}</strong> opened a ticket on request #${application[0].id}</p><p>${cleanMessage.replace(/\n/g, '<br />')}</p>`
    await sendApplicationThreadEmail({
      to: 'foundary@lankoping.se',
      subject: `Re: Lanfoundary funding request #${application[0].id}`,
      text,
      html,
      applicationId: application[0].id,
    })

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'foundary.application.ticket.create_from_hosted',
      entityType: 'foundary_application',
      entityId: application[0].id,
      details: {
        messageLength: cleanMessage.length,
      },
    })

    return created[0]
  })

export const createHostedSupportTicketFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        message: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireStaffUser()
    if (currentUser.role === 'organizer') {
      throw new Error('Organizers should use admin ticket actions')
    }

    const db = await getDb()
    const cleanMessage = data.message.trim()

    const openTickets = await db
      .select({ id: hostedSupportTickets.id })
      .from(hostedSupportTickets)
      .where(and(eq(hostedSupportTickets.userId, currentUser.id), eq(hostedSupportTickets.status, 'open')))

    if (openTickets.length >= 3) {
      throw new Error('You can have at most 3 open tickets at a time')
    }

    const created = await db
      .insert(hostedSupportTickets)
      .values({
        userId: currentUser.id,
        message: cleanMessage,
        status: 'open',
      })
      .returning({
        id: hostedSupportTickets.id,
        status: hostedSupportTickets.status,
      })

    await db.insert(hostedSupportTicketMessages).values({
      ticketId: created[0].id,
      senderUserId: currentUser.id,
      senderRole: currentUser.role,
      message: cleanMessage,
    })

    const organizations = await db
      .select({ organizationName: organizationMembers.organizationName })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, currentUser.id))

    const organizationNames = Array.from(new Set(organizations.map((org) => normalizeOrg(org.organizationName)).filter(Boolean)))

    const fromName = currentUser.name?.trim() || currentUser.email
    const organizationLine =
      organizationNames.length > 0 ? `Organization(s): ${organizationNames.join(', ')}` : 'Organization(s): None linked yet'

    const text = [
      `${fromName} opened a hosted support ticket.`,
      organizationLine,
      '',
      cleanMessage,
    ].join('\n')

    const html = [
      `<p><strong>${fromName}</strong> opened a hosted support ticket.</p>`,
      `<p>${organizationLine}</p>`,
      `<p>${cleanMessage.replace(/\n/g, '<br />')}</p>`,
    ].join('')

    await sendHostedSupportThreadEmail({
      to: 'foundary@lankoping.se',
      subject: `Hosted support ticket #${created[0].id} from ${fromName}`,
      text,
      html,
      ticketId: created[0].id,
    })

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'foundary.hosted.support_ticket.create',
      entityType: 'hosted_support_ticket',
      entityId: created[0].id,
      details: {
        messageLength: cleanMessage.length,
        organizationCount: organizationNames.length,
      },
    })

    return {
      success: true,
      ticketId: created[0].id,
    }
  })

export const getMyHostedSupportTicketMessagesFn = createServerFn({ method: 'GET' }).handler(async () => {
  const currentUser = await requireStaffUser()
  if (currentUser.role === 'organizer') {
    throw new Error('Use admin ticket views')
  }

  const db = await getDb()

  return await db
    .select({
      id: hostedSupportTicketMessages.id,
      ticketId: hostedSupportTicketMessages.ticketId,
      senderUserId: hostedSupportTicketMessages.senderUserId,
      senderRole: hostedSupportTicketMessages.senderRole,
      senderName: users.name,
      senderEmail: users.email,
      message: hostedSupportTicketMessages.message,
      createdAt: hostedSupportTicketMessages.createdAt,
    })
    .from(hostedSupportTicketMessages)
    .innerJoin(hostedSupportTickets, eq(hostedSupportTicketMessages.ticketId, hostedSupportTickets.id))
    .innerJoin(users, eq(hostedSupportTicketMessages.senderUserId, users.id))
    .where(eq(hostedSupportTickets.userId, currentUser.id))
    .orderBy(desc(hostedSupportTicketMessages.createdAt))
})

export const postMyHostedSupportTicketMessageFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        ticketId: z.number(),
        message: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireStaffUser()
    if (currentUser.role === 'organizer') {
      throw new Error('Use admin ticket actions')
    }

    const db = await getDb()

    const ticket = await db
      .select({
        id: hostedSupportTickets.id,
        userId: hostedSupportTickets.userId,
        status: hostedSupportTickets.status,
      })
      .from(hostedSupportTickets)
      .where(eq(hostedSupportTickets.id, data.ticketId))
      .limit(1)

    if (!ticket[0]) {
      throw new Error('Ticket not found')
    }

    if (ticket[0].userId !== currentUser.id) {
      throw new Error('Forbidden')
    }

    if (ticket[0].status === 'closed') {
      throw new Error('This ticket is closed')
    }

    const cleanMessage = data.message.trim()

    const created = await db
      .insert(hostedSupportTicketMessages)
      .values({
        ticketId: data.ticketId,
        senderUserId: currentUser.id,
        senderRole: currentUser.role,
        message: cleanMessage,
      })
      .returning({
        id: hostedSupportTicketMessages.id,
      })

    await db
      .update(hostedSupportTickets)
      .set({
        updatedAt: new Date(),
      })
      .where(eq(hostedSupportTickets.id, data.ticketId))

    const fromName = currentUser.name?.trim() || currentUser.email
    const text = `${fromName} replied on hosted support ticket #${data.ticketId}\n\n${cleanMessage}`
    const html = `<p><strong>${fromName}</strong> replied on hosted support ticket #${data.ticketId}</p><p>${cleanMessage.replace(/\n/g, '<br />')}</p>`

    await sendHostedSupportThreadEmail({
      to: 'foundary@lankoping.se',
      subject: `Re: Hosted support ticket #${data.ticketId}`,
      text,
      html,
      ticketId: data.ticketId,
    })

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'foundary.hosted.support_ticket.reply',
      entityType: 'hosted_support_ticket',
      entityId: data.ticketId,
      details: {
        messageLength: cleanMessage.length,
        messageId: created[0].id,
      },
    })

    return { success: true }
  })

export const getMyHostedSupportTicketsFn = createServerFn({ method: 'GET' }).handler(async () => {
  const currentUser = await requireStaffUser()
  if (currentUser.role === 'organizer') {
    throw new Error('Use admin ticket views')
  }

  const db = await getDb()
  return await db
    .select({
      id: hostedSupportTickets.id,
      userId: hostedSupportTickets.userId,
      message: hostedSupportTickets.message,
      status: hostedSupportTickets.status,
      closedAt: hostedSupportTickets.closedAt,
      closedByUserId: hostedSupportTickets.closedByUserId,
      createdAt: hostedSupportTickets.createdAt,
      updatedAt: hostedSupportTickets.updatedAt,
    })
    .from(hostedSupportTickets)
    .where(eq(hostedSupportTickets.userId, currentUser.id))
    .orderBy(desc(hostedSupportTickets.createdAt))
})

export const getHostedSupportTicketsForAdminFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requireOrganizerUser()
  const db = await getDb()

  return await db
    .select({
      id: hostedSupportTickets.id,
      userId: hostedSupportTickets.userId,
      reporterName: users.name,
      reporterEmail: users.email,
      message: hostedSupportTickets.message,
      status: hostedSupportTickets.status,
      closedAt: hostedSupportTickets.closedAt,
      closedByUserId: hostedSupportTickets.closedByUserId,
      createdAt: hostedSupportTickets.createdAt,
      updatedAt: hostedSupportTickets.updatedAt,
    })
    .from(hostedSupportTickets)
    .innerJoin(users, eq(hostedSupportTickets.userId, users.id))
    .orderBy(desc(hostedSupportTickets.createdAt))
})

export const getHostedSupportTicketMessagesForAdminFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requireOrganizerUser()
  const db = await getDb()

  return await db
    .select({
      id: hostedSupportTicketMessages.id,
      ticketId: hostedSupportTicketMessages.ticketId,
      senderUserId: hostedSupportTicketMessages.senderUserId,
      senderRole: hostedSupportTicketMessages.senderRole,
      senderName: users.name,
      senderEmail: users.email,
      message: hostedSupportTicketMessages.message,
      createdAt: hostedSupportTicketMessages.createdAt,
    })
    .from(hostedSupportTicketMessages)
    .innerJoin(users, eq(hostedSupportTicketMessages.senderUserId, users.id))
    .orderBy(desc(hostedSupportTicketMessages.createdAt))
})

export const closeMyHostedSupportTicketFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        ticketId: z.number(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireStaffUser()
    if (currentUser.role === 'organizer') {
      throw new Error('Use admin ticket actions')
    }

    const db = await getDb()

    const ticket = await db
      .select({
        id: hostedSupportTickets.id,
        userId: hostedSupportTickets.userId,
        status: hostedSupportTickets.status,
      })
      .from(hostedSupportTickets)
      .where(eq(hostedSupportTickets.id, data.ticketId))
      .limit(1)

    if (!ticket[0]) {
      throw new Error('Ticket not found')
    }

    if (ticket[0].userId !== currentUser.id) {
      throw new Error('Forbidden')
    }

    if (ticket[0].status === 'closed') {
      return { success: true }
    }

    await db
      .update(hostedSupportTickets)
      .set({
        status: 'closed',
        closedAt: new Date(),
        closedByUserId: currentUser.id,
        updatedAt: new Date(),
      })
      .where(eq(hostedSupportTickets.id, data.ticketId))

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'foundary.hosted.support_ticket.close',
      entityType: 'hosted_support_ticket',
      entityId: data.ticketId,
    })

    return { success: true }
  })

export const postHostedSupportTicketMessageFromAdminFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        ticketId: z.number(),
        message: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireOrganizerUser()
    const db = await getDb()

    const ticket = await db
      .select({
        id: hostedSupportTickets.id,
        status: hostedSupportTickets.status,
        reporterEmail: users.email,
      })
      .from(hostedSupportTickets)
      .innerJoin(users, eq(hostedSupportTickets.userId, users.id))
      .where(eq(hostedSupportTickets.id, data.ticketId))
      .limit(1)

    if (!ticket[0]) {
      throw new Error('Ticket not found')
    }

    if (ticket[0].status === 'closed') {
      throw new Error('This ticket is closed')
    }

    const cleanMessage = data.message.trim()

    await db.insert(hostedSupportTicketMessages).values({
      ticketId: data.ticketId,
      senderUserId: currentUser.id,
      senderRole: currentUser.role,
      message: cleanMessage,
    })

    await db
      .update(hostedSupportTickets)
      .set({
        updatedAt: new Date(),
      })
      .where(eq(hostedSupportTickets.id, data.ticketId))

    const senderName = currentUser.name?.trim() || currentUser.email
    const text = `${senderName} replied on hosted support ticket #${data.ticketId}\n\n${cleanMessage}`
    const html = `<p><strong>${senderName}</strong> replied on hosted support ticket #${data.ticketId}</p><p>${cleanMessage.replace(/\n/g, '<br />')}</p>`

    await sendHostedSupportThreadEmail({
      to: ticket[0].reporterEmail,
      subject: `Re: Hosted support ticket #${data.ticketId}`,
      text,
      html,
      ticketId: data.ticketId,
    })

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'foundary.hosted.support_ticket.reply_from_admin',
      entityType: 'hosted_support_ticket',
      entityId: data.ticketId,
      details: {
        messageLength: cleanMessage.length,
      },
    })

    return { success: true }
  })

export const closeHostedSupportTicketFromAdminFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        ticketId: z.number(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireOrganizerUser()
    const db = await getDb()

    const ticket = await db
      .select({
        id: hostedSupportTickets.id,
        status: hostedSupportTickets.status,
      })
      .from(hostedSupportTickets)
      .where(eq(hostedSupportTickets.id, data.ticketId))
      .limit(1)

    if (!ticket[0]) {
      throw new Error('Ticket not found')
    }

    if (ticket[0].status === 'closed') {
      return { success: true }
    }

    await db
      .update(hostedSupportTickets)
      .set({
        status: 'closed',
        closedAt: new Date(),
        closedByUserId: currentUser.id,
        updatedAt: new Date(),
      })
      .where(eq(hostedSupportTickets.id, data.ticketId))

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'foundary.hosted.support_ticket.close_from_admin',
      entityType: 'hosted_support_ticket',
      entityId: data.ticketId,
    })

    return { success: true }
  })

export const deleteHostedSupportTicketFromAdminFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        ticketId: z.number(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireOrganizerUser()
    const db = await getDb()

    const ticket = await db
      .select({ id: hostedSupportTickets.id })
      .from(hostedSupportTickets)
      .where(eq(hostedSupportTickets.id, data.ticketId))
      .limit(1)

    if (!ticket[0]) {
      throw new Error('Ticket not found')
    }

    await db.delete(hostedSupportTicketMessages).where(eq(hostedSupportTicketMessages.ticketId, data.ticketId))
    await db.delete(hostedSupportTickets).where(eq(hostedSupportTickets.id, data.ticketId))

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'foundary.hosted.support_ticket.delete_from_admin',
      entityType: 'hosted_support_ticket',
      entityId: data.ticketId,
    })

    return { success: true }
  })

export const closeHostedApplicationTicketFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        applicationId: z.number(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireStaffUser()
    if (currentUser.role === 'organizer') {
      throw new Error('Use admin actions to manage this ticket')
    }

    const db = await getDb()

    const application = await db
      .select()
      .from(foundaryApplications)
      .where(eq(foundaryApplications.id, data.applicationId))
      .limit(1)

    if (!application[0]) {
      throw new Error('Application not found')
    }

    const membership = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, currentUser.id),
          eq(organizationMembers.organizationName, application[0].organizationName),
        ),
      )
      .limit(1)

    if (!membership[0]) {
      throw new Error('Forbidden')
    }

    if (application[0].isConfidential && application[0].createdByUserId && application[0].createdByUserId !== currentUser.id) {
      throw new Error('This request is confidential to the original creator')
    }

    const closed = await db
      .update(foundaryApplications)
      .set({
        ticketClosed: true,
        ticketClosedAt: new Date(),
        ticketClosedByUserId: currentUser.id,
        updatedAt: new Date(),
      })
      .where(eq(foundaryApplications.id, data.applicationId))
      .returning({
        id: foundaryApplications.id,
        ticketClosed: foundaryApplications.ticketClosed,
      })

    if (!closed[0]) {
      throw new Error('Could not close ticket')
    }

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'foundary.application.ticket.close_from_hosted',
      entityType: 'foundary_application',
      entityId: data.applicationId,
    })

    return closed[0]
  })

export const deleteFoundaryApplicationFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        applicationId: z.number(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireOrganizerUser()
    const db = await getDb()

    const existing = await db
      .select()
      .from(foundaryApplications)
      .where(eq(foundaryApplications.id, data.applicationId))
      .limit(1)

    if (!existing[0]) {
      throw new Error('Application not found')
    }

    const removedMessages = await db
      .delete(foundaryApplicationMessages)
      .where(eq(foundaryApplicationMessages.applicationId, data.applicationId))
      .returning({ id: foundaryApplicationMessages.id })

    const removedApplication = await db
      .delete(foundaryApplications)
      .where(eq(foundaryApplications.id, data.applicationId))
      .returning({ id: foundaryApplications.id })

    if (!removedApplication[0]) {
      throw new Error('Could not delete application')
    }

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'foundary.application.delete',
      entityType: 'foundary_application',
      entityId: data.applicationId,
      details: {
        organizationName: existing[0].organizationName,
        eventName: existing[0].eventName,
        deletedMessageCount: removedMessages.length,
      },
    })

    return {
      success: true,
      applicationId: data.applicationId,
      deletedMessageCount: removedMessages.length,
    }
  })