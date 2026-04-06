'use server'
import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq, gt, inArray, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { z } from 'zod'
import { getDb } from '../db/runtime'
import {
  foundaryApplications,
  organizationMembers,
  storageFiles,
  storagePerkRequests,
  storageUploadReservations,
  users,
} from '../db/schema'
import { requireOrganizerUser, requireStaffUser } from '../lib/access'
import { writeActivityLog } from './logs'

export const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024 * 1024
const STORAGE_UPLOAD_RESERVATION_TTL_MS = 15 * 60 * 1000

type StorageConfig = {
  bucket: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  endpoint?: string
  cdnBaseUrl?: string
}

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

function buildObjectKey(organizationName: string, fileName: string) {
  const prefix = slugifyOrg(organizationName) || 'organization'
  return `${prefix}/${Date.now()}-${randomUUID()}-${sanitizeFileName(fileName)}`
}

function getS3Config(): StorageConfig {
  const bucket = (process.env.S3_BUCKET ?? process.env.AWS_S3_BUCKET ?? '').trim()
  const region = (process.env.S3_REGION ?? process.env.AWS_REGION ?? '').trim()
  const accessKeyId = (process.env.S3_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID ?? '').trim()
  const secretAccessKey = (process.env.S3_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY ?? '').trim()
  const endpoint = (process.env.S3_ENDPOINT ?? process.env.AWS_S3_ENDPOINT ?? '').trim() || undefined
  const cdnBaseUrl = (process.env.S3_CDN_BASE_URL ?? process.env.AWS_S3_CDN_BASE_URL ?? '').trim() || undefined

  if (!bucket || !region || !accessKeyId || !secretAccessKey) {
    throw new Error('Storage configuration missing: set S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY')
  }

  return { bucket, region, accessKeyId, secretAccessKey, endpoint, cdnBaseUrl }
}

function getS3Client() {
  const config = getS3Config()
  return new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    endpoint: config.endpoint,
    forcePathStyle: Boolean(config.endpoint),
  })
}

function getPublicUrl(objectKey: string) {
  const config = getS3Config()
  const encodedKey = objectKey.split('/').map(encodeURIComponent).join('/')

  if (config.cdnBaseUrl) {
    return `${config.cdnBaseUrl.replace(/\/$/, '')}/${encodedKey}`
  }

  if (config.endpoint) {
    return `${config.endpoint.replace(/\/$/, '')}/${config.bucket}/${encodedKey}`
  }

  return `https://${config.bucket}.s3.${config.region}.amazonaws.com/${encodedKey}`
}

async function getPrimaryOrganizationNameForUser(user: { id: number; email: string | null }) {
  const db = await getDb()

  const memberships = await db
    .select({ organizationName: organizationMembers.organizationName })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, user.id))
    .orderBy(organizationMembers.createdAt)

  const normalizedMemberships = Array.from(new Set(memberships.map((row) => normalizeOrg(row.organizationName)).filter(Boolean)))
  if (normalizedMemberships.length > 0) {
    return normalizedMemberships[0]
  }

  const legacyApplications = await db
    .select({ organizationName: foundaryApplications.organizationName })
    .from(foundaryApplications)
    .where(eq(foundaryApplications.email, (user.email ?? '').trim().toLowerCase()))
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
  const membership = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(and(eq(organizationMembers.userId, user.id), eq(organizationMembers.organizationName, organizationName)))
    .limit(1)

  if (!membership[0]) {
    throw new Error('You can only use storage for organizations you belong to')
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

async function getStorageRequestForOrganization(organizationName: string, dbLike: any = null) {
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

async function getStorageUsageSummary(organizationName: string, dbLike: any = null) {
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

async function getStorageFiles(organizationName: string, dbLike: any = null) {
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
  const organizationName = await getPrimaryOrganizationNameForUser(currentUser)

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

  const [request, usage, files] = await Promise.all([
    getStorageRequestForOrganization(organizationName),
    getStorageUsageSummary(organizationName),
    getStorageFiles(organizationName),
  ])

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
    const currentUser = await requireStaffUser()
    const db = await getDb()
    const organizationName = await getPrimaryOrganizationNameForUser(currentUser)

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

    return { success: true, organizationName }
  })

export const getStoragePerkRequestsFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requireOrganizerUser()
  return await getRequestList()
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
    const updated = await db
      .update(storagePerkRequests)
      .set({
        status: data.status,
        reviewNotes: data.reviewNotes?.trim() || null,
        reviewedBy: currentUser.id,
        reviewedAt: now,
        approvedAt: data.status === 'approved' ? now : null,
        updatedAt: now,
      })
      .where(eq(storagePerkRequests.id, data.requestId))
      .returning()

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: `storage.perk.${data.status}`,
      entityType: 'storage_perk_request',
      entityId: data.requestId,
      details: {
        organizationName: request[0].organizationName,
        reviewNotes: data.reviewNotes?.trim() || null,
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
    const currentUser = await requireStaffUser()
    const db = await getDb()
    const organizationName = normalizeOrg(data.organizationName)

    await requireStorageOrgAccess(currentUser, organizationName)

    const { reservation, usage } = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${organizationName}))`)

      const request = await getStorageRequestForOrganization(organizationName, tx)
      if (!request || request.status !== 'approved') {
        throw new Error('Storage must be approved before uploading files')
      }

      const usage = await getStorageUsageSummary(organizationName, tx)
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
    const config = getS3Config()
    const uploadUrl = await getSignedUrl(
      getS3Client(),
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: objectKey,
        ContentType: data.contentType?.trim() || undefined,
      }),
      { expiresIn: 900 },
    )

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

    const config = getS3Config()
    const s3 = getS3Client()
    const head = await s3.send(
      new HeadObjectCommand({
        Bucket: config.bucket,
        Key: reservation[0].objectKey,
      }),
    )

    const uploadedSize = Number(head.ContentLength ?? 0)
    if (uploadedSize <= 0) {
      throw new Error('Uploaded file not found in storage')
    }

    if (uploadedSize !== reservation[0].sizeBytes) {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: config.bucket,
          Key: reservation[0].objectKey,
        }),
      )
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

    const config = getS3Config()
    await getS3Client().send(
      new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: file[0].objectKey,
      }),
    )

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