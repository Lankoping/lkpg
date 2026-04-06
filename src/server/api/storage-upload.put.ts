import { defineEventHandler, createError, getCookie, getQuery, getRequestHeader, setResponseStatus } from 'h3'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { eq } from 'drizzle-orm'
import { getDb } from '../db/runtime'
import { storageFiles, storageUploadReservations, users } from '../db/schema'
import { getStorageClient, getStorageConfig, getStorageUpstreamErrorMessage, logStorageError } from '../lib/s3-compatible'
import { writeActivityLog } from '../functions/logs'

const UPLOAD_DB_TIMEOUT_MS = Number(process.env.STORAGE_UPLOAD_DB_TIMEOUT_MS || 45000)
const UPLOAD_S3_TIMEOUT_MS = Number(process.env.STORAGE_UPLOAD_S3_TIMEOUT_MS || 20000)
const DEFAULT_BLOCKED_STORAGE_FILE_REGEX =
  /(?:^\.|\.(?:env|htaccess|htpasswd|pem|key)$)|(?:\.(?:ade|adp|app|apk|bat|bin|cmd|com|cpl|dll|dmg|exe|hta|ins|iso|jar|js|jse|lib|lnk|mde|msc|msi|msp|mst|pif|ps1|reg|scr|sct|sh|sys|vb|vbe|vbs|vxd|wsc|wsf|wsh|php|phar|phtml|cgi|pl|py|rb))$/i
const DEFAULT_BLOCKED_STORAGE_MIME_REGEX =
  /^(?:application\/(?:x-dosexec|x-msdownload|x-msdos-program|x-executable|x-mach-binary|x-elf)|application\/(?:x-sh|x-csh)|text\/(?:x-shellscript|x-php)|application\/(?:x-php|x-httpd-php|x-httpd-php-source))$/i

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
  } catch {
    return DEFAULT_BLOCKED_STORAGE_FILE_REGEX
  }
}

function getBlockedStorageMimeRegex() {
  const configuredPattern = (process.env.STORAGE_BLOCKED_MIME_REGEX ?? '').trim()
  if (!configuredPattern) {
    return DEFAULT_BLOCKED_STORAGE_MIME_REGEX
  }

  try {
    return new RegExp(configuredPattern, 'i')
  } catch {
    return DEFAULT_BLOCKED_STORAGE_MIME_REGEX
  }
}

function isBlockedStorageFileName(fileName: string) {
  return getBlockedStorageFileRegex().test(sanitizeFileName(fileName))
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

async function requireStaffUserFromRequest(sessionCookie: string | undefined) {
  if (!sessionCookie) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const userId = Number.parseInt(sessionCookie, 10)
  if (!Number.isInteger(userId) || userId <= 0) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const db = await withTimeout(getDb(), UPLOAD_DB_TIMEOUT_MS, 'Upload auth DB connection')
  const result = await withTimeout(
    db.select().from(users).where(eq(users.id, userId)).limit(1),
    UPLOAD_DB_TIMEOUT_MS,
    'Upload auth user lookup',
  )
  const user = result[0]

  if (!user || user.active === false || (user.role !== 'organizer' && user.role !== 'volunteer')) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  return user
}

export default defineEventHandler(async (event) => {
  if (event.node.req.method !== 'PUT') {
    throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
  }

  const query = getQuery(event)
  const reservationIdValue = Array.isArray(query.reservationId) ? query.reservationId[0] : query.reservationId
  const reservationId = Number(reservationIdValue)

  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Missing or invalid reservationId' })
  }

  const currentUser = await requireStaffUserFromRequest(getCookie(event, 'session'))
  const db = await withTimeout(getDb(), UPLOAD_DB_TIMEOUT_MS, 'Upload DB connection')

  const reservation = await withTimeout(
    db
      .select()
      .from(storageUploadReservations)
      .where(eq(storageUploadReservations.id, reservationId))
      .limit(1),
    UPLOAD_DB_TIMEOUT_MS,
    'Upload reservation lookup',
  )

  if (!reservation[0]) {
    throw createError({ statusCode: 404, statusMessage: 'Upload reservation not found' })
  }

  if (isBlockedStorageFileName(reservation[0].fileName)) {
    await withTimeout(
      db.delete(storageUploadReservations).where(eq(storageUploadReservations.id, reservation[0].id)),
      UPLOAD_DB_TIMEOUT_MS,
      'Blocked upload reservation cleanup',
    )
    throw createError({ statusCode: 400, statusMessage: 'Blocked file type' })
  }

  if (reservation[0].expiresAt.getTime() < Date.now()) {
    await withTimeout(
      db.delete(storageUploadReservations).where(eq(storageUploadReservations.id, reservation[0].id)),
      UPLOAD_DB_TIMEOUT_MS,
      'Upload reservation cleanup',
    )
    throw createError({ statusCode: 410, statusMessage: 'Upload reservation expired' })
  }

  if (reservation[0].requestedByUserId !== currentUser.id && currentUser.role !== 'organizer') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const contentType = getRequestHeader(event, 'content-type')?.trim() || reservation[0].contentType || 'application/octet-stream'
  const contentLengthHeader = getRequestHeader(event, 'content-length')
  const contentLength = contentLengthHeader ? Number(contentLengthHeader) : reservation[0].sizeBytes

  if (reservation[0].contentType && contentType !== reservation[0].contentType) {
    throw createError({ statusCode: 400, statusMessage: 'Content-Type does not match the reservation' })
  }

  if (getBlockedStorageMimeRegex().test(contentType)) {
    await withTimeout(
      db.delete(storageUploadReservations).where(eq(storageUploadReservations.id, reservation[0].id)),
      UPLOAD_DB_TIMEOUT_MS,
      'Blocked MIME reservation cleanup',
    )
    throw createError({ statusCode: 400, statusMessage: 'Blocked content type' })
  }

  if (contentLengthHeader && (!Number.isFinite(contentLength) || contentLength <= 0)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid content-length header' })
  }

  if (contentLength !== reservation[0].sizeBytes) {
    throw createError({ statusCode: 400, statusMessage: 'Uploaded file size does not match the reservation' })
  }

  const config = getStorageConfig()
  const s3 = getStorageClient(config)
  const controller = new AbortController()
  const s3Timeout = setTimeout(() => controller.abort(), UPLOAD_S3_TIMEOUT_MS)

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: reservation[0].objectKey,
        Body: event.node.req,
        ContentType: contentType,
        ContentLength: contentLength,
      }),
      { abortSignal: controller.signal },
    )
  } catch (error) {
    logStorageError('src/server/api/storage-upload.put PutObject', error, {
      reservationId: reservation[0].id,
      objectKey: reservation[0].objectKey,
      bucket: config.bucket,
    })

    throw createError({
      statusCode: 502,
      statusMessage: getStorageUpstreamErrorMessage(error),
    })
  } finally {
    clearTimeout(s3Timeout)
  }

  const file = await withTimeout(
    db
      .insert(storageFiles)
      .values({
        organizationName: reservation[0].organizationName,
        uploadedByUserId: reservation[0].requestedByUserId,
        fileName: reservation[0].fileName,
        contentType,
        objectKey: reservation[0].objectKey,
        sizeBytes: contentLength,
      })
      .returning(),
    UPLOAD_DB_TIMEOUT_MS,
    'Upload file record insert',
  )

  await withTimeout(
    db.delete(storageUploadReservations).where(eq(storageUploadReservations.id, reservation[0].id)),
    UPLOAD_DB_TIMEOUT_MS,
    'Upload reservation delete',
  )

  await writeActivityLog({
    actorUserId: currentUser.id,
    actorRole: currentUser.role,
    action: 'storage.file.upload',
    entityType: 'storage_file',
    entityId: file[0].id,
    details: {
      organizationName: reservation[0].organizationName,
      sizeBytes: contentLength,
    },
  })

  setResponseStatus(event, 204)
  return null
})