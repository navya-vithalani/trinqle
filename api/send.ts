import type { IncomingMessage, ServerResponse } from 'http'
import { subscriptionStore } from './kv.js'
import {
  extractBearerToken,
  readJsonBody,
  sendEndpointError,
  sendJson,
  timingSafeEqualStrings,
  verifyManageToken,
} from './_utils.js'
import { evaluateNotificationDue } from '../src/core/notifications/scheduler.js'
import { validatePushEndpoint } from '../src/core/notifications/validation.js'
import { sendWebPushNotification, type VapidKeys } from '../src/core/notifications/vapid.js'
import type { GenericNotificationPayload } from '../src/core/notifications/types.js'

function getVapidKeys(): VapidKeys {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim()
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()
  if (!publicKey || !privateKey) {
    throw new Error('VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables must be set')
  }
  return { publicKey, privateKey }
}

function getVapidSubject(): string {
  const subject = process.env.VAPID_SUBJECT?.trim()
  if (!subject || (!subject.startsWith('mailto:') && !subject.startsWith('https://'))) {
    throw new Error('VAPID_SUBJECT environment variable must be set to a mailto: or https:// URI')
  }
  return subject
}

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' })
    return
  }

  try {
    const bodyData = await readJsonBody(req)

    if (bodyData.test !== undefined && typeof bodyData.test !== 'boolean') {
      sendJson(res, 400, { error: 'Invalid test flag' })
      return
    }

    // 1. Direct Test Notification (requires valid endpoint + per-device manageToken)
    if (bodyData.test === true) {
      const endpointCheck = validatePushEndpoint(bodyData.endpoint)
      if (!endpointCheck.ok) {
        sendJson(res, 400, { error: endpointCheck.error })
        return
      }

      const token = extractBearerToken(req, bodyData.manageToken)
      if (!token) {
        sendJson(res, 401, { error: 'Authorization token required for test notification' })
        return
      }

      const sub = await subscriptionStore.get(endpointCheck.value)
      if (!sub) {
        sendJson(res, 404, { error: 'Subscription endpoint not found' })
        return
      }

      if (!verifyManageToken(token, sub.manageTokenHash)) {
        sendJson(res, 401, { error: 'Invalid manage token' })
        return
      }

      const vapidKeys = getVapidKeys()
      const subject = getVapidSubject()

      const testPayload: GenericNotificationPayload = {
        title: 'Trinqle',
        body: 'Test notification from Piqsie. Everything is working!',
        url: '/',
        tag: 'test-notification',
      }

      const result = await sendWebPushNotification(sub.subscription, testPayload, vapidKeys, subject)
      sendJson(res, result.success ? 200 : 502, result)
      return
    }

    // 2. Cron Scheduler Run: Fail closed if CRON_SECRET is unset or bearer token mismatches
    const cronSecret = process.env.CRON_SECRET?.trim()
    if (!cronSecret) {
      sendJson(res, 500, { error: 'Server misconfigured: CRON_SECRET is not set' })
      return
    }

    const bearer = extractBearerToken(req)
    if (!bearer || !timingSafeEqualStrings(bearer, cronSecret)) {
      sendJson(res, 401, { error: 'Unauthorized' })
      return
    }

    const vapidKeys = getVapidKeys()
    const subject = getVapidSubject()

    const nowUtc = new Date()
    const allSubs = await subscriptionStore.getAll()

    let countEvaluated = 0
    let countSent = 0
    let countRemoved = 0
    let countErrors = 0

    for (const sub of allSubs) {
      countEvaluated++
      try {
        const evalResult = evaluateNotificationDue(sub, nowUtc)
        if (evalResult.due && evalResult.payload && evalResult.type && evalResult.dateStr) {
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
            countRemoved++
            await subscriptionStore.remove(sub.subscription.endpoint)
          } else {
            countErrors++
          }
        }
      } catch (subErr) {
        countErrors++
        console.error('[notify-cron] Subscriber evaluation error:', subErr)
      }
    }

    const summary = {
      success: true,
      countEvaluated,
      countSent,
      countRemoved,
      countErrors,
      ranAt: nowUtc.toISOString(),
    }
    console.info('[notify-cron]', JSON.stringify(summary))
    sendJson(res, 200, summary)
  } catch (err: unknown) {
    sendEndpointError(res, err)
  }
}
