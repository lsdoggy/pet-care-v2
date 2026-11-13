import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import type { CreateFoodProductRequest, FoodProductDto } from '../api/types'
import { FOOD_CATEGORY_LABELS } from '../api/types'
import { useAuth } from '../auth/useAuth'
import { tokenStore } from '../auth/tokenStore'
import NavTabs from '../components/NavTabs'
import ProductFormModal from '../components/ProductFormModal'

const pageStyle: React.CSSProperties = {
  fontFamily: 'sans-serif',
  maxWidth: 860,
  margin: '4vh auto',
  padding: '0 16px',
}

const cardStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  padding: 16,
  marginBottom: 14,
  background: '#fff',
}

const smallBtn: React.CSSProperties = {
  minWidth: 44,
  minHeight: 44,
  padding: '6px 12px',
  borderRadius: 6,
  border: '1px solid #cbd5e1',
  background: '#fff',
  cursor: 'pointer',
  fontSize: 13,
}

const primaryBtn: React.CSSProperties = {
  minHeight: 44,
  padding: '8px 16px',
  borderRadius: 6,
  border: 'none',
  background: '#2c3e50',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 14,
}

/** Progress bar denominator: package size if set, otherwise threshold*2 (so the bar is meaningful). */
function stockPercent(p: FoodProductDto): number {
  const capacity = p.packageSizeGrams && p.packageSizeGrams > 0 ? p.packageSizeGrams : Math.max(p.reorderThreshold * 2, 1)
  return Math.min(100, Math.round((p.stockQuantity / capacity) * 100))
}

/** Estimated days left when daily portion is known — shown as a hint on the card. */
function daysLeft(p: FoodProductDto): string | null {
  if (!p.dailyPortionGrams || p.dailyPortionGrams <= 0) return null
  return `${Math.floor(p.stockQuantity / p.dailyPortionGrams)} days left`
}

/**
 * Sprint 5 "Запасы" page: food products with stock progress bars, +/- stock controls,
 * edit/delete and the "Add to Shopping List" button (linked create — idempotent on backend).
 */
export default function StockPage() {
  const { user, loading } = useAuth()
  const [products, setProducts] = useState<FoodProductDto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [editing, setEditing] = useState<FoodProductDto | 'new' | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(() => {
    const token = tokenStore.get()
    if (!token) return
    api
      .listFoodProducts(token)
      .then((list) => {
        setProducts(list)
        setError(null)
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load products'))
  }, [])

  useEffect(() => {
    if (user) load()
  }, [user, load])

  const flash = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(null), 3000)
  }

  const saveProduct = async (body: CreateFoodProductRequest) => {
    const token = tokenStore.get() ?? ''
    setSubmitting(true)
    try {
      if (editing && editing !== 'new') {
        await api.updateFoodProduct(editing.id, body, token)
      } else {
        await api.createFoodProduct(body, token)
      }
      setEditing(null)
      load()
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Failed to save product')
    } finally {
      setSubmitting(false)
    }
  }

  const adjustStock = async (p: FoodProductDto, delta: number) => {
    const token = tokenStore.get() ?? ''
    const next = Math.max(0, p.stockQuantity + delta)
    if (next === p.stockQuantity) return
    try {
      const updated = await api.updateFoodProduct(p.id, { stockQuantity: next }, token)
      setProducts((prev) => prev.map((x) => (x.id === p.id ? updated : x)))
      // Backend suggestion logic: dropping stock to/below the reorder threshold means it's time to buy.
      if (updated.lowStock) flash(`"${updated.name}" is low on stock — add it to the shopping list.`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update stock')
    }
  }

  const addToShoppingList = async (p: FoodProductDto) => {
    const token = tokenStore.get() ?? ''
    try {
      await api.createShoppingItem({ productId: p.id }, token)
      flash(`"${p.name}" added to the shopping list.`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add to shopping list')
    }
  }

  const removeProduct = async (p: FoodProductDto) => {
    if (!window.confirm(`Delete "${p.name}"? Its shopping-list history will be kept but unlinked.`)) return
    const token = tokenStore.get() ?? ''
    try {
      await api.deleteFoodProduct(p.id, token)
      setProducts((prev) => prev.filter((x) => x.id !== p.id))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete product')
    }
  }

  if (loading) return <main style={pageStyle}>Loading…</main>
  if (!user) return <Navigate to="/login" replace />

  return (
    <main style={pageStyle}>
      <NavTabs />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 26, margin: 0 }}>Stock</h1>
        <button style={primaryBtn} onClick={() => setEditing('new')}>
          + New product
        </button>
      </div>

      {error && <p style={{ color: '#c0392b' }}>{error}</p>}
      {notice && <p style={{ color: '#27ae60' }}>{notice}</p>}

      {products.length === 0 && !error && (
        <p style={{ color: '#6b7280', marginTop: 16 }}>No products yet. Add your first food/litter product.</p>
      )}

      <div style={{ marginTop: 20 }}>
        {products.map((p) => {
          const pct = stockPercent(p)
          const days = daysLeft(p)
          return (
            <div key={p.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <strong style={{ fontSize: 16 }}>{p.name}</strong>
                  <span style={{ color: '#6b7280', marginLeft: 8, fontSize: 13 }}>
                    {FOOD_CATEGORY_LABELS[p.category]}
                    {p.brand ? ` · ${p.brand}` : ''}
                  </span>
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 12,
                      color: p.lowStock ? '#a1271b' : '#166534',
                      background: p.lowStock ? '#fdecea' : '#dcfce7',
                      borderRadius: 10,
                      padding: '2px 8px',
                    }}
                  >
                    {p.stockQuantity === 0 ? 'Out of stock' : p.lowStock ? 'Low stock' : 'In stock'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button style={smallBtn} onClick={() => adjustStock(p, -1)} aria-label="Decrease stock">
                    −
                  </button>
                  <span style={{ minWidth: 70, textAlign: 'center', fontSize: 14 }}>
                    {p.stockQuantity} {p.unit.toLowerCase()}
                  </span>
                  <button style={smallBtn} onClick={() => adjustStock(p, 1)} aria-label="Increase stock">
                    +
                  </button>
                </div>
              </div>

              {/* Stock progress bar: red when at/below reorder threshold. */}
              <div
                style={{ height: 8, background: '#edf2f7', borderRadius: 4, marginTop: 10, overflow: 'hidden' }}
                role="progressbar"
                aria-label={`Stock level for ${p.name}`}
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: p.lowStock ? '#c0392b' : pct < 50 ? '#f39c12' : '#27ae60',
                    borderRadius: 4,
                    transition: 'width .3s ease',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: '#6b7280' }}>
                <span>
                  Reorder at ≤ {p.reorderThreshold} {p.unit.toLowerCase()}
                  {days ? ` · ${days}` : ''}
                </span>
                <span>{pct}%</span>
              </div>

              {p.notes && <p style={{ fontSize: 13, color: '#4a5568', margin: '8px 0 0' }}>{p.notes}</p>}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                <button style={smallBtn} onClick={() => addToShoppingList(p)}>
                  🛒 Add to Shopping List
                </button>
                <button style={smallBtn} onClick={() => setEditing(p)}>
                  Edit
                </button>
                <button
                  style={{ ...smallBtn, borderColor: '#c0392b', color: '#c0392b' }}
                  onClick={() => removeProduct(p)}
                >
                  Delete
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {editing && (
        <ProductFormModal
          initial={editing === 'new' ? null : editing}
          submitting={submitting}
          onSubmit={saveProduct}
          onClose={() => setEditing(null)}
        />
      )}
    </main>
  )
}
