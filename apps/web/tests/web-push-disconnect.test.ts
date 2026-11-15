import { afterEach, expect, it, vi } from 'vitest'
import { disconnectWebPush } from '../src/notifications/webPush'

function mockBrowser(getRegistration: () => Promise<unknown>) {
  vi.stubGlobal('isSecureContext', true)
  vi.stubGlobal('PushManager', class {})
  vi.stubGlobal('Notification', class {})
  vi.stubGlobal('navigator', { serviceWorker: { getRegistration } })
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('bounds cleanup even when the browser never reports its service worker', async () => {
  vi.useFakeTimers()
  mockBrowser(() => new Promise(() => {}))
  const cleanup = expect(disconnectWebPush('session')).rejects.toThrow('timed out')

  await vi.advanceTimersByTimeAsync(5000)
  await cleanup
})

it('treats server removal as sufficient when the browser unsubscribe hangs', async () => {
  const unsubscribe = vi.fn(() => new Promise(() => {}))
  mockBrowser(async () => ({
    pushManager: {
      getSubscription: async () => ({ endpoint: 'https://web.push.apple.com/test', unsubscribe }),
    },
  }))
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))

  await expect(disconnectWebPush('session')).resolves.toBeUndefined()
  expect(unsubscribe).toHaveBeenCalledOnce()
})
