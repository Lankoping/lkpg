import { getCookie } from '@tanstack/react-start/server'
import { eq } from 'drizzle-orm'
import { getDb } from '../db/runtime'
import { users } from '../db/schema'

export type StaffRole = 'organizer' | 'volunteer'
export const DEMO_TESTER_EMAIL = (process.env.DEMO_TESTER_EMAIL ?? 'tester@lankoping.se').trim().toLowerCase()
export const DEMO_TESTER_PASSWORD = process.env.DEMO_TESTER_PASSWORD ?? 'TesterDemo2026!'
export const DEMO_TESTER_NAME = process.env.DEMO_TESTER_NAME ?? 'Tester'
const AUTH_LOOKUP_TIMEOUT_MS = Number(process.env.AUTH_LOOKUP_TIMEOUT_MS || 45000)

async function withAuthTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`${label} timed out after ${AUTH_LOOKUP_TIMEOUT_MS}ms`))
      }, AUTH_LOOKUP_TIMEOUT_MS)
    })

    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
    }
  }
}

export function getDemoAccountEmails() {
  const raw = process.env.DEMO_ACCOUNT_EMAILS
  if (!raw || !raw.trim()) {
    return [DEMO_TESTER_EMAIL]
  }

  const emails = raw
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)

  if (!emails.includes(DEMO_TESTER_EMAIL)) {
    emails.push(DEMO_TESTER_EMAIL)
  }

  return Array.from(new Set(emails))
}

export function isOrganizer(role: string | null | undefined): role is 'organizer' {
  return role === 'organizer'
}

export function isDemoTesterUser(user: { id: number; email: string | null; role: string | null } | null | undefined) {
  if (!user) return false
  return user.role === 'organizer' && getDemoAccountEmails().includes((user.email ?? '').trim().toLowerCase())
}

export function enforceDemoOwnUserScope(
  currentUser: { id: number; email: string | null; role: string | null },
  targetUserId: number | null | undefined,
) {
  if (!isDemoTesterUser(currentUser)) {
    return
  }

  if (targetUserId != null && targetUserId !== currentUser.id) {
    throw new Error('Forbidden in demo mode')
  }
}

export function scopeSignerIdsForUser(
  currentUser: { id: number; email: string | null; role: string | null },
  signerIds: number[],
) {
  if (isDemoTesterUser(currentUser)) {
    return [currentUser.id]
  }

  return Array.from(new Set(signerIds))
}

export async function ensureDemoTesterUser() {
  const db = await getDb()
  const existing = await db.select().from(users).where(eq(users.email, DEMO_TESTER_EMAIL)).limit(1)
  return existing[0] ?? null
}

export async function requireStaffUser() {
  const userId = getCookie('session')
  if (!userId) {
    throw new Error('Unauthorized')
  }

  const parsedUserId = Number.parseInt(userId, 10)
  const db = await withAuthTimeout(getDb(), 'Auth DB connection')
  const result = await withAuthTimeout(
    db.select().from(users).where(eq(users.id, parsedUserId)).limit(1),
    'Auth user lookup',
  )
  const user = result[0]
  if (!user || user.active === false || (user.role !== 'organizer' && user.role !== 'volunteer')) {
    throw new Error('Forbidden')
  }

  return user
}

export async function requireOrganizerUser() {
  const user = await requireStaffUser()
  if (user.role !== 'organizer') {
    throw new Error('Forbidden')
  }
  return user
}