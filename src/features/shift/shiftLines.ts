import { parseQuantity, type UnitKind } from '@/lib/quantity'

export type ShiftStockRow = { product_id: string; balance: number; unit: UnitKind }
export type ShiftLine = { productId: string; qty: number }

/** Convierte lo escrito en cada fila en consumos válidos. Las filas vacías se ignoran. */
export function buildShiftLines(rows: ShiftStockRow[], inputs: Record<string, string>) {
  const lines: ShiftLine[] = []
  const errors: Record<string, string> = {}
  for (const row of rows) {
    const text = inputs[row.product_id]?.trim()
    if (!text) continue
    const parsed = parseQuantity(text, row.unit)
    if (!parsed.ok) errors[row.product_id] = parsed.error
    else if (parsed.value === 0) continue
    else if (parsed.value > row.balance) errors[row.product_id] = 'Supera lo disponible.'
    else lines.push({ productId: row.product_id, qty: parsed.value })
  }
  return { lines, errors }
}
