import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { fieldErrors } from '@/lib/validation'

const schema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio.'),
  code: z.string().regex(/^[A-Z0-9]{2,8}$/, 'Código inválido.'),
})

describe('fieldErrors', () => {
  it('devuelve el primer mensaje por campo', () => {
    const r = schema.safeParse({ name: '  ', code: 'ab' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(fieldErrors(r.error)).toEqual({ name: 'El nombre es obligatorio.', code: 'Código inválido.' })
    }
  })
  it('no falla con path vacío', () => {
    const r = z.string().safeParse(5)
    if (!r.success) expect(Object.keys(fieldErrors(r.error))).toEqual(['_'])
  })
})
