import { describe, expect, it } from 'vitest'
import { previewCsv } from '@/features/imports/preview'

describe('vista previa CSV', () => {
  it('rechaza SKU duplicado antes de confirmar', () => {
    const result = previewCsv('catalog', [
      ['sku', 'name', 'unit', 'brand', 'category', 'presentation', 'presentation_qty'],
      ['A-1', 'Producto A', 'unit', '', '', '', ''],
      ['a-1', 'Producto B', 'unit', '', '', '', ''],
    ])
    expect(result.errors).toContain('Fila 3: SKU repetido en el archivo.')
  })
  it('previsualiza saldos con punto decimal y detecta cantidad inválida', () => {
    const result = previewCsv('initial', [
      ['branch_code', 'sku', 'qty', 'min_qty'],
      ['CENTRO', 'SH-1', '25.50', '10'],
      ['CENTRO', 'SH-2', '1,5', '0'],
    ])
    expect(result.rows[0]?.qty).toBe(25.5)
    expect(result.errors).toContain('Fila 3: cantidad o mínimo inválido; usá punto decimal.')
  })
})
