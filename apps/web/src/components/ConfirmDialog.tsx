import { useLanguage } from '../i18n/language'
import { useState } from 'react'
import Modal from './Modal'
import { AlertIcon } from './icons'
import '../styles/pets.css'

/**
 * Design Sprint 3 · Pets — доступная замена window.confirm().
 *
 * Используется для подтверждения удаления питомца (требование 5 спринта):
 * опасное действие требует явного подтверждения, кнопка «Удалить» — danger-стиль,
 * диалог доступен с клавиатуры (focus-trap/Escape — см. Modal).
 */

interface ConfirmDialogProps {
  titleId: string
  title: string
  /** Основной текст подтверждения. */
  description: string
  confirmLabel?: string
  cancelLabel?: string
  /** true, пока выполняется опасное действие (блокирует кнопки). */
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}

export default function ConfirmDialog({
  titleId,
  title,
  description,
  confirmLabel,
  cancelLabel,
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const { language } = useLanguage()
  const [pending, setPending] = useState(false)
  const locked = busy || pending

  async function handleConfirm() {
    setPending(true)
    try {
      await onConfirm()
    } finally {
      setPending(false)
    }
  }

  return (
    <Modal labelledBy={titleId} onClose={locked ? () => undefined : onCancel} className="pc-modal--confirm">
      <div className="pc-confirm__icon" aria-hidden="true">
        <AlertIcon size={26} />
      </div>
      <h2 id={titleId} className="pc-modal__title">
        {title}
      </h2>
      <p className="pc-confirm__text">{description}</p>
      <div className="pc-modal__actions">
        <button type="button" className="pc-btn pc-btn--ghost" onClick={onCancel} disabled={locked}>
          {cancelLabel ?? (language === 'ru' ? 'Отмена' : 'Cancel')}
        </button>
        <button type="button" className="pc-btn pc-btn--danger" onClick={() => void handleConfirm()} disabled={locked}>
          {locked ? (language === 'ru' ? 'Выполняется…' : 'Working…') : confirmLabel ?? (language === 'ru' ? 'Удалить' : 'Delete')}
        </button>
      </div>
    </Modal>
  )
}
