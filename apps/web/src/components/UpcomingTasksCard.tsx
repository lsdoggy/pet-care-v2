import { useState } from 'react'
import type { CareTaskDto } from '../api/types'
import { TASK_TYPE_LABELS, formatDueAt } from '../api/types'

interface Props {
  tasks: CareTaskDto[]
  /** Called when the user toggles a checkbox. The parent performs the API call and refresh. */
  onComplete: (task: CareTaskDto) => Promise<void>
  onNewTask: () => void
}

const cardStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: 12,
  border: '1px solid #e2e8f0',
  padding: 16,
  marginTop: 24,
}

/** "Ближайшие события" — upcoming pending care tasks with completion checkboxes. */
export default function UpcomingTasksCard({ tasks, onComplete, onNewTask }: Props) {
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleToggle(task: CareTaskDto) {
    setError(null)
    setBusyId(task.id)
    try {
      await onComplete(task)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section style={cardStyle} aria-label="Upcoming events">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>📅 Upcoming events</h2>
        <button
          type="button"
          onClick={onNewTask}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            border: 'none',
            backgroundColor: '#4f46e5',
            color: '#fff',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          + Add task
        </button>
      </div>

      {error && <p style={{ color: '#c0392b', fontSize: 14 }}>{error}</p>}

      {tasks.length === 0 ? (
        <p style={{ color: '#6b7280', marginBottom: 0 }}>No upcoming tasks. Enjoy the quiet 🐾</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tasks.map((task) => (
            <li
              key={task.id}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', borderBottom: '1px solid #f1f5f9' }}
            >
              <input
                type="checkbox"
                aria-label={`Mark "${task.title}" as done`}
                disabled={busyId === task.id}
                onChange={(e) => {
                  if (e.target.checked) void handleToggle(task)
                }}
                style={{ width: 18, height: 18, cursor: busyId === task.id ? 'wait' : 'pointer' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>
                  {task.title}
                  {task.recurrenceRule && (
                    <span title={`Repeats: ${task.recurrenceRule}`} style={{ marginLeft: 6, fontSize: 13 }}>
                      🔁
                    </span>
                  )}
                </div>
                <div style={{ color: '#6b7280', fontSize: 13 }}>
                  {TASK_TYPE_LABELS[task.type]} · {task.petName} · {formatDueAt(task.dueAt)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
