'use server'
import { createServerFn } from '@tanstack/react-start'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/index'
import { activityLogs, users } from '../db/schema'
import { requireOrganizerUser } from '../lib/access'

export type ActivityLogInput = {
  actorUserId: number
  actorRole: 'organizer' | 'volunteer'
  action: string
  entityType: string
  entityId?: number | null
  details?: Record<string, unknown>
}

export async function writeActivityLog(input: ActivityLogInput) {
  try {
    await db.insert(activityLogs).values({
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      details: input.details ? JSON.stringify(input.details) : null,
    })
  } catch (error) {
    console.error('Failed to write activity log', error)
  }
}

export const getActivityLogsFn = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) =>
    z
      .object({
        limit: z.number().min(1).max(1000).default(200),
      })
      .default({ limit: 200 })
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    await requireOrganizerUser()

    const rows = await db
      .select({
        id: activityLogs.id,
        action: activityLogs.action,
        entityType: activityLogs.entityType,
        entityId: activityLogs.entityId,
        actorUserId: activityLogs.actorUserId,
        actorRole: activityLogs.actorRole,
        details: activityLogs.details,
        createdAt: activityLogs.createdAt,
        actorName: users.name,
        actorEmail: users.email,
      })
      .from(activityLogs)
      .leftJoin(users, eq(activityLogs.actorUserId, users.id))
      .orderBy(desc(activityLogs.createdAt))
      .limit(data.limit)

    return rows
  })
