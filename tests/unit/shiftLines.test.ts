import { describe, expect, it } from 'vitest'
import { buildShiftLines } from '@/features/shift/shiftLines'

const rows = [
  { product_id: 'tinte', balance: 500, unit: 'ml' as const },
  { product_id: 'guantes', balance: 10, unit: 'unit' as const },
  { product_id: 'polvo', balance: 200, unit: 'g' as const },
]

describe('cierre de turno', () => {
  it('ignora filas vacías o en cero y convierte las cantidades', () => {
    expect(buildShiftLines(rows, { tinte: '120,5', guantes: '0', polvo: ' ' })).toEqual({
      lines: [{ productId: 'tinte', qty: 120.5 }],
      errors: {},
    })
  })
  it('rechaza consumos mayores a lo disponible y formatos inválidos', () => {
    const result = buildShiftLines(rows, { tinte: '600', guantes: '1,5', polvo: '50' })
    expect(result.lines).toEqual([{ productId: 'polvo', qty: 50 }])
    expect(Object.keys(result.errors).sort()).toEqual(['guantes', 'tinte'])
  })
})
