import { useLanguage } from '../i18n/language'
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
const englishErrors: Readonly<Record<string, string>> = {
  'Название должно содержать от 1 до 150 символов': 'The name must be between 1 and 150 characters.',
  'Количество должно быть целым числом от 1 до 999': 'Enter a whole number between 1 and 999.',
  'Не удалось добавить покупку': 'Could not add the purchase.',
}

export default function QuickAddPurchaseModal({ token, onClose, onSaved }: Props) {
  const { language } = useLanguage()
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
      <h2 id="quick-purchase-title">{language === 'ru' ? 'Добавить покупку' : 'Add a purchase'}</h2>
      <p>{language === 'ru' ? 'Покупка сразу появится в списке покупок. Единица: шт.' : 'The item will appear in the shopping list. Quantity is in pieces.'}</p>
      <form onSubmit={handleSubmit}>
        <label>{language === 'ru' ? 'Название *' : 'Name *'}<input data-autofocus value={name} disabled={saving} onChange={(e) => setName(e.target.value)} /></label>
        <label>{language === 'ru' ? 'Количество (шт.)' : 'Quantity (pcs)'}<input inputMode="decimal" value={quantity} disabled={saving} onChange={(e) => setQuantity(e.target.value)} /></label>
        {error && <p role="alert">{
          language === 'ru' ? error : Object.prototype.hasOwnProperty.call(englishErrors, error) ? englishErrors[error] : error
        }</p>}
        <button type="button" disabled={saving} onClick={handleClose}>{language === 'ru' ? 'Отмена' : 'Cancel'}</button>
        <button type="submit" disabled={saving}>{saving ? (language === 'ru' ? 'Сохранение…' : 'Saving…') : (language === 'ru' ? 'Добавить' : 'Add')}</button>
      </form>
    </Modal>
  )
}
