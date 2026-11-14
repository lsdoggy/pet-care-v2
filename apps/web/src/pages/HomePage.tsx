import { useLanguage, type Language } from '../i18n/language'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { CareTaskDto, FoodProductDto, PetDto, VetAppointmentDto } from '../api/types'
import { TASK_TYPE_LABELS, ENGLISH_TASK_TYPE_LABELS } from '../api/types'
import { useAuth } from '../auth/useAuth'
import { tokenStore } from '../auth/tokenStore'
import DashboardSkeleton from '../components/DashboardSkeleton'
import ConfirmDialog from '../components/ConfirmDialog'
import PetCard from '../components/PetCard'
import PetFormModal from '../components/PetFormModal'
import PetPickerModal from '../components/PetPickerModal'
import QuickAddPurchaseModal from '../components/QuickAddPurchaseModal'
import TaskFormModal from '../components/TaskFormModal'
import AppointmentFormModal from '../components/AppointmentFormModal'
import {
  AlertIcon,
  CalendarPlusIcon,
  CartIcon,
  CheckIcon,
  ChevronRightIcon,
  PawIcon,
  PlusIcon,
  RefreshIcon,
  StethoscopeIcon,
} from '../components/icons'
import {
  buildUpcomingEvents,
  classifyTask,
  daysLeft,
  displayNameFromEmail,
  formatDueLabel,
  formatVisitLabel,
  greetingWord,
  lowStockProducts,
  nextVisit,
  pluralRu,
  recurrenceLabel,
  taskComparator,
  todayLabel,
} from '../lib/dashboard'
import { useDashboardNow } from '../lib/useDashboardNow'
import '../styles/dashboard.css'
import '../styles/pets.css'
import '../styles/settings.css'

/**
 * Design Sprint 2 — Dashboard (web, mobile-first).
 * Presentation layer only: reuses existing GET/POST endpoints via api/client.ts.
 * Backend contract unchanged; all business actions delegate to existing modals.
 */

type Modal =
  | { name: 'pet'; pet?: PetDto }
  | { name: 'task'; pet: PetDto }
  | { name: 'appointment'; pet: PetDto; appointment?: VetAppointmentDto }
  | { name: 'purchase' }
  | { name: 'pickPet'; for: 'task' | 'appointment' }
  | null

/** Design Sprint 3: подтверждение удаления питомца (замена window.confirm). */
interface DeleteTarget {
  pet: PetDto
}

const dashboardSources = ['pets', 'tasks', 'visits', 'stock'] as const
const sourceLabels = {
  ru: { pets: 'питомцев', tasks: 'задачи', visits: 'визиты к врачу', stock: 'запасы' },
  en: { pets: 'pets', tasks: 'tasks', visits: 'vet visits', stock: 'stock' },
}

export default function HomePage() {
  const { language } = useLanguage()
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const now = useDashboardNow()

  const [pets, setPets] = useState<PetDto[]>([])
  const [tasks, setTasks] = useState<CareTaskDto[]>([])
  const [appointments, setAppointments] = useState<VetAppointmentDto[]>([])
  const [products, setProducts] = useState<FoodProductDto[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Record<Language, string> | null>(null)
  const [warnings, setWarnings] = useState<(typeof dashboardSources)[number][]>([])
  const [actionError, setActionError] = useState<Record<Language, string> | null>(null)
  const [notice, setNotice] = useState<Record<Language, string> | null>(null)
  const [busyVisitId, setBusyVisitId] = useState<number | null>(null)
  const [modal, setModal] = useState<Modal>(null)
  const [busyTaskId, setBusyTaskId] = useState<number | null>(null)
  // Design Sprint 3: удаление питомца через доступный ConfirmDialog.
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [deleting, setDeleting] = useState(false)

  const token = tokenStore.get() ?? ''

  /** Parallel load of the four dashboard sources; partial failures keep the rest of the data. */
  const loadAll = useCallback(async () => {
    if (!tokenStore.get()) return
    setLoading(true)
    setError(null)
    const results = await Promise.allSettled([
      api.listPets(token),
      api.listUpcomingTasks(token),
      api.listAppointments(token),
      api.listFoodProducts(token),
    ])
    const [petsRes, tasksRes, apptRes, prodRes] = results
    setWarnings(results.flatMap((result, i) => result.status === 'rejected' ? [dashboardSources[i]] : []))
    if (petsRes.status === 'fulfilled') setPets(petsRes.value)
    if (tasksRes.status === 'fulfilled') setTasks(tasksRes.value)
    if (apptRes.status === 'fulfilled') setAppointments(apptRes.value)
    if (prodRes.status === 'fulfilled') setProducts(prodRes.value)

    // Pets failing is fatal for the dashboard → full error state with retry.
    if (petsRes.status === 'rejected') {
      setError({ ru: 'Не удалось загрузить питомцев. Проверьте соединение и повторите попытку.', en: 'Could not load your pets. Check your connection and try again.' })
    }
    setLoading(false)
  }, [token])

  useEffect(() => {
    if (user) void loadAll()
  }, [user, loadAll])

  /* ---------- derived view-model (pure helpers from lib/dashboard) ---------- */
  const attention = useMemo(() => {
    const overdue = tasks.filter((t) => classifyTask(t, now) === 'overdue').sort((a, b) => taskComparator(a, b, now))
    const today = tasks.filter((t) => classifyTask(t, now) === 'today').sort((a, b) => taskComparator(a, b, now))
    const low = lowStockProducts(products)
    const visit = nextVisit(appointments, 7, now)
    const missedVisits = appointments.filter((a) => a.status === 'SCHEDULED' && new Date(a.scheduledAt).getTime() < now)
      .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt))
    return { overdue, today, low, visit, missedVisits }
  }, [tasks, products, appointments, now])

  const events = useMemo(() => buildUpcomingEvents(tasks, appointments, now).slice(0, 6), [tasks, appointments, now])

  const attentionCount =
    attention.missedVisits.length + attention.overdue.length + attention.today.length + attention.low.length + (attention.visit ? 1 : 0)

  /* ---------- task completion (existing API: POST /tasks/{id}/complete) ---------- */
  async function completeTask(task: CareTaskDto) {
    setBusyTaskId(task.id)
    setActionError(null)
    setNotice(null)
    try {
      await api.completeTask(task.id, token)
      setNotice({ ru: `Задача «${task.title}» выполнена`, en: `Task “${task.title}” completed` })
      // Refetch so a newly spawned recurring task appears immediately.
      const [nextTasks, nextProducts] = await Promise.all([api.listUpcomingTasks(token), api.listFoodProducts(token)])
      setTasks(nextTasks)
      setProducts(nextProducts)
    } catch {
      setActionError({ ru: 'Не удалось обновить список задач. Повторите загрузку, чтобы проверить результат.', en: 'Could not refresh tasks. Reload the dashboard to check the result.' })
    } finally {
      setBusyTaskId(null)
    }
  }

  async function updateVisit(visit: VetAppointmentDto, status: 'COMPLETED' | 'CANCELLED') {
    setBusyVisitId(visit.id)
    setActionError(null)
    setNotice(null)
    try {
      const updated = await api.updateAppointment(visit.id, { status }, token)
      setAppointments((prev) => prev.map((a) => a.id === updated.id ? updated : a))
      setNotice(status === 'COMPLETED'
        ? { ru: 'Визит отмечен завершённым', en: 'Visit marked complete' }
        : { ru: 'Визит отменён', en: 'Visit cancelled' })
    } catch {
      setActionError({ ru: 'Не удалось изменить статус визита. Попробуйте ещё раз.', en: 'Could not update the visit status. Try again.' })
    } finally {
      setBusyVisitId(null)
    }
  }

  /* ---------- pet delete (existing API: DELETE /pets/{id}, confirm via ConfirmDialog) ---------- */
  async function confirmDeletePet(target: DeleteTarget) {
    setDeleting(true)
    try {
      await api.deletePet(target.pet.id, token)
      setPets((prev) => prev.filter((p) => p.id !== target.pet.id))
      setTasks((prev) => prev.filter((t) => t.petId !== target.pet.id))
      setAppointments((prev) => prev.filter((a) => a.petId !== target.pet.id))
      setDeleteTarget(null)
    } catch {
      setError({ ru: 'Не удалось удалить питомца', en: 'Could not delete the pet.' })
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  /* ---------- quick actions (single pet → open form directly; several → picker) ---------- */
  function startCreateTask() {
    if (pets.length === 0) {
      setModal({ name: 'pet' })
      return
    }
    if (pets.length === 1) {
      setModal({ name: 'task', pet: pets[0] })
      return
    }
    setModal({ name: 'pickPet', for: 'task' })
  }

  function startBookVet() {
    if (pets.length === 0) {
      setModal({ name: 'pet' })
      return
    }
    if (pets.length === 1) {
      setModal({ name: 'appointment', pet: pets[0] })
      return
    }
    setModal({ name: 'pickPet', for: 'appointment' })
  }

  if (authLoading) return <DashboardSkeleton />
  if (!user) return <Navigate to="/login" replace />

  const firstName = user.firstName?.trim() || displayNameFromEmail(user.email)

  return (
    <main className="pc-dash" aria-busy={loading}>
      {loading ? (
        <DashboardSkeleton />
      ) : error ? (
        /* ---------- Error state with retry ---------- */
        <div className="pc-error" role="alert">
          <span className="pc-error__icon">
            <AlertIcon size={32} />
          </span>
          <h1 className="pc-section__title">{language === 'ru' ? 'Что-то пошло не так' : 'Something went wrong'}</h1>
          <p className="pc-error__text">{error[language]}</p>
          <button type="button" className="pc-btn pc-btn--primary" onClick={() => void loadAll()}>
            <RefreshIcon size={18} />
            {language === 'ru' ? 'Повторить' : 'Retry'}
          </button>
        </div>
      ) : (
        <>
          {warnings.length > 0 && (
            <div className="pc-dashboard-warning" role="alert">
              {language === 'ru' ? 'Не удалось загрузить:' : 'Could not load:'}{' '}
              {warnings.map((source) => sourceLabels[language][source]).join(', ')}.{' '}
              {language === 'ru' ? 'Сводка может быть неполной.' : 'The dashboard may be incomplete.'}
              <button className="pc-linkbtn" type="button" onClick={() => void loadAll()}>{language === 'ru' ? 'Повторить загрузку' : 'Reload'}</button>
            </div>
          )}
          {actionError && <div className="pc-dashboard-warning" role="alert">{actionError[language]} <button className="pc-linkbtn" onClick={() => void loadAll()}>{language === 'ru' ? 'Обновить данные' : 'Refresh'}</button></div>}
          {notice && <p className="pc-settings__success" role="status">{notice[language]}</p>}
          {/* ---------- 1. Greeting ---------- */}
          <header>
            <p className="pc-dash__greeting-date">{todayLabel(new Date(now), language)}</p>
            <h1 className="pc-dash__greeting-title">
              {greetingWord(new Date(now), language)}, {firstName}!
            </h1>
            <p className="pc-dash__greeting-sub">
              {warnings.length > 0
                ? (language === 'ru' ? 'Часть данных недоступна — обновите сводку' : 'Some data is unavailable. Reload the dashboard.')
                : attention.overdue.length > 0
                ? (language === 'ru' ? `Просрочено: ${pluralRu(attention.overdue.length, ['задача', 'задачи', 'задач'])} — начните с блока «Требует внимания»` : `Overdue tasks: ${attention.overdue.length}`)
                : attentionCount > 0
                  ? (language === 'ru' ? `Требуют внимания: ${attentionCount}` : `Needs attention: ${attentionCount}`)
                  : (language === 'ru' ? 'Всё под контролем — срочных дел нет 🐾' : 'Nothing urgent 🐾')}
            </p>
          </header>

          {/* Desktop ≥768px: two-column grid; mobile: single column in priority order */}
          <div className="pc-dash__grid">
            <div className="pc-dash__col">
              {/* ---------- 2. Требует внимания ---------- */}
              <section aria-labelledby="dash-attention-title">
                <div className="pc-section__head">
                  <h2 id="dash-attention-title" className="pc-section__title">
                    <span className="pc-section__title-icon">
                      <AlertIcon size={18} />
                    </span>
                    {language === 'ru' ? 'Требует внимания' : 'Needs attention'}
                    {attentionCount > 0 && <span className="pc-section__count">{attentionCount}</span>}
                  </h2>
                </div>

                {attentionCount === 0 ? (
                  <div className="pc-card pc-attention pc-attention--ok">
                    <CheckIcon size={20} />
                    {warnings.length > 0 ? (language === 'ru' ? 'Не все данные загружены. Пока нельзя проверить, есть ли срочные дела.' : 'Some data could not be loaded. Urgent items may be missing.') : (language === 'ru' ? 'Всё спокойно: ничего не просрочено, корм в порядке, визитов на неделе нет.' : 'Nothing is overdue, food stock is sufficient, and there are no visits this week.')}
                  </div>
                ) : (
                  <div className="pc-card pc-attention">
                    {attention.overdue.length > 0 && (
                      <AttentionGroup label={`${language === 'ru' ? 'Просрочено' : 'Overdue'} · ${attention.overdue.length}`}>
                        {attention.overdue.slice(0, 3).map((t) => (
                          <TaskRow
                            key={t.id}
                            task={t}
                             now={now}
                            dot="danger"
                            busy={busyTaskId === t.id}
                            onComplete={completeTask}
                            onOpen={() => navigate(`/pets/${t.petId}`)}
                          />
                        ))}
                      </AttentionGroup>
                    )}
                    {attention.missedVisits.length > 0 && (
                      <AttentionGroup label={`${language === 'ru' ? 'Визиты без отметки о завершении' : 'Incomplete visits'} · ${attention.missedVisits.length}`}>
                        {attention.missedVisits.map((visit) => (
                          <div key={visit.id}>
                            <button type="button" className="pc-attention__row" onClick={() => navigate(`/pets/${visit.petId}`)}>
                              <span className="pc-attention__dot pc-attention__dot--danger" aria-hidden="true" />
                              <span className="pc-attention__row-main">
                                <span className="pc-attention__row-title">{visit.clinicName} · {visit.petName}</span>
                                <span className="pc-attention__row-meta">{formatVisitLabel(visit.scheduledAt, language)} · {language === 'ru' ? 'дата визита прошла' : 'visit date has passed'}</span>
                              </span>
                            </button>
                            <div className="pc-visit-actions" role="group" aria-label={`${language === 'ru' ? 'Действия с визитом' : 'Visit actions'}: ${visit.clinicName}, ${visit.petName}`}>
                              <button className="pc-linkbtn" disabled={busyVisitId === visit.id} onClick={() => void updateVisit(visit, 'COMPLETED')}>{language === 'ru' ? 'Завершить' : 'Complete'}</button>
                              <button className="pc-linkbtn" disabled={busyVisitId === visit.id} onClick={() => {
                                const pet = pets.find((p) => p.id === visit.petId)
                                if (pet) setModal({ name: 'appointment', pet, appointment: visit })
                              }}>{language === 'ru' ? 'Перенести' : 'Reschedule'}</button>
                              <button className="pc-linkbtn" disabled={busyVisitId === visit.id} onClick={() => void updateVisit(visit, 'CANCELLED')}>{language === 'ru' ? 'Отменить визит' : 'Cancel visit'}</button>
                            </div>
                          </div>
                        ))}
                      </AttentionGroup>
                    )}
                    {attention.today.length > 0 && (
                      <AttentionGroup label={`${language === 'ru' ? 'Сегодня' : 'Today'} · ${attention.today.length}`}>
                        {attention.today.slice(0, 3).map((t) => (
                          <TaskRow
                            key={t.id}
                            task={t}
                             now={now}
                            dot="warning"
                            busy={busyTaskId === t.id}
                            onComplete={completeTask}
                            onOpen={() => navigate(`/pets/${t.petId}`)}
                          />
                        ))}
                      </AttentionGroup>
                    )}
                    {attention.low.length > 0 && (
                      <AttentionGroup label={language === 'ru' ? 'Низкий остаток' : 'Low stock'}>
                        {attention.low.slice(0, 3).map((p) => {
                          const d = daysLeft(p)
                          return (
                            <button
                              key={p.id}
                              type="button"
                              className="pc-attention__row"
                              onClick={() => navigate('/stock')}
                            >
                              <span className="pc-attention__dot pc-attention__dot--warning" aria-hidden="true" />
                              <span className="pc-attention__row-main">
                                <span className="pc-attention__row-title">{p.name}</span>
                                <span className="pc-attention__row-meta">
                                  {d != null ? (language === 'ru' ? `Хватит ещё на ${pluralRu(d, ['день', 'дня', 'дней'])}` : `${d} ${d === 1 ? 'day' : 'days'} left`) : (language === 'ru' ? 'Остаток низкий' : 'Low stock')}
                                </span>
                              </span>
                              <span className="pc-badge pc-badge--warning">{language === 'ru' ? 'Пополнить' : 'Restock'}</span>
                              <span className="pc-attention__chevron">
                                <ChevronRightIcon size={16} />
                              </span>
                            </button>
                          )
                        })}
                      </AttentionGroup>
                    )}
                    {attention.visit && (
                      <AttentionGroup label={language === 'ru' ? 'Ближайший визит' : 'Next visit'}>
                        <button
                          type="button"
                          className="pc-attention__row"
                          onClick={() => navigate(`/pets/${attention.visit!.petId}`)}
                        >
                          <span className="pc-attention__dot pc-attention__dot--info" aria-hidden="true" />
                          <span className="pc-attention__row-main">
                            <span className="pc-attention__row-title">
                              {attention.visit.clinicName} · {attention.visit.petName}
                            </span>
                            <span className="pc-attention__row-meta">{formatVisitLabel(attention.visit.scheduledAt, language)}</span>
                          </span>
                          <span className="pc-attention__chevron">
                            <ChevronRightIcon size={16} />
                          </span>
                        </button>
                      </AttentionGroup>
                    )}
                  </div>
                )}
              </section>

              {/* ---------- 5. Быстрые действия ---------- */}
              <section aria-labelledby="dash-quick-title">
                <div className="pc-section__head">
                  <h2 id="dash-quick-title" className="pc-section__title">
                    <span className="pc-section__title-icon">
                      <PawIcon size={18} />
                    </span>
                    {language === 'ru' ? 'Быстрые действия' : 'Quick actions'}
                  </h2>
                </div>
                <div className="pc-quick">
                  <QuickAction icon={<PlusIcon size={20} />} label={language === 'ru' ? 'Добавить питомца' : 'Add a pet'} onClick={() => setModal({ name: 'pet' })} />
                  <QuickAction icon={<CheckIcon size={20} />} label={language === 'ru' ? 'Создать задачу' : 'Create a task'} onClick={startCreateTask} />
                  <QuickAction icon={<StethoscopeIcon size={20} />} label={language === 'ru' ? 'Записать к врачу' : 'Book a vet visit'} onClick={startBookVet} />
                  <QuickAction icon={<CartIcon size={20} />} label={language === 'ru' ? 'Добавить покупку' : 'Add a purchase'} onClick={() => setModal({ name: 'purchase' })} />
                </div>
              </section>

              {/* ---------- 3/6. Pet cards or empty state ---------- */}
              <section aria-labelledby="dash-pets-title">
                <div className="pc-section__head">
                  <h2 id="dash-pets-title" className="pc-section__title">
                    <span className="pc-section__title-icon">
                      <PawIcon size={18} />
                    </span>
                    {language === 'ru' ? 'Мои питомцы' : 'My pets'}
                    {pets.length > 0 && <span className="pc-section__count">{pets.length}</span>}
                  </h2>
                </div>

                {pets.length === 0 ? (
                  <div className="pc-card pc-empty">
                    <span className="pc-empty__illustration">
                      <PawIcon size={44} />
                    </span>
                    <h3 className="pc-empty__title">{language === 'ru' ? 'Пока нет питомцев' : 'No pets yet'}</h3>
                    <p className="pc-empty__text">
                      {language === 'ru' ? 'Добавьте первого питомца, чтобы вести историю здоровья, напоминания и список покупок.' : 'Add your first pet to track health history, reminders, and purchases.'}
                    </p>
                    <button type="button" className="pc-btn pc-btn--primary" onClick={() => setModal({ name: 'pet' })}>
                      <PlusIcon size={18} />
                      {language === 'ru' ? 'Добавить питомца' : 'Add a pet'}
                    </button>
                  </div>
                ) : (
                  <div className="pc-pets">
                    {pets.map((pet) => (
                      <PetCard
                        key={pet.id}
                        pet={pet}
                        tasks={tasks}
                        appointments={appointments}
                        onOpen={(p) => navigate(`/pets/${p.id}`)}
                      />
                    ))}
                    <button
                      type="button"
                      className="pc-petcard pc-petcard--add"
                      onClick={() => setModal({ name: 'pet' })}
                      aria-label={language === 'ru' ? 'Добавить питомца' : 'Add a pet'}
                    >
                      <PlusIcon size={20} />
                      {language === 'ru' ? 'Добавить питомца' : 'Add a pet'}
                    </button>
                  </div>
                )}
              </section>
            </div>

            <div className="pc-dash__col">
              {/* ---------- 4. Ближайшие события ---------- */}
              <section aria-labelledby="dash-events-title">
                <div className="pc-section__head">
                  <h2 id="dash-events-title" className="pc-section__title">
                    <span className="pc-section__title-icon">
                      <CalendarPlusIcon size={18} />
                    </span>
                    {language === 'ru' ? 'Ближайшие события' : 'Upcoming events'}
                  </h2>
                  <button type="button" className="pc-linkbtn" onClick={startCreateTask}>
                    {language === 'ru' ? 'Создать задачу' : 'Create a task'}
                  </button>
                </div>

                <div className="pc-card pc-events">
                  {events.length === 0 ? (
                    <p className="pc-event__empty">{warnings.includes('tasks') || warnings.includes('visits') ? (language === 'ru' ? 'Не удалось загрузить все события. Повторите загрузку.' : 'Could not load all events. Reload to try again.') : attention.missedVisits.length > 0 ? (language === 'ru' ? 'Будущих событий нет. Проверьте незавершённые визиты в блоке «Требует внимания».' : 'No upcoming events. Check incomplete visits under Needs attention.') : (language === 'ru' ? 'Ближайших событий нет 🐾' : 'No upcoming events 🐾')}</p>
                  ) : (
                    events.map((ev) =>
                      ev.kind === 'task' ? (
                        <div key={`t-${ev.task.id}`} className="pc-event">
                          <input
                            type="checkbox"
                            className="pc-event__check"
                            aria-label={language === 'ru' ? `Отметить выполненной: ${ev.task.title}` : `Mark complete: ${ev.task.title}`}
                            disabled={busyTaskId === ev.task.id}
                            onChange={(e) => {
                              if (e.target.checked) void completeTask(ev.task)
                            }}
                          />
                          <span className="pc-event__main">
                            <span className="pc-event__title">
                              {ev.task.title}
                              {ev.task.recurrenceRule && (
                                <span className="pc-event__rec" title={recurrenceLabel(ev.task.recurrenceRule) ?? ''}>
                                  🔁
                                </span>
                              )}
                            </span>
                            <span className="pc-event__meta">
                              {(language === 'ru' ? TASK_TYPE_LABELS : ENGLISH_TASK_TYPE_LABELS)[ev.task.type]} · {ev.task.petName} · {(classifyTask(ev.task, now) === 'overdue' ? (language === 'ru' ? 'Просрочено · ' : 'Overdue · ') : '') + formatDueLabel(ev.task.dueAt, now, language)}
                            </span>
                          </span>
                        </div>
                      ) : (
                        <div key={`a-${ev.appointment.id}`} className="pc-event">
                          <span
                            className="pc-section__title-icon"
                            aria-hidden="true"
                            style={{ flexShrink: 0, display: 'inline-flex' }}
                          >
                            <StethoscopeIcon size={18} />
                          </span>
                          <span className="pc-event__main">
                            <span className="pc-event__title">
                              {ev.appointment.clinicName} · {ev.appointment.petName}
                            </span>
                            <span className="pc-event__meta">{formatVisitLabel(ev.appointment.scheduledAt, language)}</span>
                          </span>
                        </div>
                      ),
                    )
                  )}
                </div>
              </section>
            </div>
          </div>

          {/* ---------- Modals (reuse existing forms/endpoints) ---------- */}
          {modal?.name === 'pet' && (
            <PetFormModal
              pet={modal.pet}
              token={token}
              onClose={() => setModal(null)}
              onSaved={(saved) => {
                // Edit → replace in place; create → append (existing PATCH/POST semantics).
                setPets((prev) =>
                  prev.some((p) => p.id === saved.id) ? prev.map((p) => (p.id === saved.id ? saved : p)) : [...prev, saved],
                )
                setModal(null)
              }}
            />
          )}

          {deleteTarget && (
            <ConfirmDialog
              titleId="pet-delete-title"
              title={language === 'ru' ? `Удалить питомца ${deleteTarget.pet.name}?` : `Delete ${deleteTarget.pet.name}?`}
              description={language === 'ru' ? 'История здоровья, задачи и покупки этого питомца будут удалены безвозвратно. Действие нельзя отменить.' : 'This permanently deletes the pet’s health history, tasks, and purchases. This can’t be undone.'}
              busy={deleting}
              onCancel={() => setDeleteTarget(null)}
              onConfirm={() => confirmDeletePet(deleteTarget)}
            />
          )}

          {modal?.name === 'pickPet' && (
            <PetPickerModal
              pets={pets}
              title={modal.for === 'task' ? (language === 'ru' ? 'Для кого задача?' : 'Which pet is this task for?') : (language === 'ru' ? 'Кого записываем?' : 'Which pet needs a visit?')}
              hint={language === 'ru' ? 'Выберите питомца' : 'Select a pet'}
              onClose={() => setModal(null)}
              onPick={(pet) => setModal(modal.for === 'task' ? { name: 'task', pet } : { name: 'appointment', pet })}
            />
          )}

          {modal?.name === 'task' && (
            <TaskFormModal
              pets={[modal.pet]}
              token={token}
              onClose={() => setModal(null)}
              onSaved={() => {
                setModal(null)
                void loadAll()
              }}
            />
          )}

          {modal?.name === 'appointment' && (
            <AppointmentFormModal
              petId={modal.pet.id}
              appointment={modal.appointment}
              token={token}
              onClose={() => setModal(null)}
              onSaved={() => {
                setModal(null)
                void loadAll()
              }}
            />
          )}

          {modal?.name === 'purchase' && (
            <QuickAddPurchaseModal
              token={token}
              onClose={() => setModal(null)}
              onSaved={() => {
                setModal(null)
                void loadAll()
              }}
            />
          )}
        </>
      )}
    </main>
  )
}

/* ---------- local presentational helpers ---------- */

function AttentionGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="pc-attention__group">
      <div className="pc-attention__label">{label}</div>
      {children}
    </div>
  )
}

function TaskRow({
  task,
  now,
  dot,
  busy,
  onComplete,
  onOpen,
}: {
  task: CareTaskDto
  now: number
  dot: 'danger' | 'warning'
  busy: boolean
  onComplete: (t: CareTaskDto) => Promise<void>
  onOpen: () => void
}) {
  const { language } = useLanguage()
  return (
    <div className="pc-attention__row">
      <input
        type="checkbox"
        className="pc-event__check"
        aria-label={language === 'ru' ? `Отметить выполненной: ${task.title}` : `Mark complete: ${task.title}`}
        disabled={busy}
        onChange={(e) => {
          if (e.target.checked) void onComplete(task)
        }}
      />
      <button
        type="button"
        className="pc-attention__row-main"
        onClick={onOpen}
        style={{ border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', padding: 0, color: 'inherit' }}
      >
        <span className="pc-attention__row-title">{task.title}</span>
        <span className="pc-attention__row-meta">
          <span
            className={`pc-attention__dot pc-attention__dot--${dot}`}
            aria-hidden="true"
            style={{ display: 'inline-block', marginRight: 6 }}
          />
          {task.petName} · {(dot === 'danger' ? (language === 'ru' ? 'Просрочено · ' : 'Overdue · ') : '') + formatDueLabel(task.dueAt, now, language)}
        </span>
      </button>
    </div>
  )
}

function QuickAction({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" className="pc-quick__btn" onClick={onClick}>
      <span className="pc-quick__icon" aria-hidden="true">
        {icon}
      </span>
      {label}
    </button>
  )
}
