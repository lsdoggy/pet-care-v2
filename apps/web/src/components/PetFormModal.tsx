import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api/client'
import type { PetDto, PetSpecies } from '../api/types'
import { PET_SPECIES, SPECIES_LABELS } from '../api/types'

interface Props {
  /** When provided the form edits an existing pet, otherwise it creates a new one. */
  pet?: PetDto
  token: string
  onClose: () => void
  onSaved: (pet: PetDto) => void
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
}

const modalStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: 12,
  padding: 24,
  width: 360,
  maxWidth: '90vw',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 6,
  border: '1px solid #cbd5e1',
  fontSize: 15,
}

export default function PetFormModal({ pet, token, onClose, onSaved }: Props) {
  const [name, setName] = useState(pet?.name ?? '')
  const [species, setSpecies] = useState<PetSpecies>(pet?.species ?? 'DOG')
  const [birthDate, setBirthDate] = useState(pet?.birthDate ?? '')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Name is required')
      return
    }
    if (birthDate && new Date(birthDate).getTime() > Date.now()) {
      setError('Birth date cannot be in the future')
      return
    }

    setSaving(true)
    try {
      let saved: PetDto
      if (pet) {
        saved = await api.updatePet(pet.id, { name: name.trim(), species, birthDate: birthDate || undefined }, token)
        if (photoFile) {
          saved = await api.uploadPetPhoto(saved.id, photoFile, token)
        }
      } else {
        saved = await api.createPet({ name: name.trim(), species, birthDate: birthDate || undefined }, token)
        if (photoFile) {
          saved = await api.uploadPetPhoto(saved.id, photoFile, token)
        }
      }
      onSaved(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: 0, fontSize: 20 }}>{pet ? 'Edit pet' : 'Add pet'}</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label>
            Name *
            <input
              style={{ ...inputStyle, width: '100%', marginTop: 4, display: 'block' }}
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              placeholder="Rex"
              autoFocus
            />
          </label>

          <label>
            Species
            <select
              style={{ ...inputStyle, width: '100%', marginTop: 4, display: 'block' }}
              value={species}
              onChange={(e) => setSpecies(e.target.value as PetSpecies)}
            >
              {PET_SPECIES.map((s) => (
                <option key={s} value={s}>
                  {SPECIES_LABELS[s]}
                </option>
              ))}
            </select>
          </label>

          <label>
            Birth date
            <input
              style={{ ...inputStyle, width: '100%', marginTop: 4, display: 'block' }}
              type="date"
              value={birthDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </label>

          <label>
            Photo
            <input
              style={{ ...inputStyle, width: '100%', marginTop: 4, display: 'block' }}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/*"
              onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
            />
          </label>

          {error && <p style={{ color: '#c0392b', margin: 0, fontSize: 14 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ ...inputStyle, cursor: 'pointer' }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{ ...inputStyle, cursor: 'pointer', backgroundColor: '#4f46e5', color: '#fff', border: 'none' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
