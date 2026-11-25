import type { IncomingMessage, ServerResponse } from 'http'
import { subscriptionStore } from './kv'
import { evaluateNotificationDue } from '../src/core/notifications/scheduler'
import {
  generateVapidKeys,
  sendWebPushNotification,
  type VapidKeys,
} from '../src/core/notifications/vapid'
import type { GenericNotificationPayload } from '../src/core/notifications/types'

// Global or environment VAPID keys
export const DEFAULT_VAPID_KEYS: VapidKeys = {
  publicKey:
    process.env.VAPID_PUBLIC_KEY ||
    'BFZvPtD4Cfa57rkA2P4PCQpR70NRK5n4eP2Q3hlTvYs5EGc_nr9-N0RvxAPxoggbHQo1SnBRDCFiAxNIlVEs7FM',
  privateKey:
    process.env.VAPID_PRIVATE_KEY ||
    'KfwtkSc0cWuZFQGbaPw6U_o9vEq7R34COpZP5cO5f-Q',
}

function getVapidKeys(): VapidKeys {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
    }
  }

  const isProd = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production'
  if (isProd) {
    throw new Error('VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables must be set in production')
  }

  return DEFAULT_VAPID_KEYS
}

export default async function handler(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  try {
    let bodyData: any = req.body

    if (!bodyData && req.method === 'POST') {
      const chunks: Buffer[] = []
      for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
      }
      const raw = Buffer.concat(chunks).toString('utf8')
      bodyData = raw ? JSON.parse(raw) : {}
    }

    const isDirectTestRequest =
      bodyData?.test === true &&
      typeof bodyData?.endpoint === 'string' &&
      bodyData.endpoint.trim().length > 0

    // Verify Cron authorization for scheduler runs (never allow test flag without endpoint to bypass)
    const cronSecret = process.env.CRON_SECRET
    if (!isDirectTestRequest) {
      if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
        res.statusCode = 401
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Unauthorized' }))
        return
      }
    }

    const vapidKeys = getVapidKeys()
    const subject = process.env.VAPID_SUBJECT || 'mailto:hello@trinqle.app'

    // 1. Direct Test Notification (always returns here; never falls through to cron broadcast)
    if (bodyData?.test) {
      if (!isDirectTestRequest) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Missing subscription endpoint for test notification' }))
        return
      }

      const sub = await subscriptionStore.get(bodyData.endpoint)
      if (!sub) {
        res.statusCode = 404
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Subscription endpoint not found' }))
        return
      }

      const testPayload: GenericNotificationPayload = {
        title: 'Trinqle',
        body: 'Test notification from Piqsie. Everything is working!',
        url: '/',
        tag: 'test-notification',
      }

      const result = await sendWebPushNotification(sub.subscription, testPayload, vapidKeys, subject)

      res.statusCode = result.success ? 200 : 502
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(result))
      return
    }

    // 2. Cron Scheduler Run (Every 15 minutes)
    const nowUtc = new Date()
    const allSubs = await subscriptionStore.getAll()

    let countEvaluated = 0
    let countSent = 0
    let countRemoved = 0

    for (const sub of allSubs) {
      countEvaluated++
      const evalResult = evaluateNotificationDue(sub, nowUtc)

      if (evalResult.due && evalResult.payload && evalResult.type && evalResult.dateStr) {
        // Enforce generic message (zero journal text)
        const sendResult = await sendWebPushNotification(
          sub.subscription,
          evalResult.payload,
          vapidKeys,
          subject
        )

        if (sendResult.success) {
          countSent++
          await subscriptionStore.recordSent(
            sub.subscription.endpoint,
            evalResult.type,
            evalResult.dateStr
          )
        } else if (sendResult.status === 404 || sendResult.status === 410) {
          // Endpoint expired / revoked by browser
          countRemoved++
          await subscriptionStore.remove(sub.subscription.endpoint)
        }
      }
    }

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(
      JSON.stringify({
        success: true,
        countEvaluated,
        countSent,
        countRemoved,
      })
    )
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
