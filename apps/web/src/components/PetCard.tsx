import type { PetDto, CareTaskDto, VetAppointmentDto } from '../api/types'
import { SPECIES_LABELS } from '../api/types'
import { formatPetAge, formatPetWeight, formatPetBreed, findNextPetAction, petInitials } from '../lib/petFormat'
import { speciesGlyph } from './icons'

/**
 * Design Sprint 3 · Pets — карточка питомца в списке (требование 2).
 *
 * Presentational-компонент: фото/placeholder → имя → вид → порода → возраст →
 * вес → следующая задача. Никаких сетевых вызовов — данные приходят из HomePage
 * (существующие эндпоинты listPets / listUpcomingTasks / listAppointments).
 */

interface Props {
  pet: PetDto
  tasks: CareTaskDto[]
  appointments: VetAppointmentDto[]
  onOpen: (pet: PetDto) => void
}

export default function PetCard({ pet, tasks, appointments, onOpen }: Props) {
  const next = findNextPetAction(pet.id, tasks, appointments)

  const facts: Array<{ label: string; value: string }> = [
    { label: 'Вид', value: SPECIES_LABELS[pet.species] },
    { label: 'Порода', value: formatPetBreed(pet.breed) },
    { label: 'Возраст', value: pet.birthDate ? formatPetAge(pet.birthDate) : '—' },
    { label: 'Вес', value: formatPetWeight(pet.weightKg) },
  ]

  const ariaLabel = [
    `${pet.name}`,
    ...facts.map((f) => `${f.label.toLowerCase()}: ${f.value}`),
    next ? `следующая задача: ${next.fullLabel}` : 'следующих задач нет',
  ].join(', ')

  return (
    <button type="button" className="pc-petcard" onClick={() => onOpen(pet)} aria-label={ariaLabel}>
      <span
        className={`pc-petcard__avatar${pet.photoUrl ? '' : ' pc-petcard__avatar--initials'}`}
        aria-hidden="true"
      >
        {pet.photoUrl ? <img src={pet.photoUrl} alt="" /> : petInitials(pet.name) || speciesGlyph(pet.species)}
      </span>

      <span className="pc-petcard__body">
        <span className="pc-petcard__name">{pet.name}</span>

        <span className="pc-petcard__facts">
          {facts.map((f) => (
            <span key={f.label} className="pc-petcard__fact">
              <span className="pc-petcard__fact-label">{f.label}:</span>
              {f.value}
            </span>
          ))}
        </span>

        <span className="pc-petcard__next">
          {next ? (
            <>
              <span className="pc-badge pc-badge--primary">{next.kind === 'appointment' ? 'Визит' : 'Задача'}</span>
              <span className="pc-petcard__next-title" title={next.fullLabel}>
                {next.fullLabel}
              </span>
            </>
          ) : (
            <span className="pc-petcard__next-title">Задач не запланировано</span>
          )}
        </span>
      </span>
    </button>
  )
}
