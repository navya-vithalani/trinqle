import type {
  NotificationPrefs,
  PushSubscriptionData,
} from './types'
import { DEFAULT_NOTIFICATION_PREFS } from './types'
import { urlBase64ToUint8Array } from './vapid'

const PREFS_STORAGE_KEY = 'trinqle_notification_prefs'

export const DEFAULT_VAPID_PUBLIC_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_VAPID_PUBLIC_KEY) ||
  'BFZvPtD4Cfa57rkA2P4PCQpR70NRK5n4eP2Q3hlTvYs5EGc_nr9-N0RvxAPxoggbHQo1SnBRDCFiAxNIlVEs7FM'

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
  vapidPublicKey: string,
  prefs: NotificationPrefs = loadNotificationPrefs()
): Promise<{ success: boolean; error?: string; subscription?: PushSubscriptionData }> {
  if (!isPushSupported()) {
    return { success: false, error: 'Web Push is not supported on this browser' }
  }

  const permission = await requestNotificationPermission()
  if (permission !== 'granted') {
    return { success: false, error: 'Notification permission was not granted' }
  }

  try {
    const registration = await navigator.serviceWorker.ready
    const convertedKey = urlBase64ToUint8Array(vapidPublicKey)

    const rawSub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedKey as unknown as BufferSource,
    })

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

    // Register with server API
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
      const errText = await response.text().catch(() => '')
      return { success: false, error: errText || `Server responded with ${response.status}` }
    }

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
 * Unsubscribes the current device from Web Push and removes from /api/unsubscribe.
 */
export async function unsubscribeDeviceFromPush(): Promise<{ success: boolean; error?: string }> {
  if (!isPushSupported()) return { success: true }

  try {
    const registration = await navigator.serviceWorker.ready
    const rawSub = await registration.pushManager.getSubscription()

    if (rawSub) {
      const endpoint = rawSub.endpoint
      await rawSub.unsubscribe()

      await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      }).catch(() => {})
    }

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

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

  try {
    const response = await fetch('/api/prefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        tz,
        prefs,
      }),
    })

    if (!response.ok) {
      return { success: false, error: 'Failed to update preferences on server' }
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
 * Sends a test push notification to this device via /api/send.
 */
export async function sendTestNotification(): Promise<{ success: boolean; error?: string }> {
  const sub = await getCurrentPushSubscription()
  if (!sub) {
    return { success: false, error: 'No active push subscription on this device' }
  }

  try {
    const response = await fetch('/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        test: true,
        endpoint: sub.endpoint,
      }),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      return { success: false, error: errText || `Failed with status ${response.status}` }
    }

    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to send test notification',
    }
  }
}
