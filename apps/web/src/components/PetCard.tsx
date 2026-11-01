import type { PetDto } from '../api/types'
import { SPECIES_LABELS } from '../api/types'

interface Props {
  pet: PetDto
  onClick: (id: number) => void
}

const cardStyle: React.CSSProperties = {
  width: 180,
  border: '1px solid #e2e4ee',
  borderRadius: 12,
  padding: 12,
  cursor: 'pointer',
  backgroundColor: '#fff',
  textAlign: 'left',
}

export default function PetCard({ pet, onClick }: Props) {
  return (
    <button type="button" style={cardStyle} onClick={() => onClick(pet.id)}>
      <div
        style={{
          width: '100%',
          height: 120,
          borderRadius: 8,
          overflow: 'hidden',
          backgroundColor: '#eef0f7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
        }}
      >
        {pet.photoUrl ? (
          <img src={pet.photoUrl} alt={pet.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: 40 }}>🐾</span>
        )}
      </div>
      <div style={{ fontWeight: 700, fontSize: 16 }}>{pet.name}</div>
      <div style={{ color: '#6b7280', fontSize: 13 }}>{SPECIES_LABELS[pet.species]}</div>
    </button>
  )
}
