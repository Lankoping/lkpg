'use server'
import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq, gt, inArray, or, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { z } from 'zod'
import { getDb } from '../db/runtime'
import {
  foundaryApplications,
  organizationInvitations,
  organizationMembers,
  storageFiles,
  storagePerkRequests,
  storageUploadReservations,
  users,
} from '../db/schema'
import { requireOrganizerUser, requireStaffUser } from '../lib/access'
import {
  getStorageClient,
  getStorageConfig,
  logStorageError,
  getStoragePublicUrl,
  getStorageUpstreamErrorMessage,
  isStorageMissingObjectError,
} from '../lib/s3-compatible'
import { writeActivityLog } from './logs'

export const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024 * 1024
const STORAGE_UPLOAD_RESERVATION_TTL_MS = 15 * 60 * 1000
const STORAGE_UPSTREAM_TIMEOUT_MS = Number(process.env.STORAGE_UPSTREAM_TIMEOUT_MS || 20000)
const STORAGE_PAGE_LOAD_TIMEOUT_MS = Number(process.env.STORAGE_PAGE_LOAD_TIMEOUT_MS || 45000)
const STORAGE_AUTO_SCHEMA_SYNC = (process.env.STORAGE_AUTO_SCHEMA_SYNC ?? '').trim().toLowerCase() === 'true'
const DEFAULT_BLOCKED_STORAGE_FILE_REGEX =
  /(?:^\.|\.(?:env|htaccess|htpasswd|pem|key)$)|(?:\.(?:ade|adp|app|apk|bat|bin|cmd|com|cpl|dll|dmg|exe|hta|ins|iso|jar|js|jse|lib|lnk|mde|msc|msi|msp|mst|pif|ps1|reg|scr|sct|sh|sys|vb|vbe|vbs|vxd|wsc|wsf|wsh|php|phar|phtml|cgi|pl|py|rb))$/i

let storageSchemaSyncNoticeShown = false

let ensureStorageTablesPromise: Promise<void> | null = null
type StorageDb = Awaited<ReturnType<typeof getDb>>
type StorageDbLike = Pick<StorageDb, 'select' | 'delete' | 'insert' | 'update' | 'execute'>

function normalizeOrg(value: string) {
  return value.trim()
}

function slugifyOrg(value: string) {
  return normalizeOrg(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function sanitizeFileName(value: string) {
  const trimmed = value.trim().replace(/[/\\]+/g, '_').replace(/\s+/g, ' ')
  const safe = trimmed.replace(/[^a-zA-Z0-9._()-]+/g, '_').replace(/^\.+/, '')
  return safe || 'upload'
}

function getBlockedStorageFileRegex() {
  const configuredPattern = (process.env.STORAGE_BLOCKED_FILE_REGEX ?? '').trim()
  if (!configuredPattern) {
    return DEFAULT_BLOCKED_STORAGE_FILE_REGEX
  }

  try {
    return new RegExp(configuredPattern, 'i')
  } catch (error) {
    console.warn('[storage] invalid STORAGE_BLOCKED_FILE_REGEX, using default pattern', {
      configuredPattern,
      error,
    })
    return DEFAULT_BLOCKED_STORAGE_FILE_REGEX
  }
}

function isBlockedStorageFileName(fileName: string) {
  const cleanName = sanitizeFileName(fileName)
  return getBlockedStorageFileRegex().test(cleanName)
}

function buildObjectKey(organizationName: string, fileName: string) {
  const prefix = slugifyOrg(organizationName) || 'organization'
  return `${prefix}/${Date.now()}-${randomUUID()}-${sanitizeFileName(fileName)}`
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`${label} timed out after ${timeoutMs}ms`))
      }, timeoutMs)
    })

    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
    }
  }
}

function getPublicUrl(objectKey: string) {
  return getStoragePublicUrl(objectKey)
}

async function ensureStorageTables() {
  if (!STORAGE_AUTO_SCHEMA_SYNC) {
    if (!storageSchemaSyncNoticeShown) {
      console.log('[storage] runtime schema sync disabled (set STORAGE_AUTO_SCHEMA_SYNC=true to enable)')
      storageSchemaSyncNoticeShown = true
    }
    return
  }

  if (!ensureStorageTablesPromise) {
    ensureStorageTablesPromise = (async () => {
      const db = await withTimeout(
        getDb(),
        STORAGE_PAGE_LOAD_TIMEOUT_MS,
        'Storage database connection (schema sync)',
      )

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "storage_perk_requests" (
          "id" serial PRIMARY KEY NOT NULL,
          "organization_name" text NOT NULL,
          "requested_by_user_id" integer NOT NULL,
          "reason" text NOT NULL,
          "status" text DEFAULT 'pending' NOT NULL,
          "review_notes" text,
          "reviewed_by" integer,
          "reviewed_at" timestamp,
          "approved_at" timestamp,
          "terms_accepted_at" timestamp,
          "terms_accepted_by_user_id" integer,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        );
      `)

      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "storage_perk_requests_organization_name_unique"
        ON "storage_perk_requests" ("organization_name");
      `)

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "storage_upload_reservations" (
          "id" serial PRIMARY KEY NOT NULL,
          "organization_name" text NOT NULL,
          "requested_by_user_id" integer NOT NULL,
          "file_name" text NOT NULL,
          "content_type" text,
          "object_key" text NOT NULL,
          "size_bytes" bigint NOT NULL,
          "expires_at" timestamp NOT NULL,
          "created_at" timestamp DEFAULT now() NOT NULL
        );
      `)

      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "storage_upload_reservations_object_key_unique"
        ON "storage_upload_reservations" ("object_key");
      `)

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "storage_files" (
          "id" serial PRIMARY KEY NOT NULL,
          "organization_name" text NOT NULL,
          "uploaded_by_user_id" integer NOT NULL,
          "file_name" text NOT NULL,
          "content_type" text,
          "object_key" text NOT NULL,
          "size_bytes" bigint NOT NULL,
          "created_at" timestamp DEFAULT now() NOT NULL
        );
      `)

      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "storage_files_object_key_unique"
        ON "storage_files" ("object_key");
      `)

      await db.execute(sql`
        ALTER TABLE "storage_perk_requests"
        ADD COLUMN IF NOT EXISTS "terms_accepted_at" timestamp,
        ADD COLUMN IF NOT EXISTS "terms_accepted_by_user_id" integer;
      `)
    })().finally(() => {
      ensureStorageTablesPromise = null
    })
  }

  await ensureStorageTablesPromise
}

function formatDuration(ms: number) {
  const totalMinutes = Math.max(1, Math.round(ms / 60000))
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) {
    if (hours > 0) {
      return `${days} day${days === 1 ? '' : 's'} ${hours} hour${hours === 1 ? '' : 's'}`
    }

    return `${days} day${days === 1 ? '' : 's'}`
  }

  if (hours > 0) {
    if (minutes > 0) {
      return `${hours} hour${hours === 1 ? '' : 's'} ${minutes} minute${minutes === 1 ? '' : 's'}`
    }

    return `${hours} hour${hours === 1 ? '' : 's'}`
  }

  return `${minutes} minute${minutes === 1 ? '' : 's'}`
}

async function getStorageReviewEtaStats() {
  await ensureStorageTables()
  const db = await getDb()

  const rows = await db
    .select({
      createdAt: storagePerkRequests.createdAt,
      reviewedAt: storagePerkRequests.reviewedAt,
    })
    .from(storagePerkRequests)
    .where(and(sql`${storagePerkRequests.createdAt} IS NOT NULL`, sql`${storagePerkRequests.reviewedAt} IS NOT NULL`))
    .orderBy(desc(storagePerkRequests.reviewedAt))
    .limit(100)

  const durations = rows
    .map((row) => {
      if (!row.createdAt || !row.reviewedAt) {
        return null
      }

      const duration = row.reviewedAt.getTime() - row.createdAt.getTime()
      return duration > 0 ? duration : null
    })
    .filter((duration): duration is number => duration !== null)

  if (durations.length === 0) {
    return {
      sampleCount: 0,
      estimatedDurationMs: null,
      etaText: '3-5 business days',
    }
  }

  const sorted = [...durations].sort((left, right) => left - right)
  const totalDuration = durations.reduce((sum, duration) => sum + duration, 0)
  const averageDuration = totalDuration / durations.length
  const medianDuration =
    sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)]
  const fastestDuration = sorted[0]
  const slowestDuration = sorted[sorted.length - 1]

  return {
    sampleCount: durations.length,
    estimatedDurationMs: Math.round(medianDuration),
    etaText: `about ${formatDuration(medianDuration)} based on ${durations.length} previous review${durations.length === 1 ? '' : 's'} (avg ${formatDuration(averageDuration)}, range ${formatDuration(fastestDuration)}-${formatDuration(slowestDuration)})`,
  }
}

async function sendStorageReviewEmail({
  to,
  organizationName,
  decision,
  notes,
}: {
  to: string
  organizationName: string
  decision: 'approved' | 'rejected'
  notes?: string | null
}) {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    throw new Error('SMTP configuration missing: set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS')
  }

  const nodemailer = await import('nodemailer')
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })

  const hostedBaseUrl = (process.env.baseurl || process.env.BASEURL || process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
  const storagePageUrl = `${/^https?:\/\//i.test(hostedBaseUrl) ? hostedBaseUrl : `https://${hostedBaseUrl}`}/hosted/perks`

  if (decision === 'approved') {
    const text = [
      `Your storage perk request for ${organizationName} was approved.`,
      '',
      'Next steps:',
      '1. Go to the Hosted portal Storage page.',
      '2. Press Activate storage.',
      '3. Scroll through the Storage terms and accept them.',
      '',
      storagePageUrl,
      '',
      notes ? `Review notes: ${notes}` : '',
    ].filter(Boolean).join('\n')

    const html = `
      <p>Your storage perk request for <strong>${organizationName}</strong> was approved.</p>
      <p><strong>Next steps:</strong></p>
      <ol>
        <li>Go to the Hosted portal Storage page.</li>
        <li>Press <strong>Activate storage</strong>.</li>
        <li>Scroll through the Storage terms and accept them.</li>
      </ol>
      <p><a href="${storagePageUrl}">${storagePageUrl}</a></p>
      ${notes ? `<p><strong>Review notes:</strong> ${notes}</p>` : ''}
    `

    await transporter.sendMail({
      from: 'foundary@lankoping.se',
      to,
      subject: 'Lan Foundary storage approved',
      text,
      html,
    })
    return
  }

  const text = [
    `Your storage perk request for ${organizationName} was rejected.`,
    '',
    notes ? `Review notes: ${notes}` : 'No review notes were provided.',
  ].join('\n')

  const html = `
    <p>Your storage perk request for <strong>${organizationName}</strong> was rejected.</p>
    <p>${notes ? `<strong>Review notes:</strong> ${notes}` : 'No review notes were provided.'}</p>
  `

  await transporter.sendMail({
    from: 'foundary@lankoping.se',
    to,
    subject: 'Lan Foundary storage review update',
    text,
    html,
  })
}

async function sendStorageRequestReceivedEmail({
  to,
  organizationName,
}: {
  to: string
  organizationName: string
}) {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    throw new Error('SMTP configuration missing: set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS')
  }

  const nodemailer = await import('nodemailer')
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })

  const etaStats = await getStorageReviewEtaStats()

  const text = [
    `We have received your request and will review it soon.`,
    `ETA based on other reviews: ${etaStats.etaText}`,
    '',
    `Organization: ${organizationName}`,
  ].join('\n')

  const html = `
    <p>We have received your request and will review it soon.</p>
    <p><strong>ETA based on other reviews:</strong> ${etaStats.etaText}</p>
    <p><strong>Organization:</strong> ${organizationName}</p>
  `

  await transporter.sendMail({
    from: 'foundary@lankoping.se',
    to,
    subject: 'Lan Foundary storage request received',
    text,
    html,
  })
}

async function getPrimaryOrganizationNameForUser(user: { id: number; email: string | null }) {
  const db = await getDb()
  const normalizedEmail = (user.email ?? '').trim().toLowerCase()

  const memberships = await db
    .select({ organizationName: organizationMembers.organizationName })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, user.id))
    .orderBy(organizationMembers.createdAt)

  const normalizedMemberships = Array.from(new Set(memberships.map((row) => normalizeOrg(row.organizationName)).filter(Boolean)))
  if (normalizedMemberships.length > 0) {
    return normalizedMemberships[0]
  }

  const acceptedInvites = await db
    .select({ organizationName: organizationInvitations.organizationName })
    .from(organizationInvitations)
    .where(
      and(
        sql`${organizationInvitations.acceptedAt} IS NOT NULL`,
        or(
          eq(organizationInvitations.acceptedBy, user.id),
          normalizedEmail ? sql`lower(${organizationInvitations.email}) = ${normalizedEmail}` : sql`false`,
        ),
      ),
    )
    .orderBy(organizationInvitations.createdAt)

  const acceptedInviteNames = Array.from(new Set(acceptedInvites.map((row) => normalizeOrg(row.organizationName)).filter(Boolean)))
  if (acceptedInviteNames.length > 0) {
    for (const organizationName of acceptedInviteNames) {
      const existing = await db
        .select({ id: organizationMembers.id })
        .from(organizationMembers)
        .where(and(eq(organizationMembers.userId, user.id), eq(organizationMembers.organizationName, organizationName)))
        .limit(1)

      if (!existing[0]) {
        await db.insert(organizationMembers).values({
          userId: user.id,
          organizationName,
          addedBy: user.id,
        })
      }
    }

    return acceptedInviteNames[0]
  }

  const legacyApplications = await db
    .select({ organizationName: foundaryApplications.organizationName })
    .from(foundaryApplications)
    .where(normalizedEmail ? sql`lower(${foundaryApplications.email}) = ${normalizedEmail}` : sql`false`)
    .orderBy(desc(foundaryApplications.createdAt))

  const legacyNames = Array.from(new Set(legacyApplications.map((row) => normalizeOrg(row.organizationName)).filter(Boolean)))
  if (legacyNames.length === 0) {
    return null
  }

  for (const organizationName of legacyNames) {
    const existing = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.userId, user.id), eq(organizationMembers.organizationName, organizationName)))
      .limit(1)

    if (!existing[0]) {
      await db.insert(organizationMembers).values({
        userId: user.id,
        organizationName,
        addedBy: user.id,
      })
    }
  }

  return legacyNames[0] ?? null
}

async function requireStorageOrgAccess(user: { id: number; email: string | null }, organizationName: string) {
  const db = await getDb()

  try {
    const membership = await db
      .select({
        id: organizationMembers.id,
        canAccessStorage: organizationMembers.canAccessStorage,
      })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.userId, user.id), eq(organizationMembers.organizationName, organizationName)))
      .limit(1)

    if (!membership[0]) {
      throw new Error('You can only use storage for organizations you belong to')
    }

    if (!membership[0].canAccessStorage) {
      throw new Error('You do not have storage access for this organization')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : ''
    if (!message.includes('can_access_storage')) {
      throw error
    }

    const legacyMembership = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.userId, user.id), eq(organizationMembers.organizationName, organizationName)))
      .limit(1)

    if (!legacyMembership[0]) {
      throw new Error('You can only use storage for organizations you belong to')
    }
  }
}

async function fetchUserNames(userIds: number[]) {
  if (userIds.length === 0) {
    return new Map<number, { name: string | null; email: string | null }>()
  }

  const db = await getDb()
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(inArray(users.id, Array.from(new Set(userIds))))

  return new Map(rows.map((row) => [row.id, { name: row.name, email: row.email }]))
}

async function getStorageRequestForOrganization(organizationName: string, dbLike: StorageDbLike | null = null) {
  await ensureStorageTables()
  const db = dbLike ?? (await getDb())
  const rows = await db
    .select({
      id: storagePerkRequests.id,
      organizationName: storagePerkRequests.organizationName,
      requestedByUserId: storagePerkRequests.requestedByUserId,
      reason: storagePerkRequests.reason,
      status: storagePerkRequests.status,
      reviewNotes: storagePerkRequests.reviewNotes,
      reviewedBy: storagePerkRequests.reviewedBy,
      reviewedAt: storagePerkRequests.reviewedAt,
      approvedAt: storagePerkRequests.approvedAt,
      termsAcceptedAt: storagePerkRequests.termsAcceptedAt,
      termsAcceptedByUserId: storagePerkRequests.termsAcceptedByUserId,
      createdAt: storagePerkRequests.createdAt,
      updatedAt: storagePerkRequests.updatedAt,
    })
    .from(storagePerkRequests)
    .where(eq(storagePerkRequests.organizationName, organizationName))
    .limit(1)

  const request = rows[0]
  if (!request) {
    return null
  }

  const names = await fetchUserNames([request.requestedByUserId, request.reviewedBy ?? 0])
  return {
    ...request,
    requestedByName: names.get(request.requestedByUserId)?.name ?? null,
    requestedByEmail: names.get(request.requestedByUserId)?.email ?? null,
    reviewedByName: request.reviewedBy ? names.get(request.reviewedBy)?.name ?? null : null,
  }
}

async function getStorageUsageSummary(organizationName: string, dbLike: StorageDbLike | null = null) {
  await ensureStorageTables()
  const db = dbLike ?? (await getDb())
  const now = new Date()

  const fileAggregate = await db
    .select({
      fileCount: sql<number>`coalesce(count(${storageFiles.id}), 0)`,
      usedBytes: sql<number>`coalesce(sum(${storageFiles.sizeBytes}), 0)`,
    })
    .from(storageFiles)
    .where(eq(storageFiles.organizationName, organizationName))

  const reservationAggregate = await db
    .select({
      reservedBytes: sql<number>`coalesce(sum(${storageUploadReservations.sizeBytes}), 0)`,
    })
    .from(storageUploadReservations)
    .where(and(eq(storageUploadReservations.organizationName, organizationName), gt(storageUploadReservations.expiresAt, now)))

  const fileCount = Number(fileAggregate[0]?.fileCount ?? 0)
  const usedBytes = Number(fileAggregate[0]?.usedBytes ?? 0)
  const reservedBytes = Number(reservationAggregate[0]?.reservedBytes ?? 0)

  return {
    fileCount,
    usedBytes,
    reservedBytes,
    remainingBytes: Math.max(0, STORAGE_LIMIT_BYTES - usedBytes - reservedBytes),
  }
}

async function getStorageFiles(organizationName: string, dbLike: StorageDbLike | null = null) {
  await ensureStorageTables()
  const db = dbLike ?? (await getDb())
  const rows = await db
    .select({
      id: storageFiles.id,
      fileName: storageFiles.fileName,
      contentType: storageFiles.contentType,
      objectKey: storageFiles.objectKey,
      sizeBytes: storageFiles.sizeBytes,
      createdAt: storageFiles.createdAt,
      uploadedByUserId: storageFiles.uploadedByUserId,
    })
    .from(storageFiles)
    .where(eq(storageFiles.organizationName, organizationName))
    .orderBy(desc(storageFiles.createdAt))

  const names = await fetchUserNames(rows.map((row) => row.uploadedByUserId))

  return rows.map((row) => ({
    ...row,
    uploadedByName: names.get(row.uploadedByUserId)?.name ?? null,
    uploadedByEmail: names.get(row.uploadedByUserId)?.email ?? null,
    publicUrl: getPublicUrl(row.objectKey),
  }))
}

async function getRequestList() {
  await ensureStorageTables()
  const db = await getDb()
  const rows = await db
    .select({
      id: storagePerkRequests.id,
      organizationName: storagePerkRequests.organizationName,
      requestedByUserId: storagePerkRequests.requestedByUserId,
      reason: storagePerkRequests.reason,
      status: storagePerkRequests.status,
      reviewNotes: storagePerkRequests.reviewNotes,
      reviewedBy: storagePerkRequests.reviewedBy,
      reviewedAt: storagePerkRequests.reviewedAt,
      approvedAt: storagePerkRequests.approvedAt,
      termsAcceptedAt: storagePerkRequests.termsAcceptedAt,
      termsAcceptedByUserId: storagePerkRequests.termsAcceptedByUserId,
      createdAt: storagePerkRequests.createdAt,
      updatedAt: storagePerkRequests.updatedAt,
    })
    .from(storagePerkRequests)
    .orderBy(desc(storagePerkRequests.createdAt))

  const names = await fetchUserNames(rows.flatMap((row) => [row.requestedByUserId, row.reviewedBy ?? 0]))

  return rows.map((row) => ({
    ...row,
    requestedByName: names.get(row.requestedByUserId)?.name ?? null,
    requestedByEmail: names.get(row.requestedByUserId)?.email ?? null,
    reviewerName: row.reviewedBy ? names.get(row.reviewedBy)?.name ?? null : null,
  }))
}

export const getMyStoragePerkFn = createServerFn({ method: 'GET' }).handler(async () => {
  const currentUser = await requireStaffUser()
  console.log('[s3] getMyStoragePerkFn start', { userId: currentUser.id })

  await withTimeout(ensureStorageTables(), STORAGE_PAGE_LOAD_TIMEOUT_MS, 'Storage table check')
  const organizationName = await withTimeout(
    getPrimaryOrganizationNameForUser(currentUser),
    STORAGE_PAGE_LOAD_TIMEOUT_MS,
    'Primary org lookup',
  )

  if (!organizationName) {
    return {
      organizationName: null,
      request: null,
      fileCount: 0,
      usedBytes: 0,
      reservedBytes: 0,
      remainingBytes: STORAGE_LIMIT_BYTES,
      files: [],
      limitBytes: STORAGE_LIMIT_BYTES,
    }
  }

  const [request, usage, files] = await withTimeout(
    Promise.all([
      getStorageRequestForOrganization(organizationName),
      getStorageUsageSummary(organizationName),
      getStorageFiles(organizationName),
    ]),
    STORAGE_PAGE_LOAD_TIMEOUT_MS,
    'Storage page data load',
  )

  console.log('[s3] getMyStoragePerkFn success', {
    userId: currentUser.id,
    organizationName,
    fileCount: usage.fileCount,
  })

  return {
    organizationName,
    request,
    ...usage,
    files,
    limitBytes: STORAGE_LIMIT_BYTES,
  }
})

export const requestStoragePerkFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => z.object({ reason: z.string().min(10).max(5000) }).parse(data))
  .handler(async ({ data }) => {
    await ensureStorageTables()
    const currentUser = await requireStaffUser()
    const db = await getDb()
    const organizationName = await withTimeout(
      getPrimaryOrganizationNameForUser(currentUser),
      STORAGE_PAGE_LOAD_TIMEOUT_MS,
      'Primary org lookup (request)',
    )

    if (!organizationName) {
      throw new Error('You need an organization before requesting storage')
    }

    await requireStorageOrgAccess(currentUser, organizationName)

    const existing = await getStorageRequestForOrganization(organizationName)
    if (existing?.status === 'approved') {
      throw new Error('Storage has already been approved for this organization')
    }

    const cleanReason = data.reason.trim()
    const now = new Date()

    if (existing) {
      await db
        .update(storagePerkRequests)
        .set({
          requestedByUserId: currentUser.id,
          reason: cleanReason,
          status: 'pending',
          reviewNotes: null,
          reviewedBy: null,
          reviewedAt: null,
          approvedAt: null,
          updatedAt: now,
        })
        .where(eq(storagePerkRequests.id, existing.id))
    } else {
      await db.insert(storagePerkRequests).values({
        organizationName,
        requestedByUserId: currentUser.id,
        reason: cleanReason,
        status: 'pending',
        updatedAt: now,
      })
    }

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'storage.perk.request',
      entityType: 'storage_perk_request',
      details: { organizationName, reasonLength: cleanReason.length },
    })

    if (currentUser.email) {
      try {
        await sendStorageRequestReceivedEmail({
          to: currentUser.email,
          organizationName,
        })
      } catch (error) {
        console.error('Failed to send storage request receipt email', error)
      }
    }

    return { success: true, organizationName }
  })

export const getStoragePerkRequestsFn = createServerFn({ method: 'GET' }).handler(async () => {
  console.log('[storage] getStoragePerkRequestsFn start')

  await withTimeout(ensureStorageTables(), STORAGE_PAGE_LOAD_TIMEOUT_MS, 'Storage table check (admin)')
  console.log('[storage] getStoragePerkRequestsFn schema check complete')

  await withTimeout(requireOrganizerUser(), STORAGE_PAGE_LOAD_TIMEOUT_MS, 'Organizer auth check (admin)')
  console.log('[storage] getStoragePerkRequestsFn organizer auth complete')

  const requests = await withTimeout(
    getRequestList(),
    STORAGE_PAGE_LOAD_TIMEOUT_MS,
    'Storage requests list load (admin)',
  )

  console.log('[storage] getStoragePerkRequestsFn success', { count: requests.length })
  return requests
})

export const reviewStoragePerkRequestFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({
      requestId: z.number(),
      status: z.enum(['approved', 'rejected']),
      reviewNotes: z.string().max(5000).optional(),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    await ensureStorageTables()
    const currentUser = await requireOrganizerUser()
    const db = await getDb()

    const request = await db
      .select()
      .from(storagePerkRequests)
      .where(eq(storagePerkRequests.id, data.requestId))
      .limit(1)

    if (!request[0]) {
      throw new Error('Storage request not found')
    }

    const now = new Date()
    const cleanNotes = data.reviewNotes?.trim() || null
    const updated = await db
      .update(storagePerkRequests)
      .set({
        status: data.status,
        reviewNotes: cleanNotes,
        reviewedBy: currentUser.id,
        reviewedAt: now,
        approvedAt: data.status === 'approved' ? now : null,
        termsAcceptedAt: data.status === 'approved' ? request[0].termsAcceptedAt : null,
        termsAcceptedByUserId: data.status === 'approved' ? request[0].termsAcceptedByUserId : null,
        updatedAt: now,
      })
      .where(eq(storagePerkRequests.id, data.requestId))
      .returning()

    const requester = await fetchUserNames([request[0].requestedByUserId])
    const requesterEmail = requester.get(request[0].requestedByUserId)?.email
    if (requesterEmail) {
      try {
        await sendStorageReviewEmail({
          to: requesterEmail,
          organizationName: request[0].organizationName,
          decision: data.status,
          notes: cleanNotes,
        })
      } catch (error) {
        console.error('Failed to send storage review email', error)
      }
    }

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: `storage.perk.${data.status}`,
      entityType: 'storage_perk_request',
      entityId: data.requestId,
      details: {
        organizationName: request[0].organizationName,
        reviewNotes: cleanNotes,
      },
    })

    return updated[0]
  })

export const createStorageUploadReservationFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({
      organizationName: z.string().min(1),
      fileName: z.string().min(1).max(255),
      contentType: z.string().max(255).optional(),
      sizeBytes: z.coerce.number().int().positive().max(STORAGE_LIMIT_BYTES),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    await ensureStorageTables()
    const currentUser = await requireStaffUser()
    const db = await getDb()
    const organizationName = normalizeOrg(data.organizationName)

    if (isBlockedStorageFileName(data.fileName)) {
      throw new Error('Blocked file type. This file name matches the malicious file protection regex.')
    }

    await requireStorageOrgAccess(currentUser, organizationName)

    const { reservation, usage } = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${organizationName}))`)

      const request = await getStorageRequestForOrganization(organizationName, tx as unknown as StorageDbLike)
      if (!request || request.status !== 'approved') {
        throw new Error('Storage must be approved before uploading files')
      }
      if (!request.termsAcceptedAt) {
        throw new Error('Storage is approved but not activated yet. Open Storage and accept terms first.')
      }

      const usage = await getStorageUsageSummary(organizationName, tx as unknown as StorageDbLike)
      if (usage.remainingBytes < data.sizeBytes) {
        throw new Error('Storage limit reached. Upload denied.')
      }

      const objectKey = buildObjectKey(organizationName, data.fileName)
      const expiresAt = new Date(Date.now() + STORAGE_UPLOAD_RESERVATION_TTL_MS)

      const [reservation] = await tx
        .insert(storageUploadReservations)
        .values({
          organizationName,
          requestedByUserId: currentUser.id,
          fileName: sanitizeFileName(data.fileName),
          contentType: data.contentType?.trim() || null,
          objectKey,
          sizeBytes: data.sizeBytes,
          expiresAt,
        })
        .returning()

      return { reservation, usage }
    })

    const objectKey = reservation.objectKey
    const expiresAt = reservation.expiresAt
    const uploadUrl = `/api/storage-upload?reservationId=${reservation.id}`

    return {
      reservationId: reservation.id,
      objectKey,
      uploadUrl,
      publicUrl: getPublicUrl(objectKey),
      expiresAt,
      limitBytes: STORAGE_LIMIT_BYTES,
      remainingBytes: usage.remainingBytes,
    }
  })

export const completeStorageUploadFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => z.object({ reservationId: z.number() }).parse(data))
  .handler(async ({ data }) => {
    await ensureStorageTables()
    const currentUser = await requireStaffUser()
    const db = await getDb()

    const reservation = await db
      .select()
      .from(storageUploadReservations)
      .where(eq(storageUploadReservations.id, data.reservationId))
      .limit(1)

    if (!reservation[0]) {
      throw new Error('Upload reservation not found')
    }

    await requireStorageOrgAccess(currentUser, reservation[0].organizationName)

    if (reservation[0].requestedByUserId !== currentUser.id && currentUser.role !== 'organizer') {
      throw new Error('Forbidden')
    }

    if (reservation[0].expiresAt.getTime() < Date.now()) {
      await db.delete(storageUploadReservations).where(eq(storageUploadReservations.id, reservation[0].id))
      throw new Error('Upload reservation expired. Please try again.')
    }

    const config = getStorageConfig()
    const s3 = getStorageClient(config)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), STORAGE_UPSTREAM_TIMEOUT_MS)
    let head

    try {
      head = await s3.send(
        new HeadObjectCommand({
          Bucket: config.bucket,
          Key: reservation[0].objectKey,
        }),
        { abortSignal: controller.signal },
      )
    } catch (error) {
      if (isStorageMissingObjectError(error)) {
        await db.delete(storageUploadReservations).where(eq(storageUploadReservations.id, reservation[0].id))
        throw new Error('Uploaded file is missing from storage. Please upload it again.')
      }

      logStorageError('completeStorageUploadFn HeadObject', error, {
        reservationId: reservation[0].id,
        objectKey: reservation[0].objectKey,
        bucket: config.bucket,
      })

      throw new Error(getStorageUpstreamErrorMessage(error))
    } finally {
      clearTimeout(timeout)
    }

    const uploadedSize = Number(head.ContentLength ?? 0)
    if (uploadedSize <= 0) {
      throw new Error('Uploaded file not found in storage')
    }

    if (uploadedSize !== reservation[0].sizeBytes) {
      try {
        await s3.send(
          new DeleteObjectCommand({
            Bucket: config.bucket,
            Key: reservation[0].objectKey,
          }),
        )
      } catch (error) {
        logStorageError('completeStorageUploadFn DeleteObject after size mismatch', error, {
          reservationId: reservation[0].id,
          objectKey: reservation[0].objectKey,
          bucket: config.bucket,
        })
      }
      throw new Error('Uploaded file size did not match the reserved size')
    }

    const file = await db
      .insert(storageFiles)
      .values({
        organizationName: reservation[0].organizationName,
        uploadedByUserId: reservation[0].requestedByUserId,
        fileName: reservation[0].fileName,
        contentType: reservation[0].contentType,
        objectKey: reservation[0].objectKey,
        sizeBytes: reservation[0].sizeBytes,
      })
      .returning()

    await db.delete(storageUploadReservations).where(eq(storageUploadReservations.id, reservation[0].id))

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'storage.file.upload',
      entityType: 'storage_file',
      entityId: file[0].id,
      details: {
        organizationName: reservation[0].organizationName,
        sizeBytes: reservation[0].sizeBytes,
      },
    })

    return {
      success: true,
      file: {
        ...file[0],
        publicUrl: getPublicUrl(file[0].objectKey),
      },
    }
  })

export const deleteStorageFileFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => z.object({ fileId: z.number() }).parse(data))
  .handler(async ({ data }) => {
    await ensureStorageTables()
    const currentUser = await requireStaffUser()
    const db = await getDb()

    const file = await db
      .select()
      .from(storageFiles)
      .where(eq(storageFiles.id, data.fileId))
      .limit(1)

    if (!file[0]) {
      throw new Error('File not found')
    }

    await requireStorageOrgAccess(currentUser, file[0].organizationName)

    const config = getStorageConfig()
    try {
      await getStorageClient(config).send(
        new DeleteObjectCommand({
          Bucket: config.bucket,
          Key: file[0].objectKey,
        }),
      )
    } catch (error) {
      logStorageError('deleteStorageFileFn DeleteObject', error, {
        fileId: file[0].id,
        objectKey: file[0].objectKey,
        bucket: config.bucket,
      })
      throw new Error(getStorageUpstreamErrorMessage(error))
    }

    await db.delete(storageFiles).where(eq(storageFiles.id, file[0].id))

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'storage.file.delete',
      entityType: 'storage_file',
      entityId: file[0].id,
      details: {
        organizationName: file[0].organizationName,
        sizeBytes: file[0].sizeBytes,
      },
    })

    return { success: true }
  })

export const activateStoragePerkFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({
      organizationName: z.string().min(1),
      acceptTerms: z.literal(true),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    await ensureStorageTables()
    const currentUser = await requireStaffUser()
    const db = await getDb()
    const organizationName = normalizeOrg(data.organizationName)

    await requireStorageOrgAccess(currentUser, organizationName)

    const request = await getStorageRequestForOrganization(organizationName)
    if (!request || request.status !== 'approved') {
      throw new Error('Storage must be approved before activation')
    }

    const now = new Date()
    const [updated] = await db
      .update(storagePerkRequests)
      .set({
        termsAcceptedAt: now,
        termsAcceptedByUserId: currentUser.id,
        updatedAt: now,
      })
      .where(eq(storagePerkRequests.id, request.id))
      .returning()

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'storage.perk.activate',
      entityType: 'storage_perk_request',
      entityId: request.id,
      details: {
        organizationName,
      },
    })

    return updated
  })