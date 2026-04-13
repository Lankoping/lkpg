'use server'
import { createServerFn } from '@tanstack/react-start'
import { getDb } from '../db/runtime'
import { users, activityLogs, posts, tickets, loginTwoFactorCodes } from '../db/schema'
import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm'
import { z } from 'zod'
import { setCookie, getCookie, deleteCookie } from '@tanstack/react-start/server'
import { createHash, randomInt, randomUUID } from 'node:crypto'
import {
  enforceDemoOwnUserScope,
  getDemoAccountEmails,
  isDemoTesterUser,
  requireOrganizerUser,
  requireStaffUser,
} from '../lib/access'
import { hashPassword, isHashedPassword, verifyPassword } from '../lib/password'
import { writeActivityLog } from './logs'

const TWO_FACTOR_TTL_MS = 10 * 60 * 1000
const TWO_FACTOR_RESEND_COOLDOWN_MS = 60 * 1000

const maskEmail = (email: string) => {
  const [local, domain] = email.split('@')
  if (!local || !domain) return email
  const safeLocal = `${local.slice(0, 2)}***`
  return `${safeLocal}@${domain}`
}

const hashTwoFactorCode = (code: string) => createHash('sha256').update(code).digest('hex')

async function getMailerTransport() {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    throw new Error('SMTP configuration missing: set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS')
  }

  const nodemailer = await import('nodemailer')
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
}

async function sendTwoFactorCodeEmail(targetEmail: string, code: string) {
  const transporter = await getMailerTransport()

  await transporter.sendMail({
    from: 'foundary@lankoping.se',
    to: targetEmail,
    subject: 'Your Lan Foundary login code',
    text: `Your Lan Foundary verification code is ${code}. It expires in 10 minutes.`,
    html: `<p>Your Lan Foundary verification code is <strong>${code}</strong>.</p><p>It expires in 10 minutes.</p>`,
  })
}

async function sendAdminPasswordResetEmail({
  targetEmail,
  temporaryPassword,
  requestedBy,
}: {
  targetEmail: string
  temporaryPassword: string
  requestedBy: string
}) {
  const transporter = await getMailerTransport()

  await transporter.sendMail({
    from: 'foundary@lankoping.se',
    to: targetEmail,
    subject: 'Lan Foundary password reset',
    text: [
      `A staff member (${requestedBy}) reset your Lan Foundary password.`,
      '',
      `Temporary password: ${temporaryPassword}`,
      '',
      'Please sign in and change your password immediately.',
    ].join('\n'),
    html: [
      `<p>A staff member (<strong>${requestedBy}</strong>) reset your Lan Foundary password.</p>`,
      `<p><strong>Temporary password:</strong> <code>${temporaryPassword}</code></p>`,
      '<p>Please sign in and change your password immediately.</p>',
    ].join(''),
  })
}

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        email: z.string(),
        passwordHash: z.string(),
        twoFactorCode: z.string().optional(),
        challengeId: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = await getDb()
    const normalizedEmail = data.email.trim().toLowerCase()

    const user = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1)
    if (!user || user.length === 0) {
      throw new Error('User not found')
    }

    if (user[0].role !== 'organizer' && user[0].role !== 'volunteer') {
      throw new Error('Account type not allowed')
    }

    if (user[0].active === false) {
      throw new Error('Account is locked')
    }

    if (!verifyPassword(data.passwordHash, user[0].passwordHash)) {
      throw new Error('Invalid password') 
    }

    // Start 2FA step if no challenge/code has been submitted yet.
    if (!data.twoFactorCode || !data.challengeId) {
      const recentChallenge = await db
        .select()
        .from(loginTwoFactorCodes)
        .where(and(eq(loginTwoFactorCodes.userId, user[0].id), isNull(loginTwoFactorCodes.consumedAt)))
        .orderBy(desc(loginTwoFactorCodes.createdAt))
        .limit(1)

      if (
        recentChallenge[0] &&
        recentChallenge[0].expiresAt.getTime() > Date.now() &&
        Date.now() - recentChallenge[0].createdAt.getTime() < TWO_FACTOR_RESEND_COOLDOWN_MS
      ) {
        return {
          success: false,
          requiresTwoFactor: true,
          challengeId: recentChallenge[0].challengeId,
          email: maskEmail(user[0].email),
        }
      }

      const code = randomInt(100000, 1000000).toString()
      const challengeId = createHash('sha256')
        .update(`${user[0].id}:${Date.now()}:${Math.random()}`)
        .digest('hex')
      const expiresAt = new Date(Date.now() + TWO_FACTOR_TTL_MS)

      await db.delete(loginTwoFactorCodes).where(eq(loginTwoFactorCodes.userId, user[0].id))
      await db.insert(loginTwoFactorCodes).values({
        userId: user[0].id,
        challengeId,
        codeHash: hashTwoFactorCode(code),
        expiresAt,
      })

      await sendTwoFactorCodeEmail(user[0].email, code)

      return {
        success: false,
        requiresTwoFactor: true,
        challengeId,
        email: maskEmail(user[0].email),
      }
    }

    const challenge = await db
      .select()
      .from(loginTwoFactorCodes)
      .where(and(eq(loginTwoFactorCodes.userId, user[0].id), eq(loginTwoFactorCodes.challengeId, data.challengeId)))
      .limit(1)

    if (!challenge[0]) {
      throw new Error('2FA challenge not found. Please sign in again.')
    }

    if (challenge[0].consumedAt || challenge[0].expiresAt.getTime() < Date.now()) {
      throw new Error('2FA code expired. Please sign in again.')
    }

    if (challenge[0].codeHash !== hashTwoFactorCode(data.twoFactorCode.trim())) {
      throw new Error('Invalid 2FA code')
    }

    await db
      .update(loginTwoFactorCodes)
      .set({ consumedAt: new Date() })
      .where(eq(loginTwoFactorCodes.id, challenge[0].id))

    // Upgrade legacy plaintext password rows after successful login.
    if (!isHashedPassword(user[0].passwordHash)) {
      await db
        .update(users)
        .set({ passwordHash: hashPassword(data.passwordHash) })
        .where(eq(users.id, user[0].id))
    }

    // Set a session cookie
    setCookie('session', user[0].id.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    })

    await writeActivityLog({
      actorUserId: user[0].id,
      actorRole: user[0].role,
      action: 'auth.login',
      entityType: 'session',
      details: { email: user[0].email, twoFactor: true },
    })

    return { success: true, requiresTwoFactor: false, user: user[0] }
  })

export const logoutFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({}).parse(data ?? {}))
  .handler(async () => {
    const userId = getCookie('session')
    if (userId) {
      const db = await getDb()
      const user = await db.select().from(users).where(eq(users.id, parseInt(userId))).limit(1)
      if (user[0]) {
        await writeActivityLog({
          actorUserId: user[0].id,
          actorRole: user[0].role,
          action: 'auth.logout',
          entityType: 'session',
        })
      }
    }

    deleteCookie('session', { path: '/' })
    return { success: true }
  })

export const getSessionFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const userId = getCookie('session')
    if (!userId) return null

    const db = await getDb()
    const user = await db.select().from(users).where(eq(users.id, parseInt(userId))).limit(1)
    if (!user[0] || (user[0].role !== 'organizer' && user[0].role !== 'volunteer') || user[0].active === false) return null
    return {
      ...user[0],
      isDemoTester: isDemoTesterUser(user[0]),
    }
  })

export const getUsersFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const currentUser = await requireOrganizerUser()
    const db = await getDb()

    if (isDemoTesterUser(currentUser)) {
      return [currentUser]
    }

    return await db.select().from(users)
  })

export const createUserFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(1),
        name: z.string().optional(),
        role: z.enum(['organizer', 'volunteer']).default('volunteer'),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireOrganizerUser()
    const db = await getDb()

    if (isDemoTesterUser(currentUser)) {
      throw new Error('Forbidden in demo mode')
    }

    const existing = await db.select().from(users).where(eq(users.email, data.email)).limit(1)
    if (existing.length > 0) {
      throw new Error('Email already exists')
    }

    const created = await db
      .insert(users)
      .values({
        email: data.email,
        passwordHash: hashPassword(data.password),
        name: data.name,
        role: data.role,
        active: true,
      })
      .returning()

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'user.create',
      entityType: 'user',
      entityId: created[0].id,
      details: {
        email: created[0].email,
        role: created[0].role,
      },
    })

    return created[0]
  })

export const changePasswordFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      userId: z.number(),
      newPassword: z.string().min(1),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const currentUser = await requireStaffUser()
    const db = await getDb()

    enforceDemoOwnUserScope(currentUser, data.userId)

    const targetUser = await db
      .select()
      .from(users)
      .where(eq(users.id, data.userId))
      .limit(1)

    if (!targetUser[0]) {
      throw new Error('User not found')
    }

    if (currentUser.role !== 'organizer' && currentUser.id !== targetUser[0].id) {
      throw new Error('Forbidden: Cannot change another account password')
    }

    await db
      .update(users)
      .set({ passwordHash: hashPassword(data.newPassword) })
      .where(eq(users.id, data.userId))

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'user.password.change',
      entityType: 'user',
      entityId: data.userId,
      details: {
        selfService: currentUser.id === data.userId,
      },
    })

    return { success: true }
  })

export const adminResetUserPasswordFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({
      userId: z.number(),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireOrganizerUser()
    const db = await getDb()

    if (isDemoTesterUser(currentUser)) {
      throw new Error('Forbidden in demo mode')
    }

    const targetUser = await db
      .select()
      .from(users)
      .where(eq(users.id, data.userId))
      .limit(1)

    if (!targetUser[0]) {
      throw new Error('User not found')
    }

    if (targetUser[0].active === false) {
      throw new Error('Target account is locked')
    }

    const temporaryPassword = `Reset-${randomInt(100000, 999999)}-${randomUUID().slice(0, 6)}`

    await db
      .update(users)
      .set({ passwordHash: hashPassword(temporaryPassword) })
      .where(eq(users.id, data.userId))

    const requestedBy = currentUser.name?.trim() || currentUser.email || `User ${currentUser.id}`
    await sendAdminPasswordResetEmail({
      targetEmail: targetUser[0].email,
      temporaryPassword,
      requestedBy,
    })

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'user.password.reset_email',
      entityType: 'user',
      entityId: data.userId,
      details: {
        targetEmail: targetUser[0].email,
      },
    })

    return { success: true }
  })

export const deleteUserFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      userId: z.number(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const currentUser = await requireOrganizerUser()
    const db = await getDb()

    if (isDemoTesterUser(currentUser)) {
      throw new Error('Forbidden in demo mode')
    }

    if (currentUser.id === data.userId) {
      throw new Error('Forbidden: Cannot delete yourself')
    }

    const targetUser = await db
      .select()
      .from(users)
      .where(eq(users.id, data.userId))
      .limit(1)

    if (!targetUser[0]) {
      throw new Error('User not found')
    }

    // Null out all foreign key references to this user before deletion

    // Posts authored by this user
    await db.update(posts).set({ authorId: null }).where(eq(posts.authorId, data.userId))

    // Tickets issued or scanned by this user
    await db.update(tickets).set({ issuedBy: null }).where(eq(tickets.issuedBy, data.userId))
    await db.update(tickets).set({ scannedBy: null }).where(eq(tickets.scannedBy, data.userId))

    // Activity logs - delete logs where this user was the actor (actorUserId is NOT NULL)
    await db.delete(activityLogs).where(eq(activityLogs.actorUserId, data.userId))

    // Delete user
    await db
      .delete(users)
      .where(eq(users.id, data.userId))

    // Log the deletion (using current user as actor, not the deleted user)
    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'user.delete',
      entityType: 'user',
      entityId: data.userId,
      details: {
        email: targetUser[0]?.email ?? null,
      },
    })

    return { success: true }
  })

export const lockUserFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      userId: z.number(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const currentUser = await requireOrganizerUser()
    const db = await getDb()

    if (isDemoTesterUser(currentUser)) {
      throw new Error('Forbidden in demo mode')
    }

    if (currentUser.id === data.userId) throw new Error('Forbidden: Cannot lock yourself')

    await db.update(users).set({ active: false }).where(eq(users.id, data.userId))

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'user.lock',
      entityType: 'user',
      entityId: data.userId,
    })

    return { success: true }
  })

export const updateProfileFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({
      name: z.string().min(1).max(120),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const currentUser = await requireStaffUser()
    const db = await getDb()
    const updated = await db
      .update(users)
      .set({ name: data.name })
      .where(eq(users.id, currentUser.id))
      .returning()

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'profile.update',
      entityType: 'user',
      entityId: currentUser.id,
      details: { name: data.name },
    })

    return updated[0]
  })

export const updateUserFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({
      userId: z.number(),
      name: z.string().min(1).max(120),
      role: z.enum(['organizer', 'volunteer']),
      active: z.boolean(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const currentUser = await requireOrganizerUser()
    const db = await getDb()

    if (isDemoTesterUser(currentUser)) {
      enforceDemoOwnUserScope(currentUser, data.userId)
      throw new Error('Forbidden in demo mode')
    }

    if (currentUser.id === data.userId && data.role !== 'organizer') {
      throw new Error('You cannot remove your own organizer access')
    }

    const updated = await db
      .update(users)
      .set({
        name: data.name,
        role: data.role,
        active: data.active,
      })
      .where(eq(users.id, data.userId))
      .returning()

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'user.update',
      entityType: 'user',
      entityId: data.userId,
      details: {
        role: data.role,
        active: data.active,
      },
    })

    return updated[0]
  })

export const getDemoAccountsFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    const currentUser = await requireOrganizerUser()
    const db = await getDb()

    if (isDemoTesterUser(currentUser)) {
      return [currentUser]
    }

    const demoEmails = getDemoAccountEmails()
    if (demoEmails.length === 0) {
      return []
    }

    return await db.select().from(users).where(inArray(users.email, demoEmails))
  })

export const setDemoAccountsActiveFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => z.object({ active: z.boolean() }).parse(data))
  .handler(async ({ data }) => {
    const currentUser = await requireOrganizerUser()
    const db = await getDb()

    if (isDemoTesterUser(currentUser)) {
      throw new Error('Forbidden in demo mode')
    }

    const demoEmails = getDemoAccountEmails()
    if (demoEmails.length === 0) {
      return { success: true, updatedCount: 0 }
    }

    const updated = await db
      .update(users)
      .set({ active: data.active })
      .where(inArray(users.email, demoEmails))
      .returning()

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: data.active ? 'demo_accounts.enable' : 'demo_accounts.disable',
      entityType: 'user',
      details: {
        emails: demoEmails,
        count: updated.length,
      },
    })

    return {
      success: true,
      updatedCount: updated.length,
      demoAccounts: updated,
    }
  })
