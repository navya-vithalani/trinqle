import type { IncomingMessage, ServerResponse } from 'http'
import { subscriptionStore } from './kv'
import type { StoredSubscription } from '../src/core/notifications/types'
import { generateUUIDv7 } from '../src/core/ids'

export default async function handler(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  try {
    let bodyData: any = req.body

    // If body not parsed by framework, buffer it
    if (!bodyData) {
      const chunks: Buffer[] = []
      for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
      }
      const raw = Buffer.concat(chunks).toString('utf8')
      bodyData = raw ? JSON.parse(raw) : {}
    }

    const { subscription, tz, prefs } = bodyData

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Invalid push subscription payload' }))
      return
    }

    const now = Date.now()
    const storedSub: StoredSubscription = {
      id: generateUUIDv7(now),
      subscription,
      tz: tz || 'UTC',
      prefs: prefs || {
        dailyReminder: true,
        dailyReminderTime: '21:00',
        mondayInsights: true,
        mondayInsightsTime: '09:00',
        chapterEnding: true,
      },
      createdAt: now,
      updatedAt: now,
    }

    await subscriptionStore.save(storedSub)

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ success: true, id: storedSub.id }))
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
