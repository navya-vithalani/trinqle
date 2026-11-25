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

  // Generic notifications with semantic logo icon
  const notificationOptions: NotificationOptions = {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-64x64.png',
    tag,
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
