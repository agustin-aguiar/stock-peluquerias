import { describe, expect, it } from 'vitest'
import { authMessage } from '@/features/auth/authErrors'

describe('authMessage', () => {
  it('traduce credenciales inválidas', () => {
    expect(authMessage({ message: 'Invalid login credentials' })).toBe('Email o contraseña incorrectos.')
  })
  it('traduce límite de intentos', () => {
    expect(authMessage({ message: 'Request rate limit reached' })).toBe('Demasiados intentos. Esperá un momento y reintentá.')
  })
  it('cae al genérico', () => {
    expect(authMessage({ message: 'weird' })).toBe('No se pudo completar la operación. Reintentá.')
    expect(authMessage(null)).toBe('No se pudo completar la operación. Reintentá.')
  })
})
