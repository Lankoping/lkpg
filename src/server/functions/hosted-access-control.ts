'use server'
import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq } from 'drizzle-orm'
import { getDb } from '../db/runtime'
import { foundaryApplications, organizationMembers } from '../db/schema'
import { requireStaffUser } from '../lib/access'

type HostedAccessControl = {
  organizationName: string | null
  organizationState: {
    status: 'none' | 'pending' | 'approved' | 'rejected'
  }
  permissions: {
    canManageMembers: boolean
    canRequestFunds: boolean
    canManageTickets: boolean
    canAccessStorage: boolean
  }
}

const defaultHostedAccessControl: HostedAccessControl = {
  organizationName: null,
  organizationState: { status: 'none' },
  permissions: {
    canManageMembers: false,
    canRequestFunds: false,
    canManageTickets: false,
    canAccessStorage: false,
  },
}

const isMissingAccessControlColumnsError = (error: unknown) => {
  if (!(error instanceof Error)) return false

  const msg = error.message.toLowerCase()
  return (
    msg.includes('can_manage_members') ||
    msg.includes('can_request_funds') ||
    msg.includes('can_manage_tickets') ||
    msg.includes('can_access_storage')
  )
}

const normalizeOrg = (value: string) => value.trim()

export const getHostedAccessControlFn = createServerFn({ method: 'GET' }).handler(async () => {
  const currentUser = await requireStaffUser()
  const db = await getDb()

  try {
    const memberships = await db
      .select({
        organizationName: organizationMembers.organizationName,
        canManageMembers: organizationMembers.canManageMembers,
        canRequestFunds: organizationMembers.canRequestFunds,
        canManageTickets: organizationMembers.canManageTickets,
        canAccessStorage: organizationMembers.canAccessStorage,
      })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, currentUser.id))
      .orderBy(desc(organizationMembers.createdAt))
      .limit(1)

    if (!memberships[0]) {
      return defaultHostedAccessControl
    }

    const organizationName = normalizeOrg(memberships[0].organizationName)
    const latestApplication = await db
      .select({ status: foundaryApplications.status })
      .from(foundaryApplications)
      .where(eq(foundaryApplications.organizationName, organizationName))
      .orderBy(desc(foundaryApplications.createdAt))
      .limit(1)

    return {
      organizationName,
      organizationState: {
        status: latestApplication[0]?.status ?? 'none',
      },
      permissions: {
        canManageMembers: memberships[0].canManageMembers,
        canRequestFunds: memberships[0].canRequestFunds,
        canManageTickets: memberships[0].canManageTickets,
        canAccessStorage: memberships[0].canAccessStorage,
      },
    }
  } catch (error) {
    if (!isMissingAccessControlColumnsError(error)) {
      throw error
    }

    const memberships = await db
      .select({ organizationName: organizationMembers.organizationName })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, currentUser.id))
      .orderBy(desc(organizationMembers.createdAt))
      .limit(1)

    if (!memberships[0]) {
      return defaultHostedAccessControl
    }

    const organizationName = normalizeOrg(memberships[0].organizationName)
    const latestApplication = await db
      .select({ status: foundaryApplications.status })
      .from(foundaryApplications)
      .where(eq(foundaryApplications.organizationName, organizationName))
      .orderBy(desc(foundaryApplications.createdAt))
      .limit(1)

    return {
      organizationName,
      organizationState: {
        status: latestApplication[0]?.status ?? 'none',
      },
      permissions: {
        canManageMembers: true,
        canRequestFunds: true,
        canManageTickets: true,
        canAccessStorage: true,
      },
    }
  }
})

export const updateOrganizationMemberAccessFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    ({
      organizationName: String((data as { organizationName?: unknown })?.organizationName ?? '').trim(),
      userId: Number((data as { userId?: unknown })?.userId),
      canManageMembers: Boolean((data as { canManageMembers?: unknown })?.canManageMembers),
      canRequestFunds: Boolean((data as { canRequestFunds?: unknown })?.canRequestFunds),
      canManageTickets: Boolean((data as { canManageTickets?: unknown })?.canManageTickets),
      canAccessStorage: Boolean((data as { canAccessStorage?: unknown })?.canAccessStorage),
    }),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireStaffUser()
    const db = await getDb()

    const accessControl = await getHostedAccessControlFn()
    if (!accessControl.permissions.canManageMembers) {
      throw new Error('You do not have permission to update member access')
    }

    const organizationName = normalizeOrg(data.organizationName)
    if (!organizationName) {
      throw new Error('Organization name is required')
    }

    if (accessControl.organizationName && normalizeOrg(accessControl.organizationName) !== organizationName) {
      throw new Error('You can only update members in your organization')
    }

    const member = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.userId, data.userId), eq(organizationMembers.organizationName, organizationName)))
      .limit(1)

    if (!member[0]) {
      throw new Error('Member not found')
    }

    const updated = await db
      .update(organizationMembers)
      .set({
        canManageMembers: data.canManageMembers,
        canRequestFunds: data.canRequestFunds,
        canManageTickets: data.canManageTickets,
        canAccessStorage: data.canAccessStorage,
      })
      .where(eq(organizationMembers.id, member[0].id))
      .returning({ id: organizationMembers.id })

    return updated[0]
  })