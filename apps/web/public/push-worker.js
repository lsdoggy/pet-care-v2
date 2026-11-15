self.addEventListener('push', (event) => {
  event.waitUntil(self.registration.showNotification('Pet Care', {
    body: 'Откройте Pet Care, чтобы посмотреть напоминания.',
    icon: '/icon-192.png',
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const destination = new URL('/', self.location.origin).href
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = windows.find((client) => client.url === destination)
    if (existing) return existing.focus()
    return self.clients.openWindow(destination)
  })())
})
