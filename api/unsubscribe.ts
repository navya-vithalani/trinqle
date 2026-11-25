import type { IncomingMessage, ServerResponse } from 'http'
import { subscriptionStore } from './kv'

export default async function handler(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  try {
    let bodyData: any = req.body

    if (!bodyData) {
      const chunks: Buffer[] = []
      for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
      }
      const raw = Buffer.concat(chunks).toString('utf8')
      bodyData = raw ? JSON.parse(raw) : {}
    }

    const { endpoint } = bodyData

    if (!endpoint || typeof endpoint !== 'string') {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Missing endpoint' }))
      return
    }

    await subscriptionStore.remove(endpoint)

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ success: true }))
  } catch (err: unknown) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Internal server error',
      })
    )
  }
}
