import { useEffect, useState } from 'react'

// Ответ эндпоинта GET /api/v1/health
type HealthResponse = {
  status: string
}

// Состояние экрана: ещё проверяем / всё ок / ошибка
type State = 'checking' | 'ok' | 'error'

const boxStyle: React.CSSProperties = {
  fontFamily: 'sans-serif',
  textAlign: 'center',
  marginTop: '20vh',
}

const badgeStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '8px 24px',
  borderRadius: 8,
  fontSize: 24,
  fontWeight: 700,
}

export default function App() {
  const [state, setState] = useState<State>('checking')

  useEffect(() => {
    // Fetch идёт по относительному URL: Vite dev-server проксирует /api на localhost:8080
    fetch('/api/v1/health')
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        return response.json() as Promise<HealthResponse>
      })
      .then((data) => {
        setState(data.status === 'ok' ? 'ok' : 'error')
      })
      .catch(() => {
        setState('error')
      })
  }, [])

  return (
    <main style={boxStyle}>
      <h1>Pet Care Platform — Web Sprint 0</h1>
      {state === 'checking' && <p>Checking backend health…</p>}
      {state === 'ok' && (
        <span style={{ ...badgeStyle, backgroundColor: '#d1f7d1', color: '#1a7a1a' }}>
          OK
        </span>
      )}
      {state === 'error' && (
        <span style={{ ...badgeStyle, backgroundColor: '#f7d1d1', color: '#a11a1a' }}>
          Error
        </span>
      )}
    </main>
  )
}
