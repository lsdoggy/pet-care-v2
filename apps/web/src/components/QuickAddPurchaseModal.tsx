import { useCallback, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api/client'
import { validateQuickPurchase } from '../lib/quickPurchase'
import Modal from './Modal'

interface Props {
  token: string
  onClose: () => void
  onSaved: () => void
}

/** Creates a custom shopping-list item, never a product or stock mutation. */
export default function QuickAddPurchaseModal({ token, onClose, onSaved }: Props) {
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const inFlight = useRef(false)
  const handleClose = useCallback(() => {
    if (!inFlight.current) onClose()
  }, [onClose])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (inFlight.current) return
    const result = validateQuickPurchase(name, quantity)
    if (result.error) { setError(result.error); return }
    inFlight.current = true
    setSaving(true)
    setError(null)
    try {
      await api.createShoppingItem(result.body!, token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось добавить покупку')
      inFlight.current = false
      setSaving(false)
      return
    }
    setName('')
    setQuantity('1')
    setSaving(false)
    inFlight.current = false
    // Creation has succeeded; a separate dashboard refresh is not part of POST.
    onClose()
    onSaved()
  }

  return (
    <Modal labelledBy="quick-purchase-title" onClose={handleClose}>
      <h2 id="quick-purchase-title">Добавить покупку</h2>
      <p>Покупка сразу появится в списке покупок. Единица: шт.</p>
      <form onSubmit={handleSubmit}>
        <label>Название *<input data-autofocus value={name} disabled={saving} onChange={(e) => setName(e.target.value)} /></label>
        <label>Количество (шт.)<input inputMode="decimal" value={quantity} disabled={saving} onChange={(e) => setQuantity(e.target.value)} /></label>
        {error && <p role="alert">{error}</p>}
        <button type="button" disabled={saving} onClick={handleClose}>Отмена</button>
        <button type="submit" disabled={saving}>{saving ? 'Сохранение…' : 'Добавить'}</button>
      </form>
    </Modal>
  )
}
