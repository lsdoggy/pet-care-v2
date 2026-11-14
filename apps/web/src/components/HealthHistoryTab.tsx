import { useLanguage } from '../i18n/language'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import type { HistoryEventDto, VetAppointmentDto, VetRecordDto } from '../api/types'
import { APPOINTMENT_STATUS_LABELS, ENGLISH_APPOINTMENT_STATUS_LABELS, formatDueAt } from '../api/types'
import AppointmentFormModal from './AppointmentFormModal'
import RecordFormModal from './RecordFormModal'

interface Props {
  petId: number
  token: string
}

const cardStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  padding: '12px 16px',
  backgroundColor: '#fff',
}

const statusColors: Record<string, string> = {
  SCHEDULED: '#2563eb',
  COMPLETED: '#16a34a',
  CANCELLED: '#9ca3af',
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Sprint 4: "Health History" tab — merged timeline of vet appointments & records
 * for one pet plus forms to add/edit them.
 */
export default function HealthHistoryTab({ petId, token }: Props) {
  const { language } = useLanguage()
  const [events, setEvents] = useState<HistoryEventDto[]>([])
  const [appointments, setAppointments] = useState<VetAppointmentDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ ru: string; en: string } | null>(null)
  const [showApptForm, setShowApptForm] = useState(false)
  const [editingAppt, setEditingAppt] = useState<VetAppointmentDto | null>(null)
  const [recordAppointmentId, setRecordAppointmentId] = useState<number>()
  const [showRecordForm, setShowRecordForm] = useState(false)

  const reload = useCallback(() => {
    setLoading(true)
    Promise.all([api.getPetHistory(petId, token), api.listAppointments(token)])
      .then(([history, appts]) => {
        setEvents(history)
        setAppointments(appts.filter((a) => a.petId === petId))
        setError(null)
      })
      .catch(() => setError({ ru: 'Не удалось загрузить историю.', en: 'Failed to load history' }))
      .finally(() => setLoading(false))
  }, [petId, token])

  useEffect(reload, [reload])

  async function handleDeleteAppointment(id: number) {
    if (!window.confirm(language === 'ru' ? 'Удалить визит? Связанные записи сохранятся.' : 'Delete this appointment? Linked records will be kept.')) return
    try {
      await api.deleteAppointment(id, token)
      reload()
    } catch {
      setError({ ru: 'Не удалось удалить визит.', en: 'Failed to delete appointment' })
    }
  }

  async function handleDeleteRecord(id: number) {
    if (!window.confirm(language === 'ru' ? 'Удалить запись и её вложения?' : 'Delete this record and its attachments?')) return
    try {
      await api.deleteRecord(id, token)
      reload()
    } catch {
      setError({ ru: 'Не удалось удалить запись.', en: 'Failed to delete record' })
    }
  }

  async function handleSetStatus(appt: VetAppointmentDto, status: VetAppointmentDto['status']) {
    try {
      await api.updateAppointment(appt.id, { status }, token)
      reload()
    } catch {
      setError({ ru: 'Не удалось изменить статус визита.', en: 'Failed to update status' })
    }
  }

  const linkedRecordIds = events.filter((e) => e.kind === 'RECORD' && e.record?.appointmentId != null).map((e) => e.record!.appointmentId as number)

  function renderAttachments(record: VetRecordDto) {
    return record.attachments.length > 0 && (
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
        {record.attachments.map((att) =>
          att.type === 'pdf' ? (
            <a key={att.url} href={att.url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#4f46e5' }}>
              📄 {att.name} ({formatFileSize(att.size)})
            </a>
          ) : (
            <a key={att.url} href={att.url} target="_blank" rel="noreferrer" title={att.name} style={{ display: 'inline-block' }}>
              <img src={att.url} alt={att.name} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8f0' }} />
            </a>
          ),
        )}
      </div>
    )
  }

  function renderAppointment(appt: VetAppointmentDto) {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <strong>🩺 {appt.clinicName}</strong>
          <span style={{ color: statusColors[appt.status], fontSize: 13, fontWeight: 600 }}>
            {(language === 'ru' ? APPOINTMENT_STATUS_LABELS : ENGLISH_APPOINTMENT_STATUS_LABELS)[appt.status]}
          </span>
        </div>
        <p style={{ margin: '6px 0 0', color: '#475569', fontSize: 14 }}>
          {formatDueAt(appt.scheduledAt, language)} · {appt.durationMinutes} {language === 'ru' ? 'мин' : 'min'}
          {appt.doctorName ? ` · ${appt.doctorName}` : ''}
          {appt.cost != null ? ` · ${appt.cost.toFixed(2)} ${appt.currency ?? ''}` : ''}
        </p>
        {appt.address && <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>{appt.address}</p>}
        {appt.reason && <p><strong>{language === 'ru' ? 'Причина визита:' : 'Reason for visit:'}</strong> {appt.reason}</p>}
        {appt.notes && <p style={{ margin: '4px 0 0', fontSize: 14 }}>{appt.notes}</p>}
        {events.flatMap(({ record }) => record?.appointmentId === appt.id ? [record] : []).map((record) => (
          <div key={record.id}>
            {record.diagnosisText && <p><strong>{language === 'ru' ? 'Диагноз:' : 'Diagnosis:'}</strong> {record.diagnosisText}</p>}
            {record.recommendationsText && <p><strong>{language === 'ru' ? 'Рекомендации:' : 'Recommendations:'}</strong> {record.recommendationsText}</p>}
            {record.prescriptionsText && <p><strong>{language === 'ru' ? 'Препараты:' : 'Prescriptions:'}</strong> {record.prescriptionsText}</p>}
            {renderAttachments(record)}
          </div>
        ))}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
          {!linkedRecordIds.includes(appt.id) && (
            <button type="button" onClick={() => {
              setRecordAppointmentId(appt.id)
              setShowRecordForm(true)
            }}>
              {language === 'ru' ? 'Добавить запись о визите' : 'Add a visit record'}
            </button>
          )}
          {appt.status === 'SCHEDULED' && (
            <>
              <button onClick={() => handleSetStatus(appt, 'COMPLETED')} style={{ border: 'none', background: 'none', color: '#16a34a', cursor: 'pointer', padding: 0, fontSize: 13 }}>
                {language === 'ru' ? 'Завершить' : 'Mark completed'}
              </button>
              <button onClick={() => handleSetStatus(appt, 'CANCELLED')} style={{ border: 'none', background: 'none', color: '#9ca3af', cursor: 'pointer', padding: 0, fontSize: 13 }}>
                {language === 'ru' ? 'Отменить визит' : 'Cancel'}
              </button>
            </>
          )}
          <button onClick={() => setEditingAppt(appt)} style={{ border: 'none', background: 'none', color: '#4f46e5', cursor: 'pointer', padding: 0, fontSize: 13 }}>
            {language === 'ru' ? 'Изменить' : 'Edit'}
          </button>
          <button onClick={() => handleDeleteAppointment(appt.id)} style={{ border: 'none', background: 'none', color: '#c0392b', cursor: 'pointer', padding: 0, fontSize: 13 }}>
            {language === 'ru' ? 'Удалить' : 'Delete'}
          </button>
        </div>
      </div>
    )
  }

  function renderRecord(record: VetRecordDto) {
    return (
      <div style={cardStyle}>
        <strong>{language === 'ru' ? '📋 Медицинская запись' : '📋 Medical record'}</strong>
        <p style={{ margin: '6px 0 0', color: '#475569', fontSize: 14 }}>
          {record.visitDate}
          {record.appointmentId != null ? ' · linked to appointment #' + record.appointmentId : ''}
        </p>
        {record.diagnosisText && (
          <p style={{ margin: '6px 0 0', fontSize: 14 }}>
            <strong>{language === 'ru' ? 'Диагноз:' : 'Diagnosis:'}</strong> {record.diagnosisText}
          </p>
        )}
        {record.recommendationsText && (
          <p style={{ margin: '4px 0 0', fontSize: 14 }}>
            <strong>{language === 'ru' ? 'Рекомендации:' : 'Recommendations:'}</strong> {record.recommendationsText}
          </p>
        )}
        {record.prescriptionsText && (
          <p style={{ margin: '4px 0 0', fontSize: 14 }}>
            <strong>{language === 'ru' ? 'Препараты:' : 'Prescriptions:'}</strong> {record.prescriptionsText}
          </p>
        )}
        {renderAttachments(record)}
        <div style={{ marginTop: 10 }}>
          <button onClick={() => handleDeleteRecord(record.id)} style={{ border: 'none', background: 'none', color: '#c0392b', cursor: 'pointer', padding: 0, fontSize: 13 }}>
            {language === 'ru' ? 'Удалить' : 'Delete'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => setShowApptForm(true)}
          style={{ padding: '8px 16px', borderRadius: 6, border: 'none', backgroundColor: '#4f46e5', color: '#fff', cursor: 'pointer' }}
        >
          {language === 'ru' ? '+ Визит' : '+ Appointment'}
        </button>
        <button
          onClick={() => setShowRecordForm(true)}
          style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #4f46e5', backgroundColor: '#fff', color: '#4f46e5', cursor: 'pointer' }}
        >
          {language === 'ru' ? '+ Запись' : '+ Record'}
        </button>
      </div>

      {error && <p style={{ color: '#c0392b' }} role="alert">{error[language]}</p>}
      {loading && <p>{language === 'ru' ? 'Загрузка…' : 'Loading…'}</p>}
      {!loading && events.length === 0 && (
        <p style={{ color: '#64748b' }}>{language === 'ru' ? 'Визитов и записей пока нет. Добавьте визит или медицинскую запись.' : 'No health events yet. Add an appointment or a medical record above.'}</p>
      )}

      {/* Timeline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, position: 'relative' }}>
        {events.map((event) => (
          <div key={`${event.kind}-${event.appointment?.id ?? event.record?.id}`} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                marginTop: 16,
                flexShrink: 0,
                backgroundColor: event.kind === 'APPOINTMENT' ? '#4f46e5' : '#16a34a',
              }}
            />
            <div style={{ flex: 1 }}>{event.kind === 'APPOINTMENT' && event.appointment ? renderAppointment(event.appointment) : event.record ? renderRecord(event.record) : null}</div>
          </div>
        ))}
      </div>

      {showApptForm && (
        <AppointmentFormModal
          petId={petId}
          token={token}
          onClose={() => setShowApptForm(false)}
          onSaved={() => {
            setShowApptForm(false)
            reload()
          }}
        />
      )}
      {editingAppt && (
        <AppointmentFormModal
          petId={petId}
          token={token}
          appointment={editingAppt}
          onClose={() => setEditingAppt(null)}
          onSaved={() => {
            setEditingAppt(null)
            reload()
          }}
        />
      )}
      {showRecordForm && (
        <RecordFormModal
          petId={petId}
          token={token}
          appointments={appointments}
          existingRecordIds={linkedRecordIds}
          initialAppointmentId={recordAppointmentId}
          onClose={() => {
            setShowRecordForm(false)
            setRecordAppointmentId(undefined)
          }}
          onSaved={() => {
            setShowRecordForm(false)
            setRecordAppointmentId(undefined)
            reload()
          }}
        />
      )}
    </section>
  )
}
