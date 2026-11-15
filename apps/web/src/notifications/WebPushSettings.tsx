import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { tokenStore } from '../auth/tokenStore'
import { useLanguage } from '../i18n/language'
import { canUseWebPush, decodeVapidKey, disconnectWebPush, isInstalledWebApp, registerPushWorker } from './webPush'

type Setup = { registration: ServiceWorkerRegistration; key: Uint8Array<ArrayBuffer> }
type State = { status: 'loading' | 'unavailable' | 'error' } |
  { status: 'enabled' | 'disabled'; setup: Setup }

export default function WebPushSettings({ busy, enabled, onBusyChange }: {
  busy: boolean
  enabled: boolean
  onBusyChange: (busy: boolean) => void
}) {
  const { language } = useLanguage()
  const ru = language === 'ru'
  const [state, setState] = useState<State>({ status: 'loading' })
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const installed = isInstalledWebApp()
  const supported = installed && canUseWebPush() && navigator.vendor === 'Apple Computer, Inc.'

  useEffect(() => {
    const token = tokenStore.get()
    if (!supported || !token) return
    let active = true
    async function load(token: string) {
      const config = await api.webPushConfig(token)
      if (!config.publicKey) {
        if (active) setState({ status: 'unavailable' })
        return
      }
      const registration = await registerPushWorker()
      const subscription = await registration.pushManager.getSubscription()
      let subscribed = false
      if (subscription) {
        const status = await api.webPushStatus(subscription.endpoint, token)
        subscribed = status.subscribed
        // Recreate orphaned subscriptions only on the next explicit enable action.
        if (!subscribed && active) await subscription.unsubscribe()
      }
      if (active) setState({
        status: subscribed ? 'enabled' : 'disabled',
        setup: { registration, key: decodeVapidKey(config.publicKey) },
      })
    }
    void load(token).catch(() => {
      if (active) setState({ status: 'error' })
    })
    return () => { active = false }
  }, [supported, attempt])

  async function toggle() {
    const token = tokenStore.get()
    if (!token || !('setup' in state)) return
    onBusyChange(true)
    setError(false)
    try {
      if (state.status === 'enabled') {
        await disconnectWebPush(token)
        setState({ status: 'disabled', setup: state.setup })
      } else {
        // Safari requires subscribe() to run directly in the click gesture.
        const subscription = await state.setup.registration.pushManager.subscribe({
          applicationServerKey: state.setup.key,
          userVisibleOnly: true,
        })
        try {
          await api.subscribeToWebPush(subscription.endpoint, token)
        } catch (registrationError) {
          await subscription.unsubscribe()
          throw registrationError
        }
        setState({ status: 'enabled', setup: state.setup })
      }
    } catch {
      setError(true)
    } finally {
      onBusyChange(false)
    }
  }

  if (!installed) return <p className="pc-settings__hint">
    {ru ? 'Для уведомлений на iPhone добавьте Pet Care на экран «Домой» через Safari и откройте его с иконки.'
      : 'For iPhone notifications, add Pet Care to your Home Screen in Safari and open it from the icon.'}
  </p>
  if (!supported || state.status === 'unavailable') return null
  if (state.status === 'loading') return <p role="status">{ru ? 'Проверяем Web Push…' : 'Checking Web Push…'}</p>
  if (state.status === 'error') return <div>
    <p role="alert">{ru ? 'Не удалось проверить Web Push.' : 'Could not check Web Push.'}</p>
    <button className="pc-btn" type="button" disabled={busy} onClick={() => {
      setState({ status: 'loading' })
      setAttempt((value) => value + 1)
    }}>{ru ? 'Повторить' : 'Retry'}</button>
  </div>

  return <div>
    <button className="pc-btn" type="button" disabled={busy || (!enabled && state.status === 'disabled')}
      onClick={() => void toggle()}>
      {state.status === 'enabled' ? (ru ? 'Отключить Web Push' : 'Disable Web Push')
        : (ru ? 'Включить Web Push на этом устройстве' : 'Enable Web Push on this device')}
    </button>
    {error && <p role="alert">{Notification.permission === 'denied'
      ? (ru ? 'Разрешите уведомления Pet Care в настройках iPhone.' : 'Allow Pet Care notifications in iPhone Settings.')
      : (ru ? 'Не удалось изменить подписку. Повторите попытку.' : 'Could not update the subscription. Try again.')}</p>}
  </div>
}
