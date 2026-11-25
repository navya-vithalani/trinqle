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

  return DEFAULT_VAPID_KEYS
}

export default async function handler(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  // Verify Cron authorization if CRON_SECRET is configured
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    // If not a test notification request from local client
    let isTest = false
    try {
      if (req.body?.test) isTest = true
    } catch {}

    if (!isTest) {
      res.statusCode = 401
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Unauthorized' }))
      return
    }
  }

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

    const vapidKeys = getVapidKeys()
    const subject = process.env.VAPID_SUBJECT || 'mailto:hello@trinqle.app'

    // 1. Direct Test Notification
    if (bodyData?.test && bodyData?.endpoint) {
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
