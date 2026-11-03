import { useEffect } from 'react'
import type { CSSProperties } from 'react'
import type { PetDto } from '../api/types'
import { SPECIES_LABELS } from '../api/types'
import { speciesGlyph } from './icons'

interface Props {
  pets: PetDto[]
  title: string
  /** Optional hint shown under the title (e.g. why a pet is needed). */
  hint?: string
  onClose: () => void
  onPick: (pet: PetDto) => void
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.5)',
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  zIndex: 150,
}

const modalStyle: CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: '16px 16px 0 0',
  padding: '20px 16px calc(20px + env(safe-area-inset-bottom))',
  width: 480,
  maxWidth: '100vw',
  maxHeight: '80vh',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

/**
 * Design Sprint 2 — bottom-sheet pet picker for dashboard quick actions
 * ("Записать к врачу", "Создать задачу" entry when several pets exist).
 * Presentation only: the chosen pet is handed to the caller's existing form modal.
 */
export default function PetPickerModal({ pets, title, hint, onClose, onPick }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div
        style={modalStyle}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
        {hint && <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>{hint}</p>}
        <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pets.map((pet) => (
            <li key={pet.id}>
              <button
                type="button"
                onClick={() => onPick(pet)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  minHeight: 48,
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: '1px solid #e2e4ee',
                  backgroundColor: '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: 15,
                }}
              >
                <span aria-hidden="true" style={{ fontSize: 24 }}>
                  {speciesGlyph(pet.species)}
                </span>
                <span>
                  <strong>{pet.name}</strong>
                  <span style={{ color: '#64748b', marginLeft: 8, fontSize: 13 }}>{SPECIES_LABELS[pet.species]}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: 8,
            minHeight: 44,
            borderRadius: 10,
            border: '1px solid #cbd5e1',
            backgroundColor: '#fff',
            cursor: 'pointer',
            fontSize: 15,
          }}
        >
          Отмена
        </button>
      </div>
    </div>
  )
}
