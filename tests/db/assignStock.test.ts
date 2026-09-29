import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { admin, createTestChain, expectRpcError, type TestChain } from './harness'

let t: TestChain
let productId: string

beforeAll(async () => {
  t = await createTestChain()
  const created = await t.adminUser.client.rpc('upsert_product', {
    p_sku: 'QUICK-ML', p_name: 'Materia prima', p_unit: 'ml', p_presentation_qty: 1000,
  })
  if (created.error) throw created.error
  productId = created.data.id
})
afterAll(async () => { await t.cleanup() })

describe('carga directa de stock desde Inventario', () => {
  it('habilita y registra saldo inicial en una única operación reintentable', async () => {
    const key = randomUUID()
    const input = { p_key: key, p_branch_id: t.branchA, p_product_id: productId, p_qty: 2000, p_reference: 'Dos envases' }
    const first = await t.adminUser.client.rpc('assign_stock', input)
    expect(first.error).toBeNull()
    expect(first.data.kind).toBe('initial')
    expect(Number(first.data.balance)).toBe(2000)
    const retried = await t.adminUser.client.rpc('assign_stock', input)
    expect(retried.error).toBeNull()
    expect(retried.data).toEqual(first.data)
    const inv = await admin.from('inventory').select('balance, initialized_at').eq('branch_id', t.branchA).eq('product_id', productId).single()
    expect(Number(inv.data!.balance)).toBe(2000)
    expect(inv.data!.initialized_at).not.toBeNull()
    const moves = await admin.from('movements').select('id').eq('branch_id', t.branchA).eq('product_id', productId)
    expect(moves.data).toHaveLength(1)
    expectRpcError(await t.adminUser.client.rpc('assign_stock', { ...input, p_qty: 3000 }), 'idempotency_conflict')
  })

  it('en una sucursal ya inicializada suma un ingreso y no modifica el otro local', async () => {
    const result = await t.adminUser.client.rpc('assign_stock', {
      p_key: randomUUID(), p_branch_id: t.branchA, p_product_id: productId, p_qty: 25.5,
    })
    expect(result.error).toBeNull()
    expect(result.data.kind).toBe('purchase')
    expect(Number(result.data.balance)).toBe(2025.5)
    const other = await admin.from('inventory').select('id').eq('branch_id', t.branchB).eq('product_id', productId)
    expect(other.data).toHaveLength(0)
  })

  it('rechaza operador y cantidad inválida sin dejar el producto habilitado a medias', async () => {
    const input = { p_key: randomUUID(), p_branch_id: t.branchB, p_product_id: productId, p_qty: 1 }
    expectRpcError(await t.opB.client.rpc('assign_stock', input), 'permission_denied')
    expectRpcError(await t.adminUser.client.rpc('assign_stock', { ...input, p_qty: 0 }), 'invalid_quantity')
    expectRpcError(await t.adminUser.client.rpc('assign_stock', { ...input, p_qty: 100000.01 }), 'invalid_quantity')
    const inv = await admin.from('inventory').select('id').eq('branch_id', t.branchB).eq('product_id', productId)
    expect(inv.data).toHaveLength(0)
  })

  it('dos cargas simultáneas conservan ambas cantidades sin duplicarse', async () => {
    const results = await Promise.all([150, 75].map((qty) => t.adminUser.client.rpc('assign_stock', {
      p_key: randomUUID(), p_branch_id: t.branchB, p_product_id: productId, p_qty: qty,
    })))
    const a = results[0]!
    const b = results[1]!
    expect(a.error).toBeNull()
    expect(b.error).toBeNull()
    const inv = await admin.from('inventory').select('balance').eq('branch_id', t.branchB).eq('product_id', productId).single()
    expect(Number(inv.data!.balance)).toBe(225)
    const ops = await admin.from('operations').select('type').eq('chain_id', t.chainId).in('id', [a.data.operation_id, b.data.operation_id])
    expect(ops.data!.map((op) => op.type).sort()).toEqual(['initial', 'purchase'])
  })
})
