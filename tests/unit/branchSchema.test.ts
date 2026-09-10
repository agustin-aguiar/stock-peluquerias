import { describe, expect, it } from 'vitest'
import { branchSchema } from '@/features/branches/schema'
import { fieldErrors } from '@/lib/validation'

describe('branchSchema', () => {
  it('acepta código y nombre válidos', () => {
    expect(branchSchema.safeParse({ code: 'CEN', name: ' Sucursal Centro ' }).success).toBe(true)
  })
  it('rechaza código en minúscula y nombre vacío', () => {
    const r = branchSchema.safeParse({ code: 'cen', name: '  ' })
    expect(r.success).toBe(false)
    if (!r.success) {
      const e = fieldErrors(r.error)
      expect(e.code).toBe('Entre 2 y 8 letras mayúsculas o números.')
      expect(e.name).toBe('El nombre es obligatorio.')
    }
  })
})
