import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api/client'
import type { CreateRecordRequest, VetAppointmentDto, VetRecordDto } from '../api/types'

interface Props {
  petId: number
  token: string
  /** Existing appointments of this pet to optionally link the record to. */
  appointments: VetAppointmentDto[]
  existingRecordIds: number[]
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
export default function RecordFormModal({ petId, token, appointments, existingRecordIds, onClose, onSaved }: Props) {
  const [visitDate, setVisitDate] = useState(todayLocalIso())
  const [appointmentId, setAppointmentId] = useState<string>('')
  const [diagnosis, setDiagnosis] = useState('')
  const [recommendations, setRecommendations] = useState('')
  const [prescriptions, setPrescriptions] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Only completed/scheduled appointments not yet linked can be selected.
  const selectableAppointments = appointments.filter((a) => !existingRecordIds.includes(a.id))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
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
      let saved = await api.createRecord(body, token)
      // Upload attachments sequentially — the backend appends them into attachments_jsonb.
      for (const file of files) {
        saved = await api.uploadRecordAttachment(saved.id, file, token)
      }
      onSaved(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: 0, fontSize: 20 }}>New health record</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
          <label style={labelStyle}>
            Attachments (PDF/images, ≤10 MB each)
            <input
              ref={fileRef}
              style={{ ...inputStyle, border: 'none', padding: '4px 0' }}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            {files.length > 0 && (
              <span style={{ color: '#475569' }}>
                {files.map((f) => f.name).join(', ')}
              </span>
            )}
          </label>

          {error && <p style={{ color: '#c0392b', margin: 0 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #cbd5e1', backgroundColor: '#fff', cursor: 'pointer' }}>
              Cancel
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
