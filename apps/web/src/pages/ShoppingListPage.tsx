import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import type { FoodProductDto, ShoppingItemDto } from '../api/types'
import { useAuth } from '../auth/useAuth'
import { tokenStore } from '../auth/tokenStore'
import NavTabs from '../components/NavTabs'

const pageStyle: React.CSSProperties = {
  fontFamily: 'sans-serif',
  maxWidth: 860,
  margin: '4vh auto',
  padding: '0 16px',
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 12px',
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  marginBottom: 8,
  background: '#fff',
}

const smallBtn: React.CSSProperties = {
  minWidth: 44,
  minHeight: 44,
  padding: '5px 10px',
  borderRadius: 6,
  border: '1px solid #cbd5e1',
  background: '#fff',
  cursor: 'pointer',
  fontSize: 13,
}

/** Formats a purchased-at instant for the "bought" section header. */
function formatPurchasedAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

/**
 * Sprint 5 "Купить" page: shopping checklist (open items first), quick-add custom item,
 * purchase checkbox with optional restock of the linked product, and a low-stock
 * suggestions banner fed by GET /shopping-list/suggestions.
 */
export default function ShoppingListPage() {
  const { user, loading } = useAuth()
  const [items, setItems] = useState<ShoppingItemDto[]>([])
  const [suggestions, setSuggestions] = useState<FoodProductDto[]>([])
  const [productNameById, setProductNameById] = useState<Map<number, string>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [quickName, setQuickName] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(() => {
    const token = tokenStore.get()
    if (!token) return
    Promise.all([api.listShoppingItems(token), api.listShoppingSuggestions(token), api.listFoodProducts(token)])
      .then(([list, sugg, products]) => {
        setItems(list)
        setSuggestions(sugg)
        setProductNameById(new Map(products.map((p) => [p.id, p.name])))
        setError(null)
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load shopping list'))
  }, [])

  useEffect(() => {
    if (user) load()
  }, [user, load])

  const openItems = items.filter((i) => !i.isPurchased)
  const purchasedItems = items.filter((i) => i.isPurchased)

  const addCustomItem = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = quickName.trim()
    if (!name) return
    const token = tokenStore.get() ?? ''
    try {
      await api.createShoppingItem({ customName: name }, token)
      setQuickName('')
      load()
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Failed to add item')
    }
  }

  /**
   * Checkbox toggle → POST /purchase. For linked products we pass addStockQuantity equal to the
   * item quantity so the stock is topped up in the same backend transaction; custom items send null.
   */
  const markPurchased = async (item: ShoppingItemDto) => {
    const token = tokenStore.get() ?? ''
    setBusyId(item.id)
    try {
      await api.purchaseShoppingItem(
        item.id,
        item.productId != null ? { addStockQuantity: item.quantity } : null,
        token,
      )
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to mark as purchased')
    } finally {
      setBusyId(null)
    }
  }

  const removeItem = async (item: ShoppingItemDto) => {
    const token = tokenStore.get() ?? ''
    try {
      await api.deleteShoppingItem(item.id, token)
      setItems((prev) => prev.filter((x) => x.id !== item.id))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove item')
    }
  }

  const addSuggestionToList = async (product: FoodProductDto) => {
    const token = tokenStore.get() ?? ''
    try {
      await api.createShoppingItem({ productId: product.id }, token)
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add suggestion')
    }
  }

  if (loading) return <main style={pageStyle}>Loading…</main>
  if (!user) return <Navigate to="/login" replace />

  return (
    <main style={pageStyle}>
      <NavTabs />
      <h1 style={{ fontSize: 26 }}>Shopping list</h1>

      {error && <p style={{ color: '#c0392b' }}>{error}</p>}

      {/* Low-stock suggestion banner (system offers, user confirms — MVP per sprint spec). */}
      {suggestions.length > 0 && (
        <div style={{ background: '#fff8e1', border: '1px solid #f6d365', borderRadius: 10, padding: 12, marginBottom: 16 }}>
          <strong style={{ fontSize: 14 }}>Running low</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {suggestions.map((s) => (
              <li key={s.id} style={{ fontSize: 14, marginBottom: 4 }}>
                {s.name} ({s.stockQuantity} {s.unit.toLowerCase()} left){' '}
                <button style={smallBtn} onClick={() => addSuggestionToList(s)}>
                  Add
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Quick add (custom item) */}
      <form onSubmit={addCustomItem} style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <input
          value={quickName}
          onChange={(e) => setQuickName(e.target.value)}
          placeholder="Add item… e.g. Cat litter bags"
          maxLength={150}
          style={{
            flex: 1,
            minWidth: 0,
            padding: '8px 10px',
            borderRadius: 6,
            border: '1px solid #ccc',
            fontSize: 'var(--font-size-md)',
          }}
        />
        <button type="submit" style={smallBtn} disabled={!quickName.trim()}>
          Add
        </button>
      </form>

      <h2 style={{ fontSize: 17, marginBottom: 8 }}>To buy ({openItems.length})</h2>
      {openItems.length === 0 && !error && <p style={{ color: '#6b7280' }}>Nothing to buy. 🎉</p>}
      {openItems.map((item) => (
        <div key={item.id} style={rowStyle}>
          <label style={{ width: 44, height: 44, flexShrink: 0, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              aria-label={`Mark ${item.customName} purchased`}
              checked={false}
              disabled={busyId === item.id}
              onChange={() => markPurchased(item)}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
          </label>
          <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
            {item.customName}
            <span style={{ color: '#6b7280', fontSize: 13, marginLeft: 6 }}>
              × {item.quantity} {item.unit.toLowerCase()}
              {item.productId != null && productNameById.has(item.productId) ? ' · from catalog' : ''}
            </span>
          </span>
          <button style={smallBtn} onClick={() => removeItem(item)} aria-label="Remove item">
            ✕
          </button>
        </div>
      ))}

      {purchasedItems.length > 0 && (
        <>
          <h2 style={{ fontSize: 17, margin: '20px 0 8px' }}>Purchased</h2>
          {purchasedItems.map((item) => (
            <div key={item.id} style={{ ...rowStyle, opacity: 0.7 }}>
              <input type="checkbox" checked readOnly aria-label={`${item.customName} purchased`} style={{ width: 18, height: 18 }} />
              <span style={{ flex: 1, textDecoration: 'line-through', color: '#6b7280' }}>
                {item.customName}
                <span style={{ fontSize: 12, marginLeft: 8 }}>
                  {item.purchasedAt ? formatPurchasedAt(item.purchasedAt) : ''}
                </span>
              </span>
              <button style={smallBtn} onClick={() => removeItem(item)} aria-label="Remove item">
                ✕
              </button>
            </div>
          ))}
        </>
      )}
    </main>
  )
}
