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
        createdAt: organizationMembers.createdAt,
      })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, currentUser.id))
      .orderBy(desc(organizationMembers.createdAt))

    if (memberships.length === 0) {
      return defaultHostedAccessControl
    }

    const candidates = await Promise.all(
      memberships.map(async (membership) => {
        const organizationName = normalizeOrg(membership.organizationName)
        const latestApplication = await db
          .select({ status: foundaryApplications.status, createdAt: foundaryApplications.createdAt })
          .from(foundaryApplications)
          .where(eq(foundaryApplications.organizationName, organizationName))
          .orderBy(desc(foundaryApplications.createdAt))
          .limit(1)

        return {
          membership,
          organizationName,
          applicationStatus: latestApplication[0]?.status ?? 'none',
          applicationCreatedAt: latestApplication[0]?.createdAt ?? null,
        }
      }),
    )

    const selected =
      candidates
        .filter((entry) => entry.applicationCreatedAt)
        .sort((a, b) => b.applicationCreatedAt!.getTime() - a.applicationCreatedAt!.getTime())[0] ?? candidates[0]

    return {
      organizationName: selected.organizationName,
      organizationState: {
        status: selected.applicationStatus,
      },
      permissions: {
        canManageMembers: selected.membership.canManageMembers,
        canRequestFunds: selected.membership.canRequestFunds,
        canManageTickets: selected.membership.canManageTickets,
        canAccessStorage: selected.membership.canAccessStorage,
      },
    }
  } catch (error) {
    if (!isMissingAccessControlColumnsError(error)) {
      throw error
    }

    const memberships = await db
      .select({ organizationName: organizationMembers.organizationName, createdAt: organizationMembers.createdAt })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, currentUser.id))
      .orderBy(desc(organizationMembers.createdAt))

    if (memberships.length === 0) {
      return defaultHostedAccessControl
    }

    const candidates = await Promise.all(
      memberships.map(async (membership) => {
        const organizationName = normalizeOrg(membership.organizationName)
        const latestApplication = await db
          .select({ status: foundaryApplications.status, createdAt: foundaryApplications.createdAt })
          .from(foundaryApplications)
          .where(eq(foundaryApplications.organizationName, organizationName))
          .orderBy(desc(foundaryApplications.createdAt))
          .limit(1)

        return {
          organizationName,
          applicationStatus: latestApplication[0]?.status ?? 'none',
          applicationCreatedAt: latestApplication[0]?.createdAt ?? null,
        }
      }),
    )

    const selected =
      candidates
        .filter((entry) => entry.applicationCreatedAt)
        .sort((a, b) => b.applicationCreatedAt!.getTime() - a.applicationCreatedAt!.getTime())[0] ?? candidates[0]

    return {
      organizationName: selected.organizationName,
      organizationState: {
        status: selected.applicationStatus,
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

    const ownerMembership = await db
      .select({ userId: organizationMembers.userId })
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationName, organizationName))
      .orderBy(organizationMembers.createdAt)
      .limit(1)

    if (ownerMembership[0] && ownerMembership[0].userId === data.userId) {
      throw new Error('Owner access cannot be modified')
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