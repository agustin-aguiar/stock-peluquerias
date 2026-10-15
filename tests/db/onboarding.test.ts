import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { admin, anonClient, createTestChain, expectRpcError } from './harness'

describe('alta autoservicio de cadenas', () => {
  it('un correo confirmado crea su cadena una sola vez y no puede elegir el rol', async () => {
    const email = `new-${randomUUID()}@example.com`
    const password = `Test-${randomUUID()}`
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
    })
    if (createError) throw createError
    let chainId: string | null = null
    try {
      const client = anonClient()
      const { error: signInError } = await client.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError
      const first = await client.rpc('create_my_chain', {
        p_chain_name: 'Mi cadena de prueba', p_full_name: 'Nueva administradora',
      })
      expect(first.error).toBeNull()
      chainId = first.data.chain_id
      expect(first.data.role).toBe('admin')
      expect(first.data.auth_user_id).toBe(created.user.id)
      expectRpcError(await client.rpc('create_my_chain', {
        p_chain_name: 'Otra cadena', p_full_name: 'Nueva administradora',
      }), 'profile_exists')
    } finally {
      if (chainId) await admin.from('chains').delete().eq('id', chainId)
      await admin.auth.admin.deleteUser(created.user.id)
    }
  })

  it('un operador invitado no puede crear una cadena nueva', async () => {
    const t = await createTestChain()
    try {
      expectRpcError(await t.opA.client.rpc('create_my_chain', {
        p_chain_name: 'Cadena ajena', p_full_name: 'Operador',
      }), 'profile_exists')
    } finally {
      await t.cleanup()
    }
  })
})
