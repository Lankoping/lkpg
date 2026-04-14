'use server'
import { createServerFn } from '@tanstack/react-start'
import { getDb } from '../db/runtime'
import { users, loginTwoFactorCodes } from '../db/schema'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { setCookie, getCookie, deleteCookie } from '@tanstack/react-start/server'
import { createHash, randomInt } from 'node:crypto'
import { isDemoTesterUser } from '../lib/access'
import { hashPassword, isHashedPassword, verifyPassword } from '../lib/password'
import { TWO_FACTOR_RESEND_COOLDOWN_MS, TWO_FACTOR_TTL_MS, hashTwoFactorCode, maskEmail } from '../lib/auth-helpers'
import { sendTwoFactorCodeEmail } from '../lib/auth-mail'
import { writeActivityLog } from './logs'

export const loginFn = createServerFn({ method: 'POST' })
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

    if (!isHashedPassword(user[0].passwordHash)) {
      await db
        .update(users)
        .set({ passwordHash: hashPassword(data.passwordHash) })
        .where(eq(users.id, user[0].id))
    }

    setCookie('session', user[0].id.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
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

export const logoutFn = createServerFn({ method: 'POST' })
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

export const getSessionFn = createServerFn({ method: 'GET' }).handler(async () => {
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
