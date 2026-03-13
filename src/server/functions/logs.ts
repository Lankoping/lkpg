'use server'
import { createServerFn } from '@tanstack/react-start'
import { desc, eq } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '../db/runtime'
import { activityLogs, users } from '../db/schema'
import { isDemoTesterUser, requireOrganizerUser } from '../lib/access'

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
    const db = await getDb()
    await ensureActivityLogsTable()

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
    const currentUser = await requireOrganizerUser()

    try {
      const rows = await queryActivityLogs(data.limit, isDemoTesterUser(currentUser) ? currentUser.id : null)

      return rows
    } catch (error) {
      if (isMissingActivityLogsTableError(error)) {
        try {
          await ensureActivityLogsTable()
          return await queryActivityLogs(data.limit, isDemoTesterUser(currentUser) ? currentUser.id : null)
        } catch (retryError) {
          if (isMissingActivityLogsTableError(retryError)) {
            return []
          }
          throw retryError
        }
      }
      throw error
    }
  })

async function queryActivityLogs(limit: number, actorUserId: number | null) {
  const db = await getDb()
  const baseQuery = db
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

  if (actorUserId != null) {
    return await baseQuery
      .where(eq(activityLogs.actorUserId, actorUserId))
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit)
  }

  return await baseQuery
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit)
}

let ensurePromise: Promise<void> | null = null

async function ensureActivityLogsTable() {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      const db = await getDb()
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "activity_logs" (
          "id" serial PRIMARY KEY NOT NULL,
          "actor_user_id" integer NOT NULL,
          "actor_role" text NOT NULL,
          "action" text NOT NULL,
          "entity_type" text NOT NULL,
          "entity_id" integer,
          "details" text,
          "created_at" timestamp DEFAULT now() NOT NULL
        );
      `)

      await db.execute(sql`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'activity_logs_actor_user_id_users_id_fk'
          ) THEN
            ALTER TABLE "activity_logs"
            ADD CONSTRAINT "activity_logs_actor_user_id_users_id_fk"
            FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id")
            ON DELETE no action ON UPDATE no action;
          END IF;
        END $$;
      `)
    })().finally(() => {
      ensurePromise = null
    })
  }

  await ensurePromise
}

function isMissingActivityLogsTableError(error: unknown) {
  const pgCode = findPgCode(error)
  if (pgCode === '42P01') return true

  const messages = findMessages(error)
  return messages.some((message) => {
    const m = message.toLowerCase()
    return m.includes('activity_logs') && (m.includes('does not exist') || m.includes('relation'))
  })
}

function findPgCode(error: unknown): string | null {
  let cursor: unknown = error
  for (let i = 0; i < 6 && cursor && typeof cursor === 'object'; i += 1) {
    const maybeCode = (cursor as { code?: unknown }).code
    if (typeof maybeCode === 'string') return maybeCode
    cursor = (cursor as { cause?: unknown }).cause
  }
  return null
}

function findMessages(error: unknown): string[] {
  const messages: string[] = []
  let cursor: unknown = error
  for (let i = 0; i < 6 && cursor && typeof cursor === 'object'; i += 1) {
    const maybeMessage = (cursor as { message?: unknown }).message
    if (typeof maybeMessage === 'string') {
      messages.push(maybeMessage)
    }
    cursor = (cursor as { cause?: unknown }).cause
  }
  return messages
}
