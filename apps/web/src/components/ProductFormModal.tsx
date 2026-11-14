import { STOCK_UNIT_LABELS } from '../api/types'
import { useLanguage } from '../i18n/language'
import { useId, useState } from 'react'
import Modal from './Modal'
import type { CreateFoodProductRequest, FoodCategory, FoodProductDto, StockUnit } from '../api/types'
import { FOOD_CATEGORIES, FOOD_CATEGORY_LABELS, ENGLISH_FOOD_CATEGORY_LABELS, STOCK_UNITS } from '../api/types'

interface Props {
  /** When set, the modal is in EDIT mode and prefills with this product. */
  initial?: FoodProductDto | null
  submitting: boolean
  onSubmit: (body: CreateFoodProductRequest) => void
  onClose: () => void
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, marginBottom: 4, color: '#555' }

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 6,
  border: '1px solid #ccc',
  fontSize: 'var(--font-size-md)',
  boxSizing: 'border-box',
}

/** Numeric input helper: empty string -> null (PATCH "keep value" semantics handled by caller). */
function toIntOrNull(value: string): number | null {
  if (value.trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

/**
 * Sprint 5: create/edit form for a food product (stock card).
 * Validation mirrors backend @Valid constraints; server errors are shown inline by the page.
 */
export default function ProductFormModal({ initial, submitting, onSubmit, onClose }: Props) {
  const { language } = useLanguage()
  const titleId = useId()
  const [name, setName] = useState(initial?.name ?? '')
  const [brand, setBrand] = useState(initial?.brand ?? '')
  const [category, setCategory] = useState<FoodCategory>(initial?.category ?? 'DRY')
  const [unit, setUnit] = useState<StockUnit>(initial?.unit ?? 'PCS')
  const [packageSize, setPackageSize] = useState(String(initial?.packageSizeGrams ?? ''))
  const [dailyPortion, setDailyPortion] = useState(String(initial?.dailyPortionGrams ?? ''))
  const [stock, setStock] = useState(String(initial?.stockQuantity ?? ''))
  const [threshold, setThreshold] = useState(String(initial?.reorderThreshold ?? ''))
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [localError, setLocalError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setLocalError('Name is required')
      return
    }
    setLocalError(null)
    onSubmit({
      name: name.trim(),
      brand: brand.trim() || null,
      category,
      unit,
      packageSizeGrams: toIntOrNull(packageSize),
      dailyPortionGrams: toIntOrNull(dailyPortion),
      stockQuantity: toIntOrNull(stock) ?? 0,
      reorderThreshold: toIntOrNull(threshold) ?? 0,
      notes: notes.trim() || null,
    })
  }

  return (
    <Modal labelledBy={titleId} onClose={onClose}>
      <h2 id={titleId} className="pc-modal__title">{initial ? (language === 'ru' ? 'Редактировать товар' : 'Edit product') : (language === 'ru' ? 'Новый товар' : 'New product')}</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={labelStyle}>{language === 'ru' ? 'Название *' : 'Name *'}</label>
          <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} maxLength={150} />
        </div>
        <div>
          <label style={labelStyle}>{language === 'ru' ? 'Бренд' : 'Brand'}</label>
          <input style={inputStyle} value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={150} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{language === 'ru' ? 'Категория' : 'Category'}</label>
            <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value as FoodCategory)}>
              {FOOD_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {(language === 'ru' ? FOOD_CATEGORY_LABELS : ENGLISH_FOOD_CATEGORY_LABELS)[c]}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{language === 'ru' ? 'Единица измерения' : 'Unit'}</label>
            <select style={inputStyle} value={unit} onChange={(e) => setUnit(e.target.value as StockUnit)}>
              {STOCK_UNITS.map((u) => (
                <option key={u} value={u}>
                  {STOCK_UNIT_LABELS[language][u]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{language === 'ru' ? 'Количество в запасе' : 'Stock quantity'}</label>
            <input
              style={inputStyle}
              type="number"
              min={0}
              max={1000000}
              value={stock}
              onChange={(e) => setStock(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{language === 'ru' ? 'Порог закупки' : 'Reorder threshold'}</label>
            <input
              style={inputStyle}
              type="number"
              min={0}
              max={1000000}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{language === 'ru' ? 'Размер упаковки, г' : 'Package size, g'}</label>
            <input
              style={inputStyle}
              type="number"
              min={1}
              max={1000000}
              value={packageSize}
              onChange={(e) => setPackageSize(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{language === 'ru' ? 'Дневная порция, г' : 'Daily portion, g'}</label>
            <input
              style={inputStyle}
              type="number"
              min={0}
              max={100000}
              value={dailyPortion}
              onChange={(e) => setDailyPortion(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label style={labelStyle}>{language === 'ru' ? 'Заметки' : 'Notes'}</label>
          <textarea
            style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={2000}
          />
        </div>
        {localError ? <p style={{ color: '#c0392b', fontSize: 13, margin: 0 }}>{language === 'ru' ? 'Укажите название товара.' : localError}</p> : null}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" style={cancelBtn} onClick={onClose}>
            {language === 'ru' ? 'Отмена' : 'Cancel'}
          </button>
          <button type="submit" style={primaryBtn} disabled={submitting}>
            {submitting ? (language === 'ru' ? 'Сохранение…' : 'Saving…') : (language === 'ru' ? 'Сохранить' : 'Save')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

const cancelBtn: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 6,
  border: '1px solid #ccc',
  background: '#fff',
  cursor: 'pointer',
  fontSize: 14,
}

const primaryBtn: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 6,
  border: 'none',
  background: '#2c3e50',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 14,
}
