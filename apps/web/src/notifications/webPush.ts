import { api } from '../api/client'

export function isInstalledWebApp() {
  return window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function canUseWebPush() {
  return window.isSecureContext && 'serviceWorker' in navigator &&
    'PushManager' in window && 'Notification' in window
}

export function registerPushWorker() {
  return navigator.serviceWorker.register('/push-worker.js').then(() => navigator.serviceWorker.ready)
}

export function decodeVapidKey(publicKey: string) {
  const encoded = publicKey.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0))
}

export async function disconnectWebPush(token: string) {
  if (!canUseWebPush()) return

  const controller = new AbortController()
  let timer: number | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => {
      controller.abort()
      reject(new Error('Web Push cleanup timed out'))
    }, 5000)
  })

  async function disconnect() {
    const registration = await navigator.serviceWorker.getRegistration('/')
    const subscription = await registration?.pushManager.getSubscription()
    if (!subscription || controller.signal.aborted) return

    await Promise.any([
      api.unsubscribeFromWebPush(subscription.endpoint, token, controller.signal),
      subscription.unsubscribe().then((removed) => {
        if (!removed) throw new Error('Could not unsubscribe this browser')
      }),
    ])
  }

  try {
    await Promise.race([disconnect(), timeout])
  } finally {
    window.clearTimeout(timer)
  }
}
