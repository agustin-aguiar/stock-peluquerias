import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { admin, anonClient, createTestChain, expectRpcError } from './harness'

describe('enlaces de acceso a locales', () => {
  it('solo el administrador emite el enlace y el alta asigna su local y rol', async () => {
    const t = await createTestChain()
    const email = `join-${randomUUID()}@example.com`
    const password = `Test-${randomUUID()}`
    const authIds: string[] = []
    try {
      expectRpcError(await t.opA.client.rpc('create_branch_join_link', { p_branch_id: t.branchA }), 'permission_denied')
      expectRpcError(await t.opA.client.rpc('get_branch_join_link', { p_branch_id: t.branchA }), 'permission_denied')
      const issued = await t.adminUser.client.rpc('create_branch_join_link', { p_branch_id: t.branchB })
      expect(issued.error).toBeNull()
      const token = issued.data.token as string
      const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
      if (createError) throw createError
      authIds.push(created.user.id)
      const client = anonClient()
      const { error: signInError } = await client.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError
      const joined = await client.rpc('join_branch_with_link', { p_token: token, p_full_name: 'Nueva encargada' })
      expect(joined.error).toBeNull()
      expect(joined.data.role).toBe('operator')
      expect(joined.data.branch_id).toBe(t.branchB)
      expect(joined.data.chain_id).toBe(t.chainId)
      expectRpcError(await client.rpc('join_branch_with_link', { p_token: token, p_full_name: 'Otra vez' }), 'profile_exists')
      const link = await t.adminUser.client.rpc('get_branch_join_link', { p_branch_id: t.branchB })
      expect(link.data.uses).toBe(1)
      const rotated = await t.adminUser.client.rpc('create_branch_join_link', { p_branch_id: t.branchB })
      expect(rotated.data.token).not.toBe(token)
      const secondEmail = `join-${randomUUID()}@example.com`
      const { data: second, error: secondError } = await admin.auth.admin.createUser({ email: secondEmail, password, email_confirm: true })
      if (secondError) throw secondError
      authIds.push(second.user.id)
      const secondClient = anonClient()
      const { error: secondSignInError } = await secondClient.auth.signInWithPassword({ email: secondEmail, password })
      if (secondSignInError) throw secondSignInError
      expectRpcError(await secondClient.rpc('join_branch_with_link', { p_token: token, p_full_name: 'Segunda' }), 'invalid_join_link')
      await t.adminUser.client.rpc('revoke_branch_join_link', { p_branch_id: t.branchB })
      const revoked = await t.adminUser.client.rpc('get_branch_join_link', { p_branch_id: t.branchB })
      expect(revoked.data.revoked_at).not.toBeNull()
      expectRpcError(await secondClient.rpc('join_branch_with_link', { p_token: rotated.data.token, p_full_name: 'Segunda' }), 'invalid_join_link')
    } finally {
      await t.cleanup()
      for (const authId of authIds) await admin.auth.admin.deleteUser(authId)
    }
  })
})
