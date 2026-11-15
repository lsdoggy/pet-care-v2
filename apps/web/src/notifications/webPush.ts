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
  const registration = await navigator.serviceWorker.getRegistration('/')
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 5000)
  try {
    const outcomes = await Promise.allSettled([
      api.unsubscribeFromWebPush(subscription.endpoint, token, controller.signal),
      subscription.unsubscribe(),
    ])
    if (outcomes.every((outcome) => outcome.status === 'rejected')) {
      throw new Error('Could not disconnect Web Push')
    }
  } finally {
    window.clearTimeout(timer)
  }
}
