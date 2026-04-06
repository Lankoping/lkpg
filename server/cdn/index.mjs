import { createServer } from 'node:http'
import { Readable } from 'node:stream'

const PORT = 9962

const bucket = (process.env.S3_BUCKET ?? '').trim()
const endpoint = (process.env.S3_ENDPOINT ?? '').trim().replace(/\/$/, '')
const explicitOrigin = (process.env.CDN_ORIGIN_URL ?? '').trim().replace(/\/$/, '')

const originBase = explicitOrigin || (endpoint && bucket ? `${endpoint}/${encodeURIComponent(bucket)}` : '')

const server = createServer(async (req, res) => {
  if (!originBase) {
    res.statusCode = 500
    res.setHeader('content-type', 'text/plain; charset=utf-8')
    res.end('CDN origin is not configured. Set S3_ENDPOINT and S3_BUCKET, or CDN_ORIGIN_URL.')
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