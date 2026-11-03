import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { CareTaskDto, PetDto, VetAppointmentDto } from '../api/types'
import { SPECIES_LABELS } from '../api/types'
import { tokenStore } from '../auth/tokenStore'
import { useAuth } from '../auth/useAuth'
import ConfirmDialog from '../components/ConfirmDialog'
import DashboardSkeleton from '../components/DashboardSkeleton'
import HealthHistoryTab from '../components/HealthHistoryTab'
import PetFormModal from '../components/PetFormModal'
import { PencilIcon, TrashIcon } from '../components/icons'
import {
  EMPTY_VALUE_PLACEHOLDER,
  findNextPetAction,
  formatBirthDateRu,
  formatPetAge,
  formatPetBreed,
  formatPetWeight,
} from '../lib/petFormat'
import '../styles/dashboard.css'
import '../styles/pets.css'

/**
 * Design Sprint 3 · Pets — профиль питомца (web).
 *
 * Точечное обновление без смены бизнес-логики:
 *  - карточка показывает все поля требования 2: фото/placeholder, имя, вид,
 *    порода, возраст, вес, следующая задача (tasks + appointments, существующие GET);
 *  - window.confirm заменён на доступный ConfirmDialog (DELETE /pets/{id} — тот же вызов);
 *  - инлайн-стили → CSS-классы дизайн-системы; тексты — на русском (Sprint 2).
 */

type DetailTab = 'profile' | 'history'

export default function PetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { loading } = useAuth()
  const [pet, setPet] = useState<PetDto | null>(null)
  const [tasks, setTasks] = useState<CareTaskDto[]>([])
  const [appointments, setAppointments] = useState<VetAppointmentDto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [tab, setTab] = useState<DetailTab>('profile')

  const token = tokenStore.get() ?? ''

  const load = useCallback(() => {
    const t = tokenStore.get()
    if (!t || !id) return
    api
      .getPet(Number(id), t)
      .then(setPet)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Не удалось загрузить питомца'))
    // Existing endpoints only — used for the "next action" line of the card.
    api
      .listUpcomingTasks(t)
      .then(setTasks)
      .catch(() => undefined)
    api
      .listAppointments(t)
      .then(setAppointments)
      .catch(() => undefined)
  }, [id])

  useEffect(load, [load])

  async function handleDelete() {
    if (!pet) return
    setDeleting(true)
    try {
      await api.deletePet(pet.id, token)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить питомца')
      setConfirmingDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <DashboardSkeleton />
  if (!tokenStore.get()) return <Navigate to="/login" replace />

  if (error && !pet) {
    return (
      <main className="pc-petdetail">
        <p className="pc-form-status pc-form-status--error" role="alert">
          {error}
        </p>
        <button type="button" className="pc-btn pc-btn--ghost" onClick={() => navigate('/')}>
          ← К списку питомцев
        </button>
      </main>
    )
  }

  if (!pet) return <DashboardSkeleton />

  const next = findNextPetAction(pet.id, tasks, appointments)

  return (
    <main className="pc-petdetail">
      <button type="button" className="pc-linkbtn pc-petdetail__back" onClick={() => navigate('/')}>
        ← К списку питомцев
      </button>

      <div className="pc-petdetail__header">
        <span className="pc-petdetail__avatar" aria-hidden="true">
          {pet.photoUrl ? <img src={pet.photoUrl} alt="" /> : '🐾'}
        </span>
        <div className="pc-petdetail__ident">
          <h1 className="pc-petdetail__name">{pet.name}</h1>
          <dl className="pc-petdetail__facts">
            <FactRow label="Вид" value={SPECIES_LABELS[pet.species]} />
            <FactRow label="Порода" value={formatPetBreed(pet.breed)} />
            <FactRow label="Возраст" value={pet.birthDate ? formatPetAge(pet.birthDate) : EMPTY_VALUE_PLACEHOLDER} />
            <FactRow label="Дата рождения" value={formatBirthDateRu(pet.birthDate)} />
            <FactRow label="Вес" value={formatPetWeight(pet.weightKg)} />
            <FactRow label="Следующая задача" value={next ? next.fullLabel : 'Не запланирована'} />
          </dl>

          <div className="pc-petdetail__actions">
            <button type="button" className="pc-btn pc-btn--primary" onClick={() => setEditing(true)}>
              <PencilIcon size={16} />
              Редактировать
            </button>
            <button type="button" className="pc-btn pc-btn--danger-outline" onClick={() => setConfirmingDelete(true)}>
              <TrashIcon size={16} />
              Удалить
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p className="pc-form-status pc-form-status--error" role="alert">
          {error}
        </p>
      )}

      {/* Sprint 4: tabs — Профиль / История здоровья */}
      <div className="pc-tabs" role="tablist" aria-label="Разделы профиля питомца">
        <button
          type="button"
          role="tab"
          id="pet-tab-profile"
          aria-selected={tab === 'profile'}
          aria-controls="pet-tabpanel"
          className={`pc-tabs__tab${tab === 'profile' ? ' pc-tabs__tab--active' : ''}`}
          onClick={() => setTab('profile')}
        >
          Профиль
        </button>
        <button
          type="button"
          role="tab"
          id="pet-tab-history"
          aria-selected={tab === 'history'}
          aria-controls="pet-tabpanel"
          className={`pc-tabs__tab${tab === 'history' ? ' pc-tabs__tab--active' : ''}`}
          onClick={() => setTab('history')}
        >
          История здоровья
        </button>
      </div>

      <div id="pet-tabpanel" role="tabpanel" aria-labelledby={tab === 'profile' ? 'pet-tab-profile' : 'pet-tab-history'}>
        {tab === 'history' && <HealthHistoryTab petId={pet.id} token={token} />}
      </div>

      {editing && (
        <PetFormModal
          pet={pet}
          token={token}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            setPet(saved)
            setEditing(false)
          }}
        />
      )}

      {confirmingDelete && (
        <ConfirmDialog
          titleId="pet-delete-title"
          title={`Удалить питомца ${pet.name}?`}
          description="История здоровья, задачи и покупки этого питомца будут удалены безвозвратно. Действие нельзя отменить."
          busy={deleting}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={handleDelete}
        />
      )}
    </main>
  )
}

/* ---------- local presentational helper ---------- */

function FactRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="pc-petdetail__fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
