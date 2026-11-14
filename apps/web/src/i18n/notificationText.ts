import type { NotificationDto } from '../api/types'
import type { Language } from './language'

export function notificationText(notification: NotificationDto, language: Language): { title: string; body: string } {
  const { title, body, payloadJson } = notification
  if (!payloadJson) return { title, body }

  let payload: unknown
  try {
    payload = JSON.parse(payloadJson)
  } catch {
    return { title, body }
  }
  if (typeof payload !== 'object' || payload === null) return { title, body }

  if ('type' in payload && payload.type === 'low_stock' &&
      'productName' in payload && typeof payload.productName === 'string') {
    return language === 'ru'
      ? { title: 'Мало корма', body: `Остаток «${payload.productName}» достиг порога закупки.` }
      : { title: 'Low food stock', body: `“${payload.productName}” has reached its reorder threshold.` }
  }
  if ('taskTitle' in payload && typeof payload.taskTitle === 'string' &&
      'petName' in payload && typeof payload.petName === 'string' &&
      'overdue' in payload && typeof payload.overdue === 'boolean' &&
      'dueAt' in payload && typeof payload.dueAt === 'string') {
    const due = new Date(payload.dueAt)
    if (!Number.isFinite(due.getTime())) return { title, body }
    const date = due.toLocaleString(language, { dateStyle: 'medium', timeStyle: 'short' })
    return language === 'ru'
      ? {
          title: payload.overdue ? 'Просроченная задача ухода' : 'Напоминание об уходе',
          body: `«${payload.taskTitle}» · ${payload.petName} · ${payload.overdue ? 'Просрочено с' : 'Срок'} ${date}`,
        }
      : {
          title: payload.overdue ? 'Overdue care task' : 'Care reminder',
          body: `“${payload.taskTitle}” · ${payload.petName} · ${payload.overdue ? 'Overdue since' : 'Due'} ${date}`,
        }
  }
  return { title, body }
}
