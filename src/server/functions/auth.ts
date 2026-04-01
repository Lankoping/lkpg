'use server'
import { createServerFn } from '@tanstack/react-start'
import { getDb } from '../db/runtime'
import { users, activityLogs, posts, tickets, stadgar, avgangsRequests, agreements } from '../db/schema'
import { eq, inArray, or } from 'drizzle-orm'
import { z } from 'zod'
import { setCookie, getCookie, deleteCookie } from '@tanstack/react-start/server'
import {
  ensureDemoTesterUser,
  enforceDemoOwnUserScope,
  getDemoAccountEmails,
  isDemoTesterUser,
  requireOrganizerUser,
  requireStaffUser,
} from '../lib/access'
import { writeActivityLog } from './logs'

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ email: z.string(), passwordHash: z.string() }).parse(data))
  .handler(async ({ data }) => {
    await ensureDemoTesterUser()
    const db = await getDb()

    const user = await db.select().from(users).where(eq(users.email, data.email)).limit(1)
    if (!user || user.length === 0) {
      throw new Error('User not found')
    }

    if (user[0].role !== 'organizer' && user[0].role !== 'volunteer') {
      throw new Error('Account type not allowed')
    }

    if (user[0].active === false) {
      throw new Error('Account is locked')
    }

    if (user[0].passwordHash !== data.passwordHash) {
      throw new Error('Invalid password') 
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
      details: { email: user[0].email },
    })

    return { success: true, user: user[0] }
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
        passwordHash: data.password,
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
      .set({ passwordHash: data.newPassword })
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

    // Stadgar updated by this user
    await db.update(stadgar).set({ updatedBy: null }).where(eq(stadgar.updatedBy, data.userId))

    // AvgangsRequests referencing this user
    await db.update(avgangsRequests).set({ reviewedBy: null }).where(eq(avgangsRequests.reviewedBy, data.userId))
    await db.update(avgangsRequests).set({ createdByUserId: null }).where(eq(avgangsRequests.createdByUserId, data.userId))
    await db.update(avgangsRequests).set({ targetUserId: null }).where(eq(avgangsRequests.targetUserId, data.userId))
    await db.update(avgangsRequests).set({ generatedBy: null }).where(eq(avgangsRequests.generatedBy, data.userId))

    // Agreements referencing this user
    await db.update(agreements).set({ createdByUserId: null }).where(eq(agreements.createdByUserId, data.userId))
    await db.update(agreements).set({ generatedBy: null }).where(eq(agreements.generatedBy, data.userId))

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
    await ensureDemoTesterUser()
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
    await ensureDemoTesterUser()
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
