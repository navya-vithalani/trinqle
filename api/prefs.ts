import type { IncomingMessage, ServerResponse } from 'http'
import { subscriptionStore } from './kv'
import {
  extractBearerToken,
  readJsonBody,
  sendEndpointError,
  sendJson,
  verifyManageToken,
} from './_utils'
import {
  sanitizeNotificationPrefs,
  validatePushEndpoint,
  validateTimeZone,
} from '../src/core/notifications/validation'

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' })
    return
  }

  try {
    const bodyData = await readJsonBody(req)
    const endpointCheck = validatePushEndpoint(bodyData.endpoint)
    if (!endpointCheck.ok) {
      sendJson(res, 400, { error: endpointCheck.error })
      return
    }

    const token = extractBearerToken(req, bodyData.manageToken)
    if (!token) {
      sendJson(res, 401, { error: 'Authorization token required' })
      return
    }

    let validatedTz: string | undefined
    if (bodyData.tz !== undefined) {
      const tzCheck = validateTimeZone(bodyData.tz)
      if (!tzCheck.ok) {
        sendJson(res, 400, { error: tzCheck.error })
        return
      }
      validatedTz = tzCheck.value
    }

    const prefsCheck = sanitizeNotificationPrefs(bodyData.prefs, { partial: true })
    if (!prefsCheck.ok) {
      sendJson(res, 400, { error: prefsCheck.error })
      return
    }

    const existing = await subscriptionStore.get(endpointCheck.value)
    if (!existing) {
      sendJson(res, 404, { error: 'Subscription not found' })
      return
    }

    if (!verifyManageToken(token, existing.manageTokenHash)) {
      sendJson(res, 401, { error: 'Invalid manage token' })
      return
    }

    await subscriptionStore.updatePrefs(endpointCheck.value, prefsCheck.value, validatedTz)
    sendJson(res, 200, { success: true })
  } catch (err: unknown) {
    sendEndpointError(res, err)
  }
}
