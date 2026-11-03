import { useCallback, useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { api } from '../api/client'
import type { CreateFoodProductRequest, FoodCategory, FoodProductDto, StockUnit } from '../api/types'
import { FOOD_CATEGORIES, FOOD_CATEGORY_LABELS, STOCK_UNITS } from '../api/types'

interface Props {
  token: string
  onClose: () => void
  onSaved: (product: FoodProductDto) => void
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 400,
}

const modalStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: 12,
  padding: 24,
  width: 380,
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

function label(text: string, children: ReactNode): ReactNode {
  return <label style={{ fontSize: 14, color: '#334155' }}>{text}{children}</label>
}

/**
 * Design Sprint 2 (Dashboard quick action "Добавить покупку"):
 * creates a FoodProduct with stock 0 → it immediately shows as low-stock and
 * the existing ShoppingListPage suggestion banner (GET /shopping-list/suggestions)
 * offers it for the list. Reuses POST /food-products — no new endpoints.
 */
export default function QuickAddPurchaseModal({ token, onClose, onSaved }: Props) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<FoodCategory>('DRY')
  const [unit, setUnit] = useState<StockUnit>('PCS')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleClose = useCallback(() => onClose(), [onClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && handleClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleClose])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Укажите название товара')
      return
    }
    setSaving(true)
    try {
      const body: CreateFoodProductRequest = {
        name: name.trim(),
        category,
        unit,
        stockQuantity: 0,
        reorderThreshold: 1,
      }
      const saved = await api.createFoodProduct(body, token)
      onSaved(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={overlayStyle} onClick={handleClose}>
      <div
        style={modalStyle}
        role="dialog"
        aria-modal="true"
        aria-label="Добавить покупку"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: 0, fontSize: 20 }}>Добавить покупку</h2>
        <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>
          Товар появится в «Запасах» с нулевым остатком и попадёт в подсказки списка покупок.
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {label(
            'Название *',
            <input
              style={inputStyle}
              value={name}
              maxLength={150}
              onChange={(e) => setName(e.target.value)}
              placeholder="Корм, наполнитель…"
              autoFocus
            />,
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              {label(
                'Категория',
                <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value as FoodCategory)}>
                  {FOOD_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {FOOD_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>,
              )}
            </div>
            <div style={{ flex: 1 }}>
              {label(
                'Единица',
                <select style={inputStyle} value={unit} onChange={(e) => setUnit(e.target.value as StockUnit)}>
                  {STOCK_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>,
              )}
            </div>
          </div>

          {error && <p style={{ color: '#c0392b', margin: 0, fontSize: 14 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={handleClose} style={{ ...inputStyle, width: 'auto', display: 'inline', marginTop: 0, cursor: 'pointer' }}>
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{ ...inputStyle, width: 'auto', display: 'inline', marginTop: 0, cursor: 'pointer', backgroundColor: '#0d9488', color: '#fff', border: 'none' }}
            >
              {saving ? 'Сохранение…' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
