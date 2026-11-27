import type { IncomingMessage, ServerResponse } from 'http'
import { subscriptionStore } from './kv.js'
import {
  extractBearerToken,
  readJsonBody,
  sendEndpointError,
  sendJson,
  verifyManageToken,
} from './_utils.js'
import { validatePushEndpoint } from '../src/core/notifications/validation.js'

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

    const existing = await subscriptionStore.get(endpointCheck.value)
    if (!existing) {
      sendJson(res, 404, { error: 'Subscription not found' })
      return
    }

    if (!verifyManageToken(token, existing.manageTokenHash)) {
      sendJson(res, 401, { error: 'Invalid manage token' })
      return
    }

    await subscriptionStore.remove(endpointCheck.value)
    sendJson(res, 200, { success: true })
  } catch (err: unknown) {
    sendEndpointError(res, err)
  }
}
