import { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { PetDto } from '../api/types'
import { useAuth } from '../auth/useAuth'
import { tokenStore } from '../auth/tokenStore'
import PetCard from '../components/PetCard'
import PetFormModal from '../components/PetFormModal'

const pageStyle: React.CSSProperties = {
  fontFamily: 'sans-serif',
  maxWidth: 860,
  margin: '6vh auto',
  padding: '0 16px',
}

const ghostBtn: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 6,
  border: '1px solid #c0392b',
  backgroundColor: '#fff',
  color: '#c0392b',
  fontSize: 14,
  cursor: 'pointer',
}

export default function HomePage() {
  const { user, loading, logout } = useAuth()
  const navigate = useNavigate()
  const [pets, setPets] = useState<PetDto[]>([])
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadPets = useCallback(() => {
    const token = tokenStore.get()
    if (!token) return
    api
      .listPets(token)
      .then((list) => {
        setPets(list)
        setError(null)
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load pets'))
  }, [])

  useEffect(() => {
    if (user) loadPets()
  }, [user, loadPets])

  if (loading) return <main style={pageStyle}>Loading…</main>
  if (!user) return <Navigate to="/login" replace />

  return (
    <main style={pageStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 26 }}>My pets</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: '#6b7280', fontSize: 14 }}>{user.email}</span>
          <button onClick={logout} style={ghostBtn}>
            Logout
          </button>
        </div>
      </div>

      {error && <p style={{ color: '#c0392b' }}>{error}</p>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 24 }}>
        {pets.map((pet) => (
          <PetCard key={pet.id} pet={pet} onClick={(id) => navigate(`/pets/${id}`)} />
        ))}

        <button
          type="button"
          onClick={() => setShowForm(true)}
          aria-label="Add pet"
          style={{
            width: 180,
            height: 190,
            borderRadius: 12,
            border: '2px dashed #cbd5e1',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            fontSize: 40,
            color: '#94a3b8',
          }}
        >
          +
        </button>
      </div>

      {pets.length === 0 && !error && (
        <p style={{ color: '#6b7280', marginTop: 16 }}>No pets yet. Click “+” to add your first pet.</p>
      )}

      {showForm && (
        <PetFormModal
          token={tokenStore.get() ?? ''}
          onClose={() => setShowForm(false)}
          onSaved={(saved) => {
            setPets((prev) => [...prev, saved])
            setShowForm(false)
          }}
        />
      )}
    </main>
  )
}
