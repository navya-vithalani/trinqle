import { DEFAULT_NOTIFICATION_PREFS, type NotificationPrefs, type PushSubscriptionKeys } from './types'
import { urlBase64ToUint8Array } from './vapid'

const ALLOWED_PUSH_HOSTS = new Set([
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
])

const BASE64URL_RE = /^[A-Za-z0-9_-]+={0,2}$/
const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/
const YYYYMMDD_RE = /^\d{4}-\d{2}-\d{2}$/

export interface ValidationFailure {
  ok: false
  error: string
}

export interface ValidationSuccess<T> {
  ok: true
  value: T
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure

/**
 * Validates that a Web Push endpoint uses HTTPS and belongs to a known push service host.
 * Rejects private/internal URLs to prevent SSRF from /api/send.
 */
export function validatePushEndpoint(endpoint: unknown): ValidationResult<string> {
  if (typeof endpoint !== 'string') {
    return { ok: false, error: 'Subscription endpoint must be a string' }
  }
  const trimmed = endpoint.trim()
  if (trimmed.length === 0 || trimmed.length > 2048) {
    return { ok: false, error: 'Invalid subscription endpoint length' }
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { ok: false, error: 'Malformed subscription endpoint URL' }
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, error: 'Subscription endpoint must use https' }
  }
  if (parsed.username || parsed.password || parsed.port !== '') {
    return { ok: false, error: 'Subscription endpoint contains disallowed URL components' }
  }
  if ((!parsed.pathname || parsed.pathname === '/') && !parsed.search) {
    return { ok: false, error: 'Subscription endpoint path is missing' }
  }

  const host = parsed.hostname.toLowerCase()
  const isAllowedHost =
    ALLOWED_PUSH_HOSTS.has(host) ||
    (host.endsWith('.notify.windows.com') && host.length > '.notify.windows.com'.length)

  if (!isAllowedHost) {
    return { ok: false, error: `Unsupported push endpoint host: ${host}` }
  }

  return { ok: true, value: trimmed }
}

/**
 * Validates Web Push ECDH public key (65 bytes) and auth secret (16 bytes).
 */
export function validatePushKeys(keys: unknown): ValidationResult<PushSubscriptionKeys> {
  if (!keys || typeof keys !== 'object') {
    return { ok: false, error: 'Missing push subscription keys' }
  }
  const record = keys as Record<string, unknown>
  const p256dh = record.p256dh
  const auth = record.auth

  if (typeof p256dh !== 'string' || typeof auth !== 'string') {
    return { ok: false, error: 'Push keys must be strings' }
  }
  if (!BASE64URL_RE.test(p256dh) || !BASE64URL_RE.test(auth)) {
    return { ok: false, error: 'Push keys must be valid base64url strings' }
  }

  try {
    const p256dhBytes = urlBase64ToUint8Array(p256dh)
    const authBytes = urlBase64ToUint8Array(auth)
    if (p256dhBytes.length !== 65) {
      return { ok: false, error: 'Invalid p256dh key length (expected 65 bytes)' }
    }
    if (authBytes.length !== 16) {
      return { ok: false, error: 'Invalid auth key length (expected 16 bytes)' }
    }
    return { ok: true, value: { p256dh, auth } }
  } catch {
    return { ok: false, error: 'Failed to decode push subscription keys' }
  }
}

/**
 * Validates an IANA timezone identifier via Intl.DateTimeFormat.
 */
export function validateTimeZone(tz: unknown): ValidationResult<string> {
  if (typeof tz !== 'string') {
    return { ok: false, error: 'Timezone must be a string' }
  }
  const trimmed = tz.trim()
  if (!trimmed || trimmed.length > 80) {
    return { ok: false, error: 'Invalid timezone identifier' }
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: trimmed })
    return { ok: true, value: trimmed }
  } catch {
    return { ok: false, error: `Invalid IANA timezone: ${trimmed}` }
  }
}

/**
 * Strictly parses and whitelists NotificationPrefs fields (no arbitrary object spreading).
 */
export function sanitizeNotificationPrefs(
  raw: unknown,
  options: { partial?: boolean } = {}
): ValidationResult<Partial<NotificationPrefs>> {
  if (raw === undefined) {
    if (options.partial) {
      return { ok: false, error: 'Missing notification preferences' }
    }
    return { ok: true, value: { ...DEFAULT_NOTIFICATION_PREFS } }
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Notification preferences must be an object' }
  }

  const input = raw as Record<string, unknown>
  const out: Partial<NotificationPrefs> = {}

  if ('dailyReminder' in input && input.dailyReminder !== undefined) {
    if (typeof input.dailyReminder !== 'boolean') {
      return { ok: false, error: 'dailyReminder must be a boolean' }
    }
    out.dailyReminder = input.dailyReminder
  } else if (!options.partial) {
    out.dailyReminder = DEFAULT_NOTIFICATION_PREFS.dailyReminder
  }

  if ('dailyReminderTime' in input && input.dailyReminderTime !== undefined) {
    if (typeof input.dailyReminderTime !== 'string' || !HHMM_RE.test(input.dailyReminderTime)) {
      return { ok: false, error: 'dailyReminderTime must be HH:MM' }
    }
    out.dailyReminderTime = input.dailyReminderTime
  } else if (!options.partial) {
    out.dailyReminderTime = DEFAULT_NOTIFICATION_PREFS.dailyReminderTime
  }

  if ('mondayInsights' in input && input.mondayInsights !== undefined) {
    if (typeof input.mondayInsights !== 'boolean') {
      return { ok: false, error: 'mondayInsights must be a boolean' }
    }
    out.mondayInsights = input.mondayInsights
  } else if (!options.partial) {
    out.mondayInsights = DEFAULT_NOTIFICATION_PREFS.mondayInsights
  }

  if ('mondayInsightsTime' in input && input.mondayInsightsTime !== undefined) {
    if (typeof input.mondayInsightsTime !== 'string' || !HHMM_RE.test(input.mondayInsightsTime)) {
      return { ok: false, error: 'mondayInsightsTime must be HH:MM' }
    }
    out.mondayInsightsTime = input.mondayInsightsTime
  } else if (!options.partial) {
    out.mondayInsightsTime = DEFAULT_NOTIFICATION_PREFS.mondayInsightsTime
  }

  if ('chapterEnding' in input && input.chapterEnding !== undefined) {
    if (typeof input.chapterEnding !== 'boolean') {
      return { ok: false, error: 'chapterEnding must be a boolean' }
    }
    out.chapterEnding = input.chapterEnding
  } else if (!options.partial) {
    out.chapterEnding = DEFAULT_NOTIFICATION_PREFS.chapterEnding
  }

  if ('chapterPlannedEndDate' in input && input.chapterPlannedEndDate !== undefined) {
    if (input.chapterPlannedEndDate === '') {
      out.chapterPlannedEndDate = undefined
    } else if (
      typeof input.chapterPlannedEndDate !== 'string' ||
      !YYYYMMDD_RE.test(input.chapterPlannedEndDate)
    ) {
      return { ok: false, error: 'chapterPlannedEndDate must be YYYY-MM-DD' }
    } else {
      out.chapterPlannedEndDate = input.chapterPlannedEndDate
    }
  }

  if (options.partial && Object.keys(out).length === 0) {
    return { ok: false, error: 'No recognized preference fields provided' }
  }

  return { ok: true, value: out }
}
