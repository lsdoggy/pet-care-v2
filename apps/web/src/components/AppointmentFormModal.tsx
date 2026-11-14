import { useLanguage } from '../i18n/language'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api/client'
import type { AppointmentStatus, CreateAppointmentRequest, VetAppointmentDto } from '../api/types'
import { APPOINTMENT_STATUSES, APPOINTMENT_STATUS_LABELS, ENGLISH_APPOINTMENT_STATUS_LABELS } from '../api/types'

interface Props {
  petId: number
  token: string
  /** Existing appointment to edit; omit for "new appointment". */
  appointment?: VetAppointmentDto
  onClose: () => void
  onSaved: (appointment: VetAppointmentDto) => void
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
  width: 420,
  maxWidth: '90vw',
  maxHeight: '90vh',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 6,
  border: '1px solid #cbd5e1',
  fontSize: 15,
  width: '100%',
  boxSizing: 'border-box',
  marginTop: 4,
  display: 'block',
}

const labelStyle: React.CSSProperties = { fontSize: 14, color: '#334155' }

/** "YYYY-MM-DDTHH:mm" from <input type="datetime-local"> -> UTC ISO instant. */
function localInputToUtcIso(value: string): string {
  return new Date(value).toISOString()
}

/** UTC ISO instant -> value accepted by <input type="datetime-local"> in local time. */
function utcIsoToLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function AppointmentFormModal({ petId, token, appointment, onClose, onSaved }: Props) {
  const { language } = useLanguage()
  const [clinicName, setClinicName] = useState(appointment?.clinicName ?? '')
  const [doctorName, setDoctorName] = useState(appointment?.doctorName ?? '')
  const [scheduledAtLocal, setScheduledAtLocal] = useState(() => {
    if (appointment) return utcIsoToLocalInput(appointment.scheduledAt)
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000)
    d.setHours(9, 0, 0, 0)
    return utcIsoToLocalInput(d.toISOString())
  })
  const [durationMinutes, setDurationMinutes] = useState(appointment?.durationMinutes ?? 30)
  const [status, setStatus] = useState<AppointmentStatus>(appointment?.status ?? 'SCHEDULED')
  const [address, setAddress] = useState(appointment?.address ?? '')
  const [cost, setCost] = useState(appointment?.cost != null ? String(appointment.cost) : '')
  const [currency, setCurrency] = useState(appointment?.currency ?? '')
  const [reason, setReason] = useState(appointment?.reason ?? '')
  const [notes, setNotes] = useState(appointment?.notes ?? '')
  const [error, setError] = useState<{ ru: string; en: string } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!clinicName.trim()) {
      setError({ ru: 'Укажите название клиники', en: 'Enter the clinic name.' })
      return
    }
    const when = new Date(scheduledAtLocal)
    if (Number.isNaN(when.getTime())) {
      setError({ ru: 'Укажите корректные дату и время', en: 'Enter a valid date and time.' })
      return
    }
    if (durationMinutes < 5 || durationMinutes > 480) {
      setError({ ru: 'Длительность должна быть от 5 до 480 минут', en: 'Duration must be between 5 and 480 minutes.' })
      return
    }
    let costValue: number | undefined
    if (cost.trim() !== '') {
      const parsed = Number(cost)
      if (Number.isNaN(parsed) || parsed < 0) {
        setError({ ru: 'Стоимость должна быть неотрицательным числом', en: 'Enter a non-negative cost.' })
        return
      }
      costValue = parsed
    }
    if (currency.trim() !== '' && !/^[A-Za-z]{3}$/.test(currency.trim())) {
      setError({ ru: 'Укажите код валюты из трёх букв, например RUB', en: 'Enter a three-letter currency code, such as RUB.' })
      return
    }

    const body: CreateAppointmentRequest = {
      petId,
      clinicName: clinicName.trim(),
      doctorName: doctorName.trim() || null,
      scheduledAt: localInputToUtcIso(scheduledAtLocal),
      durationMinutes,
      status,
      address: address.trim() || null,
      cost: costValue ?? null,
      currency: currency.trim() ? currency.trim().toUpperCase() : null,
      reason: reason.trim(),
      notes: notes.trim() || null,
    }

    setSaving(true)
    try {
      const saved = appointment
        ? await api.updateAppointment(appointment.id, body, token)
        : await api.createAppointment(body, token)
      onSaved(saved)
    } catch {
      setError({ ru: 'Не удалось сохранить визит', en: 'Could not save the appointment.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: 0, fontSize: 20 }}>{appointment ? (language === 'ru' ? 'Редактировать визит' : 'Edit visit') : (language === 'ru' ? 'Запись к ветеринару' : 'Book a vet visit')}</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={labelStyle}>
            {language === 'ru' ? 'Клиника *' : 'Clinic *'}
            <input style={inputStyle} value={clinicName} onChange={(e) => setClinicName(e.target.value)} maxLength={150} />
          </label>
          <label style={labelStyle}>
            {language === 'ru' ? 'Врач' : 'Veterinarian'}
            <input style={inputStyle} value={doctorName} onChange={(e) => setDoctorName(e.target.value)} maxLength={150} />
          </label>
          <label style={labelStyle}>
            {language === 'ru' ? 'Дата и время *' : 'Date and time *'}
            <input
              style={inputStyle}
              type="datetime-local"
              value={scheduledAtLocal}
              onChange={(e) => setScheduledAtLocal(e.target.value)}
            />
          </label>
          <div style={{ display: 'flex', gap: 12 }}>
            <label style={{ ...labelStyle, flex: 1 }}>
              {language === 'ru' ? 'Длительность, мин' : 'Duration, min'}
              <input
                style={inputStyle}
                type="number"
                min={5}
                max={480}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
              />
            </label>
            <label style={{ ...labelStyle, flex: 1 }}>
              {language === 'ru' ? 'Статус' : 'Status'}
              <select style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value as AppointmentStatus)}>
                {APPOINTMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {(language === 'ru' ? APPOINTMENT_STATUS_LABELS : ENGLISH_APPOINTMENT_STATUS_LABELS)[s]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label style={labelStyle}>
            {language === 'ru' ? 'Адрес' : 'Address'}
            <input style={inputStyle} value={address} onChange={(e) => setAddress(e.target.value)} maxLength={255} />
          </label>
          <div style={{ display: 'flex', gap: 12 }}>
            <label style={{ ...labelStyle, flex: 1 }}>
              {language === 'ru' ? 'Стоимость' : 'Cost'}
              <input style={inputStyle} type="number" min={0} step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
            </label>
            <label style={{ ...labelStyle, width: 90 }}>
              {language === 'ru' ? 'Валюта' : 'Currency'}
              <input style={inputStyle} value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} placeholder="USD" />
            </label>
          </div>
          <label style={labelStyle}>
            {language === 'ru' ? 'Причина визита' : 'Reason for visit'}
            <textarea style={inputStyle} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={2000} />
          </label>
          <label style={labelStyle}>
            {language === 'ru' ? 'Заметки' : 'Notes'}
            <textarea style={{ ...inputStyle, minHeight: 60 }} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
          </label>

          {error && <p style={{ color: '#c0392b', margin: 0 }} role="alert">{error[language]}</p>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #cbd5e1', backgroundColor: '#fff', cursor: 'pointer' }}>
              {language === 'ru' ? 'Отмена' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{ padding: '8px 20px', borderRadius: 6, border: 'none', backgroundColor: '#4f46e5', color: '#fff', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
            >
              {saving ? (language === 'ru' ? 'Сохранение…' : 'Saving…') : (language === 'ru' ? 'Сохранить' : 'Save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
