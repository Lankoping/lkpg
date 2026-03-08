'use server'
import { createServerFn } from '@tanstack/react-start'
import { db } from '../db/index'
import { users } from '../db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { setCookie, getCookie, deleteCookie } from '@tanstack/react-start/server'

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ email: z.string(), passwordHash: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const user = await db.select().from(users).where(eq(users.email, data.email)).limit(1)
    if (!user || user.length === 0) {
      throw new Error('User not found')
    }

    if (user[0].role !== 'admin') {
      throw new Error('Account type not allowed')
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

    return { success: true, user: user[0] }
  })

export const logoutFn = createServerFn({ method: "POST" })
  .handler(async () => {
    deleteCookie('session', { path: '/' })
    return { success: true }
  })

export const getSessionFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const userId = getCookie('session')
    if (!userId) return null

    const user = await db.select().from(users).where(eq(users.id, parseInt(userId))).limit(1)
    if (!user[0] || user[0].role !== 'admin') return null
    return user[0]
  })

export const getUsersFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const currentUserId = getCookie('session')
    if (!currentUserId) {
      throw new Error('Unauthorized')
    }

    const currentUser = await db
      .select()
      .from(users)
      .where(eq(users.id, parseInt(currentUserId)))
      .limit(1)

    if (!currentUser[0] || currentUser[0].role !== 'admin') {
      throw new Error('Forbidden')
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
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUserId = getCookie('session')
    if (!currentUserId) {
      throw new Error('Unauthorized')
    }

    const currentUser = await db
      .select()
      .from(users)
      .where(eq(users.id, parseInt(currentUserId)))
      .limit(1)

    if (!currentUser[0] || currentUser[0].role !== 'admin') {
      throw new Error('Forbidden')
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
        role: 'admin',
        active: true,
      })
      .returning()

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
    const currentUserId = getCookie('session')
    if (!currentUserId) {
      throw new Error('Unauthorized')
    }

    const currentUser = await db
      .select()
      .from(users)
      .where(eq(users.id, parseInt(currentUserId)))
      .limit(1)

    if (!currentUser[0] || currentUser[0].role !== 'admin') {
      throw new Error('Forbidden')
    }

    const targetUser = await db
      .select()
      .from(users)
      .where(eq(users.id, data.userId))
      .limit(1)

    if (targetUser[0] && targetUser[0].role === 'admin' && currentUser[0].id !== targetUser[0].id) {
      throw new Error('Forbidden: Cannot change other admin passwords')
    }

    await db
      .update(users)
      .set({ passwordHash: data.newPassword })
      .where(eq(users.id, data.userId))

    return { success: true }
  })

export const deleteUserFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      userId: z.number(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const currentUserId = getCookie('session')
    if (!currentUserId) {
      throw new Error('Unauthorized')
    }

    const currentUser = await db
      .select()
      .from(users)
      .where(eq(users.id, parseInt(currentUserId)))
      .limit(1)

    if (!currentUser[0] || currentUser[0].role !== 'admin') {
      throw new Error('Forbidden')
    }

    if (currentUser[0].id === data.userId) {
      throw new Error('Forbidden: Cannot delete yourself')
    }

    await db
      .delete(users)
      .where(eq(users.id, data.userId))

    return { success: true }
  })

