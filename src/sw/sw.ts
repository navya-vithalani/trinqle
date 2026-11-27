/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope

// Clean up old precaches
cleanupOutdatedCaches()

// Precache static assets injected by VitePWA / Workbox
precacheAndRoute(self.__WB_MANIFEST || [])

// Push event handler (TRD Section 10 & PRD 5.9)
self.addEventListener('push', (event: PushEvent) => {
  let title = 'Trinqle'
  let body = "Tonight's journal is ready."
  let url = '/'
  let tag = 'trinqle-notification'

  if (event.data) {
    try {
      const data = event.data.json()
      if (data.title) title = data.title
      if (data.body) body = data.body
      if (data.url) url = data.url
      if (data.tag) tag = data.tag
    } catch {
      const text = event.data.text()
      if (text) body = text
    }
  }

  // Generic notifications with monochrome transparent badge & re-alert options
  const notificationOptions: NotificationOptions & {
    renotify?: boolean
    vibrate?: number[]
  } = {
    body,
    icon: '/pwa-192x192.png',
    badge: '/badge-96x96.png',
    tag,
    renotify: true,
    silent: false,
    vibrate: [200, 100, 200],
    data: { url },
  }

  event.waitUntil(self.registration.showNotification(title, notificationOptions))
})

// Notification click handler
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()

  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })

      // Focus existing open window if available
      for (const client of windowClients) {
        if ('focus' in client && client.url.includes(self.location.origin)) {
          await client.navigate(targetUrl)
          await client.focus()
          return
        }
      }

      // Otherwise open new window
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl)
      }
    })()
  )
})

// Message handler for service worker updates (skip waiting)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// Push subscription rotation handler: notify active windows or re-subscribe with prior key
interface PushSubscriptionChangeEvent extends ExtendableEvent {
  oldSubscription?: PushSubscription
  newSubscription?: PushSubscription
}

self.addEventListener('pushsubscriptionchange', (event: Event) => {
  const changeEvent = event as PushSubscriptionChangeEvent
  changeEvent.waitUntil(
    (async () => {
      try {
        let nextSub = changeEvent.newSubscription
        const appKey = changeEvent.oldSubscription?.options?.applicationServerKey
        if (!nextSub && appKey) {
          nextSub = await self.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: appKey,
          })
        }

        const windowClients = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        })
        for (const client of windowClients) {
          client.postMessage({
            type: 'PUSH_SUBSCRIPTION_CHANGED',
            endpoint: nextSub?.endpoint || null,
          })
        }
      } catch (err) {
        console.error('[sw] pushsubscriptionchange failed:', err)
      }
    })()
  )
})
