import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { api } from '../api/client'
import type { NotificationDto } from '../api/types'

interface NotificationBellProps {
  token: string
}

/**
 * Sprint 6 — header bell with unread badge. Polls GET /notifications/unread-count
 * every 30 s and opens a dropdown feed (GET /notifications). Clicking an item
 * marks it read via POST /notifications/{id}/read.
 */
export default function NotificationBell({ token }: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState<NotificationDto[]>([])
  const [loading, setLoading] = useState(false)

  const refreshCount = useCallback(() => {
    if (!token) return
    api
      .unreadNotificationCount(token)
      .then((r) => setUnread(r.count))
      .catch(() => {
        /* badge is best-effort; ignore transient errors */
      })
  }, [token])

  useEffect(() => {
    refreshCount()
    const id = window.setInterval(refreshCount, 30_000)
    return () => window.clearInterval(id)
  }, [refreshCount])

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev
      if (next && token) {
        setLoading(true)
        api
          .listNotifications(token)
          .then(setItems)
          .catch(() => setItems([]))
          .finally(() => setLoading(false))
      }
      return next
    })
  }, [token])

  const markRead = useCallback(
    async (n: NotificationDto) => {
      if (n.channelStatus === 'read' || !token) return
      try {
        const updated = await api.markNotificationRead(n.id, token)
        setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
        setUnread((c) => Math.max(0, c - 1))
      } catch {
        /* non-critical */
      }
    },
    [token],
  )

  return (
    <div style={{ position: 'relative' }}>
      <button type="button" onClick={() => void toggle()} aria-label="Notifications" style={bellBtn}>
        🔔
        {unread > 0 && <span style={badgeStyle}>{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div style={dropdownStyle}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Notifications</div>
          {loading && <div style={hintStyle}>Loading…</div>}
          {!loading && items.length === 0 && <div style={hintStyle}>Nothing yet. Reminders will appear here.</div>}
          {items.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => void markRead(n)}
              style={itemStyle}
              title={n.channelStatus === 'read' ? 'Read' : 'Mark as read'}
            >
              <span style={{ color: n.channelStatus === 'read' ? '#cbd5e1' : '#4f46e5' }}>
                {n.channelStatus === 'read' ? '○' : '●'}
              </span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontWeight: 600, fontSize: 13, color: n.channelStatus === 'read' ? '#9ca3af' : '#111827' }}>
                  {n.title}
                </span>
                <span style={{ display: 'block', fontSize: 12, color: '#6b7280' }}>{n.body}</span>
                <span style={{ display: 'block', fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                  {new Date(n.createdAt).toLocaleString()} · {n.type}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const bellBtn: CSSProperties = {
  position: 'relative',
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  background: '#fff',
  padding: '6px 10px',
  cursor: 'pointer',
  fontSize: 16,
}

const badgeStyle: CSSProperties = {
  position: 'absolute',
  top: -6,
  right: -6,
  minWidth: 18,
  height: 18,
  borderRadius: 9,
  background: '#ef4444',
  color: '#fff',
  fontSize: 11,
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 4px',
}

const dropdownStyle: CSSProperties = {
  position: 'absolute',
  right: 0,
  top: 'calc(100% + 8px)',
  width: 340,
  maxHeight: 420,
  overflowY: 'auto',
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.12)',
  padding: 12,
  zIndex: 50,
}

const hintStyle: CSSProperties = { color: '#6b7280', fontSize: 13 }

const itemStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'flex-start',
  width: '100%',
  textAlign: 'left',
  border: 'none',
  borderBottom: '1px solid #f1f5f9',
  background: 'transparent',
  padding: '8px 4px',
  cursor: 'pointer',
}
