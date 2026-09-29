import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { admin, createTestChain, expectRpcError, type TestChain } from './harness'

let t: TestChain

beforeAll(async () => { t = await createTestChain() })
afterAll(async () => { await t.cleanup() })

describe('C7 extensión y trazabilidad', () => {
  it('CP-23 tercera sucursal opera con permisos y saldos separados', async () => {
    const created = await t.adminUser.client.rpc('create_branch', { p_code: 'TC', p_name: 'Sucursal C' })
    expect(created.error).toBeNull()
    const branchC = created.data.id as string
    const opC = await t.addUser('operator', branchC, 'opc')
    const product = await t.adminUser.client.rpc('upsert_product', {
      p_sku: 'PILOT-1', p_name: 'Producto piloto', p_unit: 'unit',
    })
    expect(product.error).toBeNull()
    const productId = product.data.id as string

    for (const [branchId, qty] of [[t.branchA, 10], [t.branchB, 5], [branchC, 2]] as const) {
      expect((await t.adminUser.client.rpc('enable_product_in_branch', {
        p_product_id: productId, p_branch_id: branchId,
      })).error).toBeNull()
      expect((await t.adminUser.client.rpc('set_initial_balance', {
        p_key: randomUUID(), p_branch_id: branchId, p_product_id: productId, p_qty: qty,
      })).error).toBeNull()
    }

    const visible = await opC.client.from('inventory').select('branch_id, balance').eq('product_id', productId)
    expect(visible.error).toBeNull()
    expect(visible.data).toEqual([expect.objectContaining({ branch_id: branchC, balance: 2 })])
    expectRpcError(await opC.client.rpc('register_movement', {
      p_key: randomUUID(), p_type: 'consumption', p_branch_id: t.branchA,
      p_product_id: productId, p_qty: 1,
    }), 'permission_denied')
    const own = await opC.client.rpc('register_movement', {
      p_key: randomUUID(), p_type: 'consumption', p_branch_id: branchC,
      p_product_id: productId, p_qty: 1,
    })
    expect(own.error).toBeNull()
    const balances = await admin.from('inventory').select('branch_id, balance').eq('product_id', productId)
    expect(Object.fromEntries(balances.data!.map((row) => [row.branch_id, Number(row.balance)]))).toEqual({
      [t.branchA]: 10, [t.branchB]: 5, [branchC]: 1,
    })

    const transferId = randomUUID()
    expect((await t.adminUser.client.rpc('create_transfer', {
      p_id: transferId, p_product_id: productId, p_from_branch_id: t.branchA,
      p_to_branch_id: branchC, p_qty: 3,
    })).error).toBeNull()
    expect((await t.adminUser.client.rpc('dispatch_transfer', { p_key: randomUUID(), p_transfer_id: transferId })).error).toBeNull()
    expectRpcError(await t.opB.client.rpc('receive_transfer', { p_key: randomUUID(), p_transfer_id: transferId }), 'permission_denied')
    expect((await opC.client.rpc('receive_transfer', { p_key: randomUUID(), p_transfer_id: transferId })).error).toBeNull()
    const finalBalances = await admin.from('inventory').select('branch_id, balance').eq('product_id', productId)
    expect(Object.fromEntries(finalBalances.data!.map((row) => [row.branch_id, Number(row.balance)]))).toEqual({
      [t.branchA]: 7, [t.branchB]: 5, [branchC]: 4,
    })
  })

  it('CP-31 cambios de mínimo, producto y perfil guardan actor y valores anteriores', async () => {
    const product = await t.adminUser.client.rpc('upsert_product', {
      p_sku: 'AUDIT-1', p_name: 'Antes', p_unit: 'unit',
    })
    expect(product.error).toBeNull()
    const productId = product.data.id as string
    expect((await t.adminUser.client.rpc('enable_product_in_branch', {
      p_product_id: productId, p_branch_id: t.branchA, p_min_qty: 1,
    })).error).toBeNull()
    expect((await t.adminUser.client.rpc('set_min_qty', {
      p_branch_id: t.branchA, p_product_id: productId, p_min_qty: 3,
    })).error).toBeNull()
    expect((await t.adminUser.client.rpc('upsert_product', {
      p_id: productId, p_sku: 'AUDIT-1', p_name: 'Después', p_unit: 'unit',
    })).error).toBeNull()
    expect((await t.adminUser.client.rpc('update_profile', {
      p_id: t.opA.profileId, p_full_name: 'Operador editado', p_role: 'operator',
      p_branch_id: t.branchA, p_is_active: true,
    })).error).toBeNull()

    const audit = await t.adminUser.client.from('audit_events')
      .select('action, actor_profile_id, old_values, new_values')
      .in('action', ['inventory.set_min', 'product.update', 'profile.update'])
    expect(audit.error).toBeNull()
    const byAction = Object.fromEntries(audit.data!.map((row) => [row.action, row]))
    expect(audit.data!.every((row) => row.actor_profile_id === t.adminUser.profileId)).toBe(true)
    expect(Number(byAction['inventory.set_min'].old_values.min_qty)).toBe(1)
    expect(Number(byAction['inventory.set_min'].new_values.min_qty)).toBe(3)
    expect(byAction['product.update'].old_values.name).toBe('Antes')
    expect(byAction['product.update'].new_values.name).toBe('Después')
    expect(byAction['profile.update'].new_values.full_name).toBe('Operador editado')
    const hidden = await t.opA.client.from('audit_events').select('id')
    expect(hidden.error).toBeNull()
    expect(hidden.data).toHaveLength(0)
  })
})
