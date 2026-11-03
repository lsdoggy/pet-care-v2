import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import '../styles/pets.css'

/**
 * Design Sprint 3 · Pets — базовый доступный модальный контейнер (Web).
 *
 * WCAG AA:
 *  - role="dialog" + aria-modal + aria-labelledby;
 *  - фокус переводится в диалог при открытии и возвращается на предыдущий
 *    элемент при закрытии;
 *  - Tab зациклен внутри диалога (focus-trap без внешних библиотек);
 *  - Escape закрывает диалог;
 *  - клик по затемняющему оверлею закрывает диалог;
 *  - body-скролл блокируется на время открытия.
 *
 * Bottom-sheet поведение на мобильных — через CSS-медиазапрос
 * (см. styles/pets.css), без изменения бизнес-логики вызывающих компонентов.
 */

interface ModalProps {
  /** id заголовка для aria-labelledby. */
  labelledBy: string
  onClose: () => void
  children: ReactNode
  /** Дополнительный класс к окну (например pc-modal--form / pc-modal--confirm). */
  className?: string
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export default function Modal({ labelledBy, onClose, children, className }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    // Переносим фокус внутрь диалога сразу после монтирования.
    const focusTarget =
      dialogRef.current?.querySelector<HTMLElement>('[data-autofocus]') ??
      dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    focusTarget?.focus()

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !dialogRef.current) return
      // Простейший focus-trap: цикл Tab/Shift+Tab по интерактивным элементам диалога.
      const nodes = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      )
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus()
    }
  }, [onClose])

  return (
    <div className="pc-modal-overlay" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`pc-modal${className ? ` ${className}` : ''}`}
        // Клик/drag внутри окна не должен закрывать оверлей.
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
