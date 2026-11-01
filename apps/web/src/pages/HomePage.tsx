import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

const pageStyle: React.CSSProperties = {
  fontFamily: 'sans-serif',
  maxWidth: 480,
  margin: '15vh auto',
  textAlign: 'center',
}

export default function HomePage() {
  const { user, loading, logout } = useAuth()

  if (loading) return <main style={pageStyle}>Loading…</main>
  if (!user) return <Navigate to="/login" replace />

  return (
    <main style={pageStyle}>
      <h1>Pet Care Platform</h1>
      <p>
        You are signed in as <strong>{user.email}</strong>
      </p>
      <p style={{ color: '#777', fontSize: 13 }}>Registered: {new Date(user.createdAt).toLocaleString()}</p>
      <button
        onClick={logout}
        style={{
          marginTop: 16,
          padding: '10px 24px',
          borderRadius: 6,
          border: '1px solid #c0392b',
          backgroundColor: '#fff',
          color: '#c0392b',
          fontSize: 15,
          cursor: 'pointer',
        }}
      >
        Logout
      </button>
    </main>
  )
}
