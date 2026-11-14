import { usePetPhoto } from '../lib/usePetPhoto'
import { useLanguage } from '../i18n/language'
import type { PetDto, CareTaskDto, VetAppointmentDto } from '../api/types'
import { ENGLISH_SPECIES_LABELS, SPECIES_LABELS } from '../api/types'
import { formatPetAge, formatPetWeight, formatPetBreed, findNextPetAction, petInitials } from '../lib/petFormat'
import { speciesGlyph } from './icons'

/**
 * Design Sprint 3 · Pets — карточка питомца в списке (требование 2).
 *
 * Presentational-компонент: фото/placeholder → имя → вид → порода → возраст →
 * вес → следующая задача. Данные питомца приходят из HomePage.
 */

interface Props {
  pet: PetDto
  tasks: CareTaskDto[]
  appointments: VetAppointmentDto[]
  onOpen: (pet: PetDto) => void
}

export default function PetCard({ pet, tasks, appointments, onOpen }: Props) {
  const { language } = useLanguage()
  const speciesLabels = language === 'ru' ? SPECIES_LABELS : ENGLISH_SPECIES_LABELS
  const photo = usePetPhoto(pet.photoUrl)
  const next = findNextPetAction(pet.id, tasks, appointments)

  const facts: Array<{ label: string; value: string }> = [
    { label: (language === 'ru' ? 'Вид' : 'Species'), value: speciesLabels[pet.species] },
    { label: (language === 'ru' ? 'Порода' : 'Breed'), value: formatPetBreed(pet.breed) },
    { label: (language === 'ru' ? 'Возраст' : 'Age'), value: pet.birthDate ? formatPetAge(pet.birthDate, undefined, language) : '—' },
    { label: (language === 'ru' ? 'Вес' : 'Weight'), value: formatPetWeight(pet.weightKg, language) },
  ]

  const ariaLabel = [
    `${pet.name}`,
    ...facts.map((f) => `${f.label.toLowerCase()}: ${f.value}`),
    next ? `следующая задача: ${next.fullLabel}` : (language === 'ru' ? 'следующих задач нет' : 'no upcoming tasks'),
  ].join(', ')

  return (
    <button type="button" className="pc-petcard" onClick={() => onOpen(pet)} aria-label={ariaLabel}>
      <span
        className={`pc-petcard__avatar${photo ? '' : ' pc-petcard__avatar--initials'}`}
        aria-hidden="true"
      >
        {photo ? <img src={photo} alt="" /> : petInitials(pet.name) || speciesGlyph(pet.species)}
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
              <span className="pc-badge pc-badge--primary">{next.kind === 'appointment' ? (language === 'ru' ? 'Визит' : 'Visit') : (language === 'ru' ? 'Задача' : 'Task')}</span>
              <span className="pc-petcard__next-title" title={next.fullLabel}>
                {next.fullLabel}
              </span>
            </>
          ) : (
            <span className="pc-petcard__next-title">{language === 'ru' ? 'Задач не запланировано' : 'No tasks scheduled'}</span>
          )}
        </span>
      </span>
    </button>
  )
}
