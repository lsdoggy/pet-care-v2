import { useLanguage } from '../i18n/language'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api/client'
import type { CareTaskDto, CareTaskType, PetDto, RecurrenceUnit } from '../api/types'
import { RECURRENCE_UNITS, TASK_TYPES, TASK_TYPE_LABELS, ENGLISH_TASK_TYPE_LABELS } from '../api/types'

interface Props {
  pets: PetDto[]
  token: string
  onClose: () => void
  onSaved: (task: CareTaskDto) => void
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
  width: 380,
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

/** Local datetime value ("YYYY-MM-DDTHH:mm") -> UTC ISO instant sent to the backend. */
function localInputToUtcIso(value: string): string {
  return new Date(value).toISOString()
}

export default function TaskFormModal({ pets, token, onClose, onSaved }: Props) {
  const { language } = useLanguage()
  const [petId, setPetId] = useState<number>(pets[0]?.id ?? 0)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<CareTaskType>('FOOD')
  // Default due date: tomorrow 09:00 in the user's local time.
  const [dueAtLocal, setDueAtLocal] = useState(() => {
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000)
    d.setHours(9, 0, 0, 0)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  })
  const [recurrenceUnit, setRecurrenceUnit] = useState<'' | RecurrenceUnit>('')
  const [recurrenceInterval, setRecurrenceInterval] = useState(1)
  const [error, setError] = useState<Record<'ru' | 'en', string> | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!title.trim()) {
      setError({ ru: 'Укажите название задачи.', en: 'Title is required' })
      return
    }
    if (!petId) {
      setError({ ru: 'Сначала добавьте питомца, для которого нужна задача.', en: 'Please create a pet first — tasks are always attached to a pet' })
      return
    }
    const dueAt = new Date(dueAtLocal)
    if (Number.isNaN(dueAt.getTime())) {
      setError({ ru: 'Проверьте дату и время.', en: 'Invalid due date' })
      return
    }
    if (dueAt.getTime() <= Date.now()) {
      setError({ ru: 'Укажите дату и время в будущем.', en: 'Due date must be in the future' })
      return
    }

    setSaving(true)
    try {
      const saved = await api.createTask(
        {
          petId,
          title: title.trim(),
          type,
          dueAt: localInputToUtcIso(dueAtLocal), // stored in UTC
          recurrenceRule: recurrenceUnit ? `${recurrenceUnit}:${recurrenceInterval}` : undefined,
        },
        token,
      )
      onSaved(saved)
    } catch {
      setError({ ru: 'Не удалось сохранить задачу.', en: 'Something went wrong' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: 0, fontSize: 20 }}>{language === 'ru' ? 'Новая задача ухода' : 'New care task'}</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label>
            {language === 'ru' ? 'Питомец *' : 'Pet *'}
            <select
              style={{ ...inputStyle, width: '100%', marginTop: 4, display: 'block' }}
              value={petId}
              onChange={(e) => setPetId(Number(e.target.value))}
            >
              {pets.length === 0 && <option value={0}>{language === 'ru' ? 'Нет питомцев' : 'No pets available'}</option>}
              {pets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            {language === 'ru' ? 'Название *' : 'Title *'}
            <input
              style={{ ...inputStyle, width: '100%', marginTop: 4, display: 'block' }}
              value={title}
              maxLength={150}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={language === 'ru' ? 'Прививка от бешенства' : 'Rabies vaccine'}
              autoFocus
            />
          </label>

          <label>
            {language === 'ru' ? 'Тип' : 'Type'}
            <select
              style={{ ...inputStyle, width: '100%', marginTop: 4, display: 'block' }}
              value={type}
              onChange={(e) => setType(e.target.value as CareTaskType)}
            >
              {TASK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {(language === 'ru' ? TASK_TYPE_LABELS : ENGLISH_TASK_TYPE_LABELS)[t]}
                </option>
              ))}
            </select>
          </label>

          <label>
            {language === 'ru' ? 'Дата и время (местные) *' : 'Due date & time (local) *'}
            <input
              style={{ ...inputStyle, width: '100%', marginTop: 4, display: 'block' }}
              type="datetime-local"
              value={dueAtLocal}
              onChange={(e) => setDueAtLocal(e.target.value)}
            />
          </label>

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <label style={{ flex: 1 }}>
              {language === 'ru' ? 'Повторять' : 'Repeat'}
              <select
                style={{ ...inputStyle, width: '100%', marginTop: 4, display: 'block' }}
                value={recurrenceUnit}
                onChange={(e) => setRecurrenceUnit(e.target.value as '' | RecurrenceUnit)}
              >
                <option value="">{language === 'ru' ? 'Без повторения' : 'Does not repeat'}</option>
                {RECURRENCE_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {language === 'ru'
                      ? { DAILY: 'Ежедневно', WEEKLY: 'Еженедельно', MONTHLY: 'Ежемесячно', YEARLY: 'Ежегодно' }[u]
                      : u.charAt(0) + u.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
            {recurrenceUnit && (
              <label style={{ width: 90 }}>
                {language === 'ru' ? 'Интервал' : 'Every'}
                <input
                  style={{ ...inputStyle, width: '100%', marginTop: 4, display: 'block' }}
                  type="number"
                  min={1}
                  max={9999}
                  value={recurrenceInterval}
                  onChange={(e) => setRecurrenceInterval(Math.max(1, Number(e.target.value) || 1))}
                />
              </label>
            )}
          </div>

          {error && <p style={{ color: '#c0392b', margin: 0, fontSize: 14 }} role="alert">{error[language]}</p>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ ...inputStyle, cursor: 'pointer' }}>
              {language === 'ru' ? 'Отмена' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{ ...inputStyle, cursor: 'pointer', backgroundColor: '#4f46e5', color: '#fff', border: 'none' }}
            >
              {saving ? (language === 'ru' ? 'Сохранение…' : 'Saving…') : (language === 'ru' ? 'Сохранить' : 'Save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
