// @vitest-environment node

import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, it, vi } from 'vitest'

const worker = readFileSync(new URL('../public/push-worker.js', import.meta.url), 'utf8')

function startWorker(windows: { url: string; focus: () => void }[] = []) {
  const handlers = new Map()
  const showNotification = vi.fn()
  const openWindow = vi.fn()
  runInNewContext(worker, {
    URL,
    self: {
      addEventListener: (name: string, handler: unknown) => handlers.set(name, handler),
      location: { origin: 'https://petcare.example.test' },
      registration: { showNotification },
      clients: { matchAll: () => Promise.resolve(windows), openWindow },
    },
  })
  return { handlers, showNotification, openWindow }
}

it('uses neutral text and does not read a push payload', () => {
  const { handlers, showNotification } = startWorker()
  handlers.get('push')({
    waitUntil: vi.fn(),
    get data() { throw new Error('Unexpected payload access') },
  })
  expect(showNotification).toHaveBeenCalledWith('Pet Care', {
    body: 'Откройте Pet Care, чтобы посмотреть напоминания.',
    icon: '/icon-192.png',
  })
})

it('opens the same-origin home page and ignores URLs supplied in notification data', async () => {
  const { handlers, openWindow } = startWorker()
  const notification = { close: vi.fn(), data: { url: 'https://elsewhere.example.test/' } }
  const waitUntil = vi.fn()
  handlers.get('notificationclick')({ notification, waitUntil })
  await waitUntil.mock.calls[0][0]
  expect(notification.close).toHaveBeenCalled()
  expect(openWindow).toHaveBeenCalledWith('https://petcare.example.test/')
})
