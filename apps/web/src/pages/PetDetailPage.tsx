import { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { PetDto } from '../api/types'
import { SPECIES_LABELS } from '../api/types'
import { tokenStore } from '../auth/tokenStore'
import { useAuth } from '../auth/useAuth'
import HealthHistoryTab from '../components/HealthHistoryTab'
import PetFormModal from '../components/PetFormModal'

type DetailTab = 'profile' | 'history'

const pageStyle: React.CSSProperties = {
  fontFamily: 'sans-serif',
  maxWidth: 720,
  margin: '8vh auto',
  padding: '0 16px',
}

export default function PetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { loading } = useAuth()
  const [pet, setPet] = useState<PetDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [tab, setTab] = useState<DetailTab>('profile')

  const load = useCallback(() => {
    const token = tokenStore.get()
    if (!token || !id) return
    api
      .getPet(Number(id), token)
      .then(setPet)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load pet'))
  }, [id])

  useEffect(load, [load])

  async function handleDelete() {
    const token = tokenStore.get()
    if (!token || !pet) return
    if (!window.confirm(`Delete ${pet.name}?`)) return
    try {
      await api.deletePet(pet.id, token)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete pet')
    }
  }

  if (loading) return <main style={pageStyle}>Loading…</main>
  if (!tokenStore.get()) return <Navigate to="/login" replace />

  if (error) {
    return (
      <main style={pageStyle}>
        <p style={{ color: '#c0392b' }}>{error}</p>
        <button onClick={() => navigate('/')}>Back to pets</button>
      </main>
    )
  }

  if (!pet) return <main style={pageStyle}>Loading…</main>

  const tabButtonStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    borderRadius: '6px 6px 0 0',
    border: 'none',
    borderBottom: active ? '2px solid #4f46e5' : '2px solid transparent',
    backgroundColor: 'transparent',
    color: active ? '#4f46e5' : '#64748b',
    fontWeight: active ? 700 : 400,
    cursor: 'pointer',
    fontSize: 15,
  })

  return (
    <main style={pageStyle}>
      <button onClick={() => navigate('/')} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 15 }}>
        ← Back
      </button>
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', marginTop: 16 }}>
        <div
          style={{
            width: 220,
            height: 220,
            borderRadius: 12,
            overflow: 'hidden',
            backgroundColor: '#eef0f7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {pet.photoUrl ? (
            <img src={pet.photoUrl} alt={pet.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 72 }}>🐾</span>
          )}
        </div>
        <div>
          <h1 style={{ margin: '0 0 8px' }}>{pet.name}</h1>
          <p style={{ margin: '4px 0' }}>
            <strong>Species:</strong> {SPECIES_LABELS[pet.species]}
          </p>
          <p style={{ margin: '4px 0' }}>
            <strong>Birth date:</strong> {pet.birthDate ?? 'unknown'}
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
            <button
              onClick={() => setEditing(true)}
              style={{ padding: '8px 20px', borderRadius: 6, border: 'none', backgroundColor: '#4f46e5', color: '#fff', cursor: 'pointer' }}
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              style={{ padding: '8px 20px', borderRadius: 6, border: '1px solid #c0392b', backgroundColor: '#fff', color: '#c0392b', cursor: 'pointer' }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Sprint 4: tabs — Profile / Health History */}
      <div style={{ display: 'flex', gap: 4, marginTop: 32, borderBottom: '1px solid #e2e8f0' }}>
        <button style={tabButtonStyle(tab === 'profile')} onClick={() => setTab('profile')}>
          Profile
        </button>
        <button style={tabButtonStyle(tab === 'history')} onClick={() => setTab('history')}>
          Health History
        </button>
      </div>

      {tab === 'history' && <HealthHistoryTab petId={pet.id} token={tokenStore.get() ?? ''} />}

      {editing && (
        <PetFormModal
          pet={pet}
          token={tokenStore.get() ?? ''}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            setPet(saved)
            setEditing(false)
          }}
        />
      )}
    </main>
  )
}
