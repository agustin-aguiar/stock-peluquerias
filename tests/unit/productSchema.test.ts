import { describe, expect, it } from 'vitest'
import { productSchema } from '@/features/products/schema'
import { fieldErrors } from '@/lib/validation'

const base = {
  sku: 'SH-PRO-1', name: 'Shampoo', unit: 'ml', brand: '', category: 'Profesional', variant: '',
  presentation: 'Envase 1.000 ml', presentation_qty: 1000, max_movement_qty: 100000, is_active: true,
}

describe('productSchema', () => {
  it('acepta un producto válido y normaliza vacíos a null', () => {
    const r = productSchema.safeParse(base)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.brand).toBeNull()
      expect(r.data.variant).toBeNull()
      expect(r.data.category).toBe('Profesional')
    }
  })
  it('rechaza SKU con espacios, nombre vacío y contenido por envase no positivo', () => {
    const r = productSchema.safeParse({ ...base, sku: 'con espacio', name: ' ', presentation_qty: 0 })
    expect(r.success).toBe(false)
    if (!r.success) {
      const e = fieldErrors(r.error)
      expect(e.sku).toBeTruthy()
      expect(e.name).toBe('El nombre es obligatorio.')
      expect(e.presentation_qty).toBe('Debe ser mayor que cero.')
    }
  })
  it('permite presentation_qty nulo', () => {
    expect(productSchema.safeParse({ ...base, presentation: '', presentation_qty: null }).success).toBe(true)
  })
})
