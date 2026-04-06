import { S3Client } from '@aws-sdk/client-s3'

export type StorageConfig = {
  bucket: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  endpoint?: string
  cdnBaseUrl?: string
  publicBaseUrl?: string
  forcePathStyle: boolean
}

type StorageErrorLike = {
  name?: string
  message?: string
  Code?: string
  $metadata?: {
    httpStatusCode?: number
    requestId?: string
    extendedRequestId?: string
    attempts?: number
  }
} | null | undefined

let cachedClient: S3Client | null = null
let cachedClientKey: string | null = null

function parseBooleanEnv(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback
  }

  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return fallback
  }

  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') {
    return true
  }

  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') {
    return false
  }

  return fallback
}

export function getStorageConfig(): StorageConfig {
  const bucket = (process.env.S3_BUCKET ?? process.env.AWS_S3_BUCKET ?? '').trim()
  const region = (process.env.S3_REGION ?? process.env.AWS_REGION ?? '').trim()
  const accessKeyId = (process.env.S3_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID ?? '').trim()
  const secretAccessKey = (process.env.S3_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY ?? '').trim()
  const endpoint = (process.env.S3_ENDPOINT ?? process.env.AWS_S3_ENDPOINT ?? '').trim() || undefined
  const cdnBaseUrl = (process.env.S3_CDN_BASE_URL ?? process.env.AWS_S3_CDN_BASE_URL ?? '').trim() || undefined
  const publicBaseUrl = (process.env.S3_PUBLIC_BASE_URL ?? '').trim() || undefined

  if (!bucket || !region || !accessKeyId || !secretAccessKey) {
    throw new Error('Storage configuration missing: set S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY')
  }

  const forcePathStyle = parseBooleanEnv(process.env.S3_FORCE_PATH_STYLE, Boolean(endpoint))

  return {
    bucket,
    region,
    accessKeyId,
    secretAccessKey,
    endpoint,
    cdnBaseUrl,
    publicBaseUrl,
    forcePathStyle,
  }
}

export function getStorageClient(config = getStorageConfig()) {
  const cacheKey = [
    config.region,
    config.accessKeyId,
    config.secretAccessKey,
    config.endpoint ?? '',
    config.forcePathStyle ? '1' : '0',
  ].join('|')

  if (cachedClient && cachedClientKey === cacheKey) {
    return cachedClient
  }

  cachedClient = new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
  })
  cachedClientKey = cacheKey

  return cachedClient
}

export function isStorageMissingObjectError(error: unknown) {
  const anyError = error as StorageErrorLike
  return (
    anyError?.name === 'NotFound' ||
    anyError?.name === 'NoSuchKey' ||
    anyError?.name === 'NotFoundException' ||
    anyError?.$metadata?.httpStatusCode === 404
  )
}

export function formatStorageError(error: unknown) {
  const anyError = error as StorageErrorLike

  const status = anyError?.$metadata?.httpStatusCode ?? 'unknown'
  const requestId = anyError?.$metadata?.requestId ?? 'unknown'
  const extendedRequestId = anyError?.$metadata?.extendedRequestId ?? 'unknown'
  const code = anyError?.Code || anyError?.name || 'Unknown'
  const message = anyError?.message || 'UnknownError'

  return `status=${status} code=${code} message=${message} requestId=${requestId} extendedRequestId=${extendedRequestId}`
}

export function getStorageUpstreamErrorMessage(error: unknown) {
  return `S3 upstream error - ${formatStorageError(error)}`
}

export function logStorageError(context: string, error: unknown, details?: Record<string, unknown>) {
  if (details) {
    console.error(`[s3] ${context} - ${formatStorageError(error)}`, details)
    return
  }

  console.error(`[s3] ${context} - ${formatStorageError(error)}`)
}

export function getStoragePublicUrl(objectKey: string, config = getStorageConfig()) {
  const encodedKey = objectKey.split('/').map(encodeURIComponent).join('/')

  if (config.cdnBaseUrl) {
    return `${config.cdnBaseUrl.replace(/\/$/, '')}/${encodedKey}`
  }

  if (config.publicBaseUrl) {
    return `${config.publicBaseUrl.replace(/\/$/, '')}/${encodedKey}`
  }

  if (config.endpoint) {
    return `${config.endpoint.replace(/\/$/, '')}/${config.bucket}/${encodedKey}`
  }

  return `https://${config.bucket}.s3.${config.region}.amazonaws.com/${encodedKey}`
}
