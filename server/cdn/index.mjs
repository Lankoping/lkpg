import { createServer } from 'node:http'
import { Readable } from 'node:stream'
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'

const PORT = 9962

const bucket = (process.env.S3_BUCKET ?? '').trim()
const region = (process.env.S3_REGION ?? '').trim()
const accessKeyId = (process.env.S3_ACCESS_KEY_ID ?? '').trim()
const secretAccessKey = (process.env.S3_SECRET_ACCESS_KEY ?? '').trim()
const endpoint = (process.env.S3_ENDPOINT ?? '').trim().replace(/\/$/, '')
const explicitOrigin = (process.env.CDN_ORIGIN_URL ?? '').trim().replace(/\/$/, '')
const forcePathStyle = ['1', 'true', 'yes', 'on'].includes((process.env.S3_FORCE_PATH_STYLE ?? '').trim().toLowerCase())

const originBase = explicitOrigin || (endpoint && bucket ? `${endpoint}/${encodeURIComponent(bucket)}` : '')
const canUseS3 = Boolean(bucket && region && accessKeyId && secretAccessKey)

const s3 = canUseS3
  ? new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      endpoint: endpoint || undefined,
      forcePathStyle,
    })
  : null

async function streamObjectFromS3(key, req, res) {
  if (!s3 || !bucket) {
    return false
  }

  const commandInput = {
    Bucket: bucket,
    Key: key,
  }

  const range = req.headers.range
  if (range) {
    commandInput.Range = range
  }

  const upstreamResponse = await s3.send(new GetObjectCommand(commandInput))

  res.statusCode = upstreamResponse.$metadata?.httpStatusCode || 200

  if (upstreamResponse.ContentType) {
    res.setHeader('content-type', upstreamResponse.ContentType)
  }

  if (upstreamResponse.ContentLength !== undefined) {
    res.setHeader('content-length', String(upstreamResponse.ContentLength))
  }

  if (upstreamResponse.CacheControl) {
    res.setHeader('cache-control', upstreamResponse.CacheControl)
  }

  if (upstreamResponse.ETag) {
    res.setHeader('etag', upstreamResponse.ETag)
  }

  if (upstreamResponse.LastModified) {
    res.setHeader('last-modified', upstreamResponse.LastModified.toUTCString())
  }

  if (upstreamResponse.AcceptRanges) {
    res.setHeader('accept-ranges', upstreamResponse.AcceptRanges)
  }

  if (!upstreamResponse.Body || req.method?.toUpperCase() === 'HEAD') {
    res.end()
    return true
  }

  if (typeof upstreamResponse.Body.pipe === 'function') {
    upstreamResponse.Body.pipe(res)
    return true
  }

  if (typeof upstreamResponse.Body.transformToWebStream === 'function') {
    Readable.fromWeb(upstreamResponse.Body.transformToWebStream()).pipe(res)
    return true
  }

  res.end()
  return true
}

const server = createServer(async (req, res) => {
  if (!originBase && !s3) {
    res.statusCode = 500
    res.setHeader('content-type', 'text/plain; charset=utf-8')
    res.end('CDN origin is not configured. Set S3 credentials for authenticated S3 access, or CDN_ORIGIN_URL.')
    return
  }

  if (req.url === '/healthz') {
    res.statusCode = 200
    res.setHeader('content-type', 'text/plain; charset=utf-8')
    res.end('ok')
    return
  }

  try {
    const incomingUrl = new URL(req.url || '/', 'http://localhost')

    if (!explicitOrigin && s3 && bucket) {
      const key = decodeURIComponent(incomingUrl.pathname.replace(/^\//, ''))
      if (key) {
        const handled = await streamObjectFromS3(key, req, res)
        if (handled) {
          return
        }
      }
    }

    const targetUrl = `${originBase}${incomingUrl.pathname}${incomingUrl.search}`

    const headers = new Headers()
    for (const [key, value] of Object.entries(req.headers)) {
      if (!value) continue
      if (key.toLowerCase() === 'host') continue
      headers.set(key, Array.isArray(value) ? value.join(', ') : value)
    }

    const hasBody = req.method && !['GET', 'HEAD'].includes(req.method.toUpperCase())

    const upstreamResponse = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: hasBody ? req : undefined,
      duplex: hasBody ? 'half' : undefined,
    })

    res.statusCode = upstreamResponse.status

    upstreamResponse.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'transfer-encoding') return
      res.setHeader(key, value)
    })

    if (!upstreamResponse.body || req.method?.toUpperCase() === 'HEAD') {
      res.end()
      return
    }

    Readable.fromWeb(upstreamResponse.body).pipe(res)
  } catch (error) {
    res.statusCode = 502
    res.setHeader('content-type', 'text/plain; charset=utf-8')
    res.end(`CDN proxy error: ${error instanceof Error ? error.message : 'unknown error'}`)
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`CDN proxy running on :${PORT}`)
})