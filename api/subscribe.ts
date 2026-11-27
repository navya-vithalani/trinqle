import type { IncomingMessage, ServerResponse } from 'http'
import { subscriptionStore } from './kv'
import {
  generateManageToken,
  hashManageToken,
  readJsonBody,
  sendEndpointError,
  sendJson,
} from './_utils'
import {
  sanitizeNotificationPrefs,
  validatePushEndpoint,
  validatePushKeys,
  validateTimeZone,
} from '../src/core/notifications/validation'
import type { NotificationPrefs, StoredSubscription } from '../src/core/notifications/types'
import { generateUUIDv7 } from '../src/core/ids'

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' })
    return
  }

  try {
    const bodyData = await readJsonBody(req)
    const rawSub = bodyData.subscription as Record<string, unknown> | undefined

    const endpointCheck = validatePushEndpoint(rawSub?.endpoint)
    if (!endpointCheck.ok) {
      sendJson(res, 400, { error: endpointCheck.error })
      return
    }

    const keysCheck = validatePushKeys(rawSub?.keys)
    if (!keysCheck.ok) {
      sendJson(res, 400, { error: keysCheck.error })
      return
    }

    const tzCheck = validateTimeZone(bodyData.tz ?? 'UTC')
    if (!tzCheck.ok) {
      sendJson(res, 400, { error: tzCheck.error })
      return
    }

    const prefsCheck = sanitizeNotificationPrefs(bodyData.prefs, { partial: false })
    if (!prefsCheck.ok) {
      sendJson(res, 400, { error: prefsCheck.error })
      return
    }

    const now = Date.now()
    const manageToken = generateManageToken()
    const manageTokenHash = hashManageToken(manageToken)
    const existing = await subscriptionStore.get(endpointCheck.value)

    const storedSub: StoredSubscription = {
      id: existing?.id || generateUUIDv7(now),
      subscription: {
        endpoint: endpointCheck.value,
        keys: keysCheck.value,
        expirationTime:
          typeof rawSub?.expirationTime === 'number' || rawSub?.expirationTime === null
            ? rawSub.expirationTime
            : undefined,
      },
      tz: tzCheck.value,
      prefs: prefsCheck.value as NotificationPrefs,
      manageTokenHash,
      lastSent: existing?.lastSent,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    }

    await subscriptionStore.save(storedSub)
    sendJson(res, 200, { success: true, id: storedSub.id, manageToken })
  } catch (err: unknown) {
    sendEndpointError(res, err)
  }
}
