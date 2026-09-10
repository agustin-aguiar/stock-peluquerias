import { describe, expect, it } from 'vitest'
import { profileSchema } from '@/features/users/schema'
import { fieldErrors } from '@/lib/validation'

describe('profileSchema', () => {
  it('normaliza email y acepta admin sin sucursal', () => {
    const r = profileSchema.safeParse({ email: ' Admin@Example.com ', full_name: 'Ana', role: 'admin', branch_id: '' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.email).toBe('admin@example.com')
      expect(r.data.branch_id).toBeNull()
    }
  })
  it('exige sucursal para operador', () => {
    const r = profileSchema.safeParse({ email: 'op@example.com', full_name: 'Op', role: 'operator', branch_id: '' })
    expect(r.success).toBe(false)
    if (!r.success) expect(fieldErrors(r.error).branch_id).toBe('Un operador necesita una sucursal.')
  })
  it('rechaza email inválido', () => {
    const r = profileSchema.safeParse({ email: 'no-es-email', full_name: 'X', role: 'admin', branch_id: '' })
    expect(r.success).toBe(false)
    if (!r.success) expect(fieldErrors(r.error).email).toBe('El email no es válido.')
  })
})
