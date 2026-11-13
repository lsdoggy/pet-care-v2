import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api/client'
import type { CreateRecordRequest, VetAppointmentDto, VetRecordDto } from '../api/types'

interface Props {
  petId: number
  token: string
  /** Existing appointments of this pet to optionally link the record to. */
  appointments: VetAppointmentDto[]
  existingRecordIds: number[]
  initialAppointmentId?: number
  onClose: () => void
  onSaved: (record: VetRecordDto) => void
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
  width: 440,
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

function todayLocalIso(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Sprint 4: create a veterinary record. Flow: POST /records -> for each picked file
 * POST /records/{id}/attachments. Attachments are optional.
 */
export default function RecordFormModal({ petId, token, appointments, existingRecordIds, initialAppointmentId, onClose, onSaved }: Props) {
  const [visitDate, setVisitDate] = useState(todayLocalIso())
  const [appointmentId, setAppointmentId] = useState(initialAppointmentId?.toString() ?? '')
  const [diagnosis, setDiagnosis] = useState('')
  const [recommendations, setRecommendations] = useState('')
  const [prescriptions, setPrescriptions] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [savedRecord, setSavedRecord] = useState<VetRecordDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Only completed/scheduled appointments not yet linked can be selected.
  const selectableAppointments = appointments.filter((a) => !existingRecordIds.includes(a.id))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && (savedRecord ? onSaved(savedRecord) : onClose())
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onSaved, savedRecord, saving])

  function addFiles(selected: File[]) {
    const accepted = selected.filter((file) =>
      /\.(pdf|jpe?g|png|webp)$/i.test(file.name) && file.size > 0 && file.size <= 10 * 1024 * 1024
    )
    setFiles((pending) => [...pending, ...accepted])
    setError(accepted.length === selected.length ? null : 'Можно прикрепить непустые фото и PDF размером до 10 МБ.')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (saving) return
    setError(null)

    if (!visitDate) {
      setError('Visit date is required')
      return
    }
    if (visitDate > todayLocalIso()) {
      setError('Visit date cannot be in the future')
      return
    }

    setSaving(true)
    try {
      const body: CreateRecordRequest = {
        petId,
        appointmentId: appointmentId ? Number(appointmentId) : null,
        visitDate,
        diagnosisText: diagnosis.trim() || null,
        recommendationsText: recommendations.trim() || null,
        prescriptionsText: prescriptions.trim() || null,
      }
      let saved = savedRecord ?? await api.createRecord(body, token)
      setSavedRecord(saved)
      // Upload attachments sequentially — the backend appends them into attachments_jsonb.
      for (const file of files) {
        saved = await api.uploadRecordAttachment(saved.id, file, token)
        setSavedRecord(saved)
        setFiles((pending) => pending.filter((item) => item !== file))
      }
      onSaved(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={overlayStyle} onClick={() => !saving && (savedRecord ? onSaved(savedRecord) : onClose())}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: 0, fontSize: 20 }}>New health record</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <fieldset disabled={saving || savedRecord !== null} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: 'grid', gap: 12 }}>
            <label style={labelStyle}>
              Visit date *
              <input style={inputStyle} type="date" value={visitDate} max={todayLocalIso()} onChange={(e) => setVisitDate(e.target.value)} />
            </label>
            <label style={labelStyle}>
              Link to appointment (optional)
              <select style={inputStyle} value={appointmentId} onChange={(e) => setAppointmentId(e.target.value)}>
                <option value="">— no appointment —</option>
                {selectableAppointments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {new Date(a.scheduledAt).toLocaleDateString()} · {a.clinicName}
                  </option>
                ))}
              </select>
            </label>
            <label style={labelStyle}>
              Diagnosis
              <textarea style={{ ...inputStyle, minHeight: 56 }} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} maxLength={4000} />
            </label>
            <label style={labelStyle}>
              Recommendations
              <textarea style={{ ...inputStyle, minHeight: 56 }} value={recommendations} onChange={(e) => setRecommendations(e.target.value)} maxLength={4000} />
            </label>
            <label style={labelStyle}>
              Prescriptions
              <textarea style={{ ...inputStyle, minHeight: 56 }} value={prescriptions} onChange={(e) => setPrescriptions(e.target.value)} maxLength={4000} />
            </label>
          </fieldset>
          <fieldset
            disabled={saving}
            style={{ border: '1px dashed #cbd5e1', borderRadius: 6, padding: 12, minWidth: 0 }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              if (!saving) addFiles(Array.from(event.dataTransfer.files))
            }}
          >
            <legend>Вложения</legend>
            <label style={labelStyle}>
              Перетащите фото или PDF сюда либо выберите файл (до 10 МБ).
              <input
                style={{ ...inputStyle, border: 'none', padding: '4px 0' }}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(event) => {
                  addFiles(Array.from(event.target.files ?? []))
                  event.target.value = ''
                }}
              />
            </label>
            {files.length > 0 && (
              <ul>
                {files.map((file, index) => (
                  <li key={index}>
                    {file.name}{' '}
                    <button type="button" onClick={() => setFiles((pending) => pending.filter((_, i) => i !== index))}>
                      Удалить
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>

          {error && <p style={{ color: '#c0392b', margin: 0 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => !saving && (savedRecord ? onSaved(savedRecord) : onClose())} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #cbd5e1', backgroundColor: '#fff', cursor: 'pointer' }}>
              {savedRecord ? 'Закрыть' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{ padding: '8px 20px', borderRadius: 6, border: 'none', backgroundColor: '#4f46e5', color: '#fff', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
