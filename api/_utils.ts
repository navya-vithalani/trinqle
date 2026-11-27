import crypto from 'crypto'
import type { IncomingMessage, ServerResponse } from 'http'

export const MAX_PUSH_BODY_BYTES = 4096

export class HttpRequestError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

/**
 * Reads JSON body from an IncomingMessage with an explicit byte size cap.
 */
export async function readJsonBody(
  req: IncomingMessage & { body?: unknown },
  maxBytes: number = MAX_PUSH_BODY_BYTES
): Promise<Record<string, unknown>> {
  if (req.body !== undefined) {
    if (typeof req.body === 'string') {
      if (Buffer.byteLength(req.body, 'utf8') > maxBytes) {
        throw new HttpRequestError(413, 'Request payload too large')
      }
      if (!req.body.trim()) return {}
      try {
        const parsed = JSON.parse(req.body)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new HttpRequestError(400, 'JSON body must be an object')
        }
        return parsed as Record<string, unknown>
      } catch (err) {
        if (err instanceof HttpRequestError) throw err
        throw new HttpRequestError(400, 'Malformed JSON body')
      }
    }

    if (typeof req.body === 'object' && req.body !== null && !Array.isArray(req.body)) {
      const approxBytes = Buffer.byteLength(JSON.stringify(req.body), 'utf8')
      if (approxBytes > maxBytes) {
        throw new HttpRequestError(413, 'Request payload too large')
      }
      return req.body as Record<string, unknown>
    }

    throw new HttpRequestError(400, 'JSON body must be an object')
  }

  const chunks: Buffer[] = []
  let totalBytes = 0
  for await (const chunk of req) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk
    totalBytes += buf.length
    if (totalBytes > maxBytes) {
      throw new HttpRequestError(413, 'Request payload too large')
    }
    chunks.push(buf)
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) return {}

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new HttpRequestError(400, 'JSON body must be an object')
    }
    return parsed as Record<string, unknown>
  } catch (err) {
    if (err instanceof HttpRequestError) throw err
    throw new HttpRequestError(400, 'Malformed JSON body')
  }
}

export function generateManageToken(): string {
  return crypto.randomBytes(32).toString('base64url')
}

export function hashManageToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex')
}

export function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) {
    return false
  }
  return crypto.timingSafeEqual(bufA, bufB)
}

export function verifyManageToken(providedToken: unknown, expectedHash?: string): boolean {
  if (typeof providedToken !== 'string' || !providedToken || !expectedHash) {
    return false
  }
  const actualHash = hashManageToken(providedToken)
  return timingSafeEqualStrings(actualHash, expectedHash)
}

export function extractBearerToken(
  req: IncomingMessage,
  bodyToken?: unknown
): string | null {
  const auth = req.headers.authorization
  if (typeof auth === 'string') {
    const match = auth.match(/^Bearer\s+(.+)$/i)
    if (match && match[1]) {
      return match[1].trim()
    }
  }
  if (typeof bodyToken === 'string' && bodyToken.trim()) {
    return bodyToken.trim()
  }
  return null
}

export function sendEndpointError(res: ServerResponse, err: unknown): void {
  const status =
    err &&
    typeof err === 'object' &&
    'status' in err &&
    typeof (err as { status?: unknown }).status === 'number'
      ? (err as { status: number }).status
      : 500
  const message = err instanceof Error ? err.message : 'Internal server error'
  sendJson(res, status, { error: message })
}
