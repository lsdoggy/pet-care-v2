import { useEffect, useState } from 'react'

/** Local presentation clock: no network requests on ticks or foreground. */
export function useDashboardNow() {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const update = () => {
      if (document.visibilityState !== 'hidden') setNow(Date.now())
    }
    const timer = window.setInterval(update, 60_000)
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])
  return now
}
