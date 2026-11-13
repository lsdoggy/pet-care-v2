import type { CreateShoppingItemRequest } from '../api/types'

export function validateQuickPurchase(name: string, quantityInput: string):
  { body: CreateShoppingItemRequest; error?: never } | { error: string; body?: never } {
  const customName = name.trim()
  if (customName.length < 1 || customName.length > 150) return { error: 'Название должно содержать от 1 до 150 символов' }
  const input = quantityInput.trim().replace(',', '.')
  const quantity = Number(input)
  if (!input || !Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
    return { error: 'Количество должно быть целым числом от 1 до 999' }
  }
  return { body: { customName, quantity, unit: 'PCS' } }
}
