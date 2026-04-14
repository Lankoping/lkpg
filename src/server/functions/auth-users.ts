'use server'
import { createServerFn } from '@tanstack/react-start'
import { getDb } from '../db/runtime'
import { users, activityLogs, posts, tickets } from '../db/schema'
import { eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { randomInt, randomUUID } from 'node:crypto'
import {
  enforceDemoOwnUserScope,
  getDemoAccountEmails,
  isDemoTesterUser,
  requireOrganizerUser,
  requireStaffUser,
} from '../lib/access'
import { hashPassword } from '../lib/password'
import { sendAdminPasswordResetEmail } from '../lib/auth-mail'
import { writeActivityLog } from './logs'

export const getUsersFn = createServerFn({ method: 'GET' }).handler(async () => {
  const currentUser = await requireOrganizerUser()
  const db = await getDb()

  if (isDemoTesterUser(currentUser)) {
    return [currentUser]
  }

  return await db.select().from(users)
})

export const createUserFn = createServerFn({ method: 'POST' })
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

export const changePasswordFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        userId: z.number(),
        newPassword: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireStaffUser()
    const db = await getDb()

    enforceDemoOwnUserScope(currentUser, data.userId)

    const targetUser = await db.select().from(users).where(eq(users.id, data.userId)).limit(1)

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
    z
      .object({
        userId: z.number(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireOrganizerUser()
    const db = await getDb()

    if (isDemoTesterUser(currentUser)) {
      throw new Error('Forbidden in demo mode')
    }

    const targetUser = await db.select().from(users).where(eq(users.id, data.userId)).limit(1)

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

export const deleteUserFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        userId: z.number(),
      })
      .parse(data),
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

    const targetUser = await db.select().from(users).where(eq(users.id, data.userId)).limit(1)

    if (!targetUser[0]) {
      throw new Error('User not found')
    }

    await db.update(posts).set({ authorId: null }).where(eq(posts.authorId, data.userId))
    await db.update(tickets).set({ issuedBy: null }).where(eq(tickets.issuedBy, data.userId))
    await db.update(tickets).set({ scannedBy: null }).where(eq(tickets.scannedBy, data.userId))
    await db.delete(activityLogs).where(eq(activityLogs.actorUserId, data.userId))
    await db.delete(users).where(eq(users.id, data.userId))

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

export const lockUserFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        userId: z.number(),
      })
      .parse(data),
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
    z
      .object({
        name: z.string().min(1).max(120),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireStaffUser()
    const db = await getDb()
    const updated = await db.update(users).set({ name: data.name }).where(eq(users.id, currentUser.id)).returning()

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
    z
      .object({
        userId: z.number(),
        name: z.string().min(1).max(120),
        role: z.enum(['organizer', 'volunteer']),
        active: z.boolean(),
      })
      .parse(data),
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

export const getDemoAccountsFn = createServerFn({ method: 'GET' }).handler(async () => {
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

    const updated = await db.update(users).set({ active: data.active }).where(inArray(users.email, demoEmails)).returning()

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
