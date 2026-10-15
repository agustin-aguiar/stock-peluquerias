import { describe, expect, it } from 'vitest'
import { parseBulkInvites } from '../../src/features/users/bulkInvites'

describe('invitaciones por lote', () => {
  it('normaliza correos y conserva nombres', () => {
    expect(parseBulkInvites('Ana Pérez; ANA@Ejemplo.com\nLuis Gómez;luis@ejemplo.com')).toEqual([
      { full_name: 'Ana Pérez', email: 'ana@ejemplo.com' },
      { full_name: 'Luis Gómez', email: 'luis@ejemplo.com' },
    ])
  })
  it('rechaza correos repetidos y lotes mayores a 20', () => {
    expect(() => parseBulkInvites('Ana;A@example.com\nOtra;a@example.com')).toThrow(/repetido/)
    expect(() => parseBulkInvites(Array.from({ length: 21 }, (_, i) => `A;a${i}@example.com`).join('\n'))).toThrow(/20/)
  })
})
