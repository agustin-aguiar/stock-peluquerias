import { describe, expect, it } from 'vitest'
import { GENERIC_ERROR, NETWORK_ERROR, RPC_MESSAGES, messageFor, rpcErrorCode } from '@/lib/errors'

describe('rpcErrorCode', () => {
  it('extrae el código de un PostgrestError P0001', () => {
    const err = { code: 'P0001', message: 'duplicate_sku', details: 'Ya existe.', hint: null }
    expect(rpcErrorCode(err)).toBe('duplicate_sku')
  })
  it('extrae el código de un Error nativo con mensaje snake_case', () => {
    expect(rpcErrorCode(new Error('permission_denied'))).toBe('permission_denied')
  })
  it('devuelve null si el mensaje no es un código', () => {
    expect(rpcErrorCode(new Error('relation "x" does not exist'))).toBeNull()
    expect(rpcErrorCode(null)).toBeNull()
    expect(rpcErrorCode('texto')).toBeNull()
  })
})

describe('messageFor', () => {
  it('mapea códigos conocidos', () => {
    expect(messageFor({ code: 'P0001', message: 'last_admin' })).toBe(RPC_MESSAGES.last_admin)
  })
  it('usa el DETAIL del servidor si el código es desconocido pero hay detalle', () => {
    expect(messageFor({ code: 'P0001', message: 'algo_nuevo', details: 'Texto del servidor.' })).toBe(
      'Texto del servidor.',
    )
  })
  it('detecta errores de red', () => {
    expect(messageFor(new TypeError('Failed to fetch'))).toBe(NETWORK_ERROR)
    expect(messageFor({ message: 'TypeError: Failed to fetch' })).toBe(NETWORK_ERROR)
  })
  it('cae al genérico', () => {
    expect(messageFor(new Error('boom'))).toBe(GENERIC_ERROR)
    expect(messageFor(undefined)).toBe(GENERIC_ERROR)
  })
  it('todos los códigos del spec tienen mensaje', () => {
    const spec = [
      'not_authenticated', 'inactive_user', 'no_profile', 'permission_denied', 'not_found',
      'duplicate_code', 'duplicate_sku', 'duplicate_email', 'invalid_code', 'invalid_sku',
      'invalid_name', 'invalid_email', 'invalid_role', 'invalid_unit', 'invalid_quantity',
      'invalid_key', 'unit_locked', 'has_stock', 'has_open_transfers', 'has_active_users',
      'already_enabled', 'not_enabled', 'already_initialized', 'idempotency_conflict',
      'last_admin', 'self_deactivation', 'branch_required', 'branch_inactive', 'product_inactive',
    ]
    for (const code of spec) expect(RPC_MESSAGES[code], code).toBeTruthy()
  })
})
