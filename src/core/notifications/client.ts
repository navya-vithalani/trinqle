import type {
  NotificationPrefs,
  PushSubscriptionData,
} from './types.js'
import { DEFAULT_NOTIFICATION_PREFS } from './types.js'
import { urlBase64ToUint8Array } from './vapid.js'

const PREFS_STORAGE_KEY = 'trinqle_notification_prefs'
const MANAGE_TOKEN_STORAGE_KEY = 'trinqle_push_manage_token'
const VAPID_KEY_USED_STORAGE_KEY = 'trinqle_vapid_public_key_used'

/**
 * Reads VITE_VAPID_PUBLIC_KEY and fails closed if unset (never falls back to a leaked key).
 */
export function getVapidPublicKey(): string {
  const key =
    typeof import.meta !== 'undefined' ? import.meta.env?.VITE_VAPID_PUBLIC_KEY?.trim() : ''
  if (!key) {
    throw new Error('VITE_VAPID_PUBLIC_KEY environment variable is not configured')
  }
  return key
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export function getNotificationPermission(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied'
  }
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) return 'denied'
  return Notification.requestPermission()
}

export function loadNotificationPrefs(): NotificationPrefs {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY)
    if (raw) {
      return { ...DEFAULT_NOTIFICATION_PREFS, ...JSON.parse(raw) }
    }
  } catch {
    // Ignore storage parse errors
  }
  return { ...DEFAULT_NOTIFICATION_PREFS }
}

export function saveNotificationPrefs(prefs: NotificationPrefs): void {
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Ignore storage write errors
  }
}

export function loadManageToken(): string | null {
  try {
    return localStorage.getItem(MANAGE_TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

function saveManageToken(token: string): void {
  try {
    localStorage.setItem(MANAGE_TOKEN_STORAGE_KEY, token)
  } catch {
    // Ignore storage errors
  }
}

function clearManageCredentials(): void {
  try {
    localStorage.removeItem(MANAGE_TOKEN_STORAGE_KEY)
    localStorage.removeItem(VAPID_KEY_USED_STORAGE_KEY)
  } catch {
    // Ignore storage errors
  }
}

export function loadVapidPublicKeyUsed(): string | null {
  try {
    return localStorage.getItem(VAPID_KEY_USED_STORAGE_KEY)
  } catch {
    return null
  }
}

function saveVapidPublicKeyUsed(key: string): void {
  try {
    localStorage.setItem(VAPID_KEY_USED_STORAGE_KEY, key)
  } catch {
    // Ignore storage errors
  }
}

export async function extractResponseError(res: Response): Promise<string> {
  const fallback = `Server responded with HTTP ${res.status}`
  try {
    const raw = (await res.text()).trim()
    if (!raw) return fallback
    try {
      const parsed = JSON.parse(raw) as { error?: unknown; message?: unknown }
      if (typeof parsed.error === 'string' && parsed.error.trim()) {
        return `HTTP ${res.status}: ${parsed.error}`
      }
      if (typeof parsed.message === 'string' && parsed.message.trim()) {
        return `HTTP ${res.status}: ${parsed.message}`
      }
    } catch {
      // Non-JSON response body (e.g. Vercel runtime crash page or proxy error)
    }
    const compact = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    return compact ? `HTTP ${res.status}: ${compact.slice(0, 180)}` : fallback
  } catch {
    return fallback
  }
}

export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null
  try {
    const registration = await navigator.serviceWorker.ready
    return registration.pushManager.getSubscription()
  } catch {
    return null
  }
}

/**
 * Subscribes the current device to Web Push and registers with /api/subscribe.
 */
export async function subscribeDeviceToPush(
  vapidPublicKey?: string,
  prefs: NotificationPrefs = loadNotificationPrefs()
): Promise<{ success: boolean; error?: string; subscription?: PushSubscriptionData }> {
  if (!isPushSupported()) {
    return { success: false, error: 'Web Push is not supported on this browser' }
  }

  let resolvedKey: string
  try {
    resolvedKey = vapidPublicKey?.trim() || getVapidPublicKey()
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Push notifications are not configured on this server',
    }
  }

  const permission = await requestNotificationPermission()
  if (permission !== 'granted') {
    return { success: false, error: 'Notification permission was not granted' }
  }

  try {
    const registration = await navigator.serviceWorker.ready
    const convertedKey = urlBase64ToUint8Array(resolvedKey)

    const existingSub = await registration.pushManager.getSubscription()
    if (existingSub && loadVapidPublicKeyUsed() !== resolvedKey) {
      await existingSub.unsubscribe().catch(() => {})
    }

    const rawSub =
      (await registration.pushManager.getSubscription()) ||
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey as unknown as BufferSource,
      }))

    const subJson = rawSub.toJSON()
    if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
      return { success: false, error: 'Malformed push subscription keys' }
    }

    const subData: PushSubscriptionData = {
      endpoint: subJson.endpoint,
      keys: {
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth,
      },
      expirationTime: subJson.expirationTime,
    }

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

    const response = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subData,
        tz,
        prefs,
      }),
    })

    if (!response.ok) {
      const msg = await extractResponseError(response)
      return { success: false, error: msg }
    }

    const payload = (await response.json().catch(() => ({}))) as { manageToken?: string }
    if (typeof payload.manageToken === 'string' && payload.manageToken) {
      saveManageToken(payload.manageToken)
    }
    saveVapidPublicKeyUsed(resolvedKey)
    saveNotificationPrefs(prefs)
    return { success: true, subscription: subData }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Subscription failed',
    }
  }
}

/**
 * Re-subscribes transparently when the configured VAPID public key rotated or
 * the stored manage token is missing. Returns true if still subscribed.
 */
export async function reconcilePushSubscription(): Promise<boolean> {
  const current = await getCurrentPushSubscription()
  if (!current) return false

  let configuredKey: string
  try {
    configuredKey = getVapidPublicKey()
  } catch {
    return false
  }

  const usedKey = loadVapidPublicKeyUsed()
  const manageToken = loadManageToken()
  if (usedKey === configuredKey && manageToken) {
    return true
  }

  if (getNotificationPermission() !== 'granted') {
    return false
  }

  const res = await subscribeDeviceToPush(configuredKey, loadNotificationPrefs())
  return res.success
}

/**
 * Unsubscribes the current device from Web Push and removes from /api/unsubscribe.
 */
export async function unsubscribeDeviceFromPush(): Promise<{ success: boolean; error?: string }> {
  if (!isPushSupported()) return { success: true }

  try {
    const registration = await navigator.serviceWorker.ready
    const rawSub = await registration.pushManager.getSubscription()
    const manageToken = loadManageToken()

    if (rawSub) {
      const endpoint = rawSub.endpoint
      await rawSub.unsubscribe()

      if (manageToken) {
        await fetch('/api/unsubscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${manageToken}`,
          },
          body: JSON.stringify({ endpoint }),
        }).catch(() => {})
      }
    }

    clearManageCredentials()
    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unsubscribe failed',
    }
  }
}

/**
 * Syncs updated notification preferences to /api/prefs.
 */
export async function syncDevicePrefs(
  prefs: NotificationPrefs
): Promise<{ success: boolean; error?: string }> {
  saveNotificationPrefs(prefs)

  const sub = await getCurrentPushSubscription()
  if (!sub) return { success: true }

  const manageToken = loadManageToken()
  if (!manageToken) {
    return {
      success: false,
      error: 'Push credentials outdated — please disable and re-enable notifications',
    }
  }

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

  try {
    const response = await fetch('/api/prefs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${manageToken}`,
      },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        tz,
        prefs,
      }),
    })

    if (!response.ok) {
      const msg = await extractResponseError(response)
      return { success: false, error: msg }
    }

    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error',
    }
  }
}

/**
 * Keeps the active chapter's plannedEndDate synced in push preferences so chapter_ending alerts fire on time.
 */
export async function syncChapterPlannedEndDate(plannedEndDate?: string): Promise<void> {
  const current = loadNotificationPrefs()
  const normalized = plannedEndDate && /^\d{4}-\d{2}-\d{2}$/.test(plannedEndDate)
    ? plannedEndDate
    : undefined
  if (current.chapterPlannedEndDate === normalized) return

  const updated: NotificationPrefs = {
    ...current,
    chapterPlannedEndDate: normalized,
  }
  saveNotificationPrefs(updated)

  const sub = await getCurrentPushSubscription()
  if (sub && loadManageToken()) {
    await syncDevicePrefs(updated).catch(() => {})
  }
}

/**
 * Sends a test push notification to this device via /api/send.
 */
export async function sendTestNotification(): Promise<{ success: boolean; error?: string }> {
  const sub = await getCurrentPushSubscription()
  if (!sub) {
    return { success: false, error: 'No active push subscription on this device' }
  }

  const manageToken = loadManageToken()
  if (!manageToken) {
    return {
      success: false,
      error: 'Push credentials outdated — please disable and re-enable notifications',
    }
  }

  try {
    const response = await fetch('/api/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${manageToken}`,
      },
      body: JSON.stringify({
        test: true,
        endpoint: sub.endpoint,
      }),
    })

    if (!response.ok) {
      const msg = await extractResponseError(response)
      return { success: false, error: msg }
    }

    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to send test notification',
    }
  }
}
