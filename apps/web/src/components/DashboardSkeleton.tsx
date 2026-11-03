import type { CSSProperties } from 'react'
import '../styles/dashboard.css'

/**
 * Design Sprint 2 — Dashboard loading skeleton.
 * Mirrors the real section geometry (attention card → quick actions → pets → events)
 * so the layout does not jump when data arrives. Decorative only: aria-hidden +
 * an sr-only live message.
 */

const block = (w: string | number, h = 16, style?: CSSProperties): CSSProperties => ({
  width: w,
  height: h,
  ...style,
})

export default function DashboardSkeleton() {
  return (
    <div className="pc-skeleton-stack" role="status" aria-busy="true">
      <span className="sr-only">Загрузка данных…</span>

      {/* Greeting */}
      <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <span className="pc-skeleton" style={block(140, 12)} />
        <span className="pc-skeleton" style={block('60%', 28)} />
      </div>

      {/* Attention card */}
      <div className="pc-skeleton-card" aria-hidden="true">
        <span className="pc-skeleton" style={block(180, 20)} />
        <span className="pc-skeleton" style={block('100%', 44)} />
        <span className="pc-skeleton" style={block('85%', 44)} />
        <span className="pc-skeleton" style={block('70%', 44)} />
      </div>

      {/* Quick actions */}
      <div className="pc-quick" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="pc-skeleton" style={{ ...block('100%', 76), borderRadius: 'var(--radius-card)' }} />
        ))}
      </div>

      {/* Pet cards */}
      <div className="pc-pets" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span key={i} className="pc-skeleton" style={{ ...block('100%', 84), borderRadius: 'var(--radius-card)' }} />
        ))}
      </div>

      {/* Events list */}
      <div className="pc-skeleton-card" aria-hidden="true">
        <span className="pc-skeleton" style={block(160, 20)} />
        <span className="pc-skeleton" style={block('100%', 20)} />
        <span className="pc-skeleton" style={block('90%', 20)} />
        <span className="pc-skeleton" style={block('75%', 20)} />
      </div>
    </div>
  )
}
