export type QuickPurchaseResult =
  | { payload: { customName: string; quantity: number; unit: 'PCS' }; error?: never }
  | { error: string; payload?: never };

export function validateQuickPurchase(name: string, rawQuantity: string): QuickPurchaseResult {
  const customName = name.trim();
  if (customName.length < 1 || customName.length > 150) {
    return { error: 'Название должно содержать от 1 до 150 символов.' };
  }
  const raw = rawQuantity.trim();
  const quantity = Number(raw.replace(',', '.'));
  if (!raw || !Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
    return { error: 'Количество должно быть целым числом от 1 до 999.' };
  }
  return { payload: { customName, quantity, unit: 'PCS' } };
}
