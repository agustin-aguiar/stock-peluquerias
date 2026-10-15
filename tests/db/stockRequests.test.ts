import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { admin, createTestChain, expectRpcError, type TestChain } from './harness'

let t: TestChain
let productId: string

beforeAll(async () => {
  t = await createTestChain()
  const created = await t.adminUser.client.rpc('upsert_product', {
    p_sku: `REQ-${randomUUID().slice(0, 8)}`, p_name: 'Producto para pedidos', p_unit: 'unit',
  })
  if (created.error) throw created.error
  productId = created.data.id
  for (const [branch, qty] of [[t.branchA, 2], [t.branchB, 10]] as const) {
    const result = await t.adminUser.client.rpc('assign_stock', {
      p_key: randomUUID(), p_branch_id: branch, p_product_id: productId, p_qty: qty,
    })
    if (result.error) throw result.error
  }
})
afterAll(async () => { if (t) await t.cleanup() })

async function balance(branchId: string) {
  const result = await admin.from('inventory').select('balance').eq('branch_id', branchId).eq('product_id', productId).single()
  if (result.error) throw result.error
  return Number(result.data.balance)
}

describe('pedidos de stock entre locales', () => {
  it('solo el local solicita, el administrador elige origen y el origen despacha una vez', async () => {
    const id = randomUUID()
    const input = { p_id: id, p_product_id: productId, p_qty: 4 }
    expectRpcError(await t.adminUser.client.rpc('request_stock', input), 'permission_denied')
    const request = await t.opA.client.rpc('request_stock', input)
    expect(request.error).toBeNull()
    expect(request.data.status).toBe('pending_admin')
    expect((await t.opA.client.rpc('request_stock', input)).data.id).toBe(id)
    expect((await t.opB.client.from('stock_requests').select('id').eq('id', id)).data).toEqual([])
    expectRpcError(await t.opB.client.rpc('review_stock_request', {
      p_request_id: id, p_source_branch_id: t.branchB,
    }), 'permission_denied')
    const review = await t.adminUser.client.rpc('review_stock_request', {
      p_request_id: id, p_source_branch_id: t.branchB,
    })
    expect(review.error).toBeNull()
    expect(review.data.status).toBe('pending_source')
    expect((await t.opB.client.from('stock_requests').select('id').eq('id', id)).data).toHaveLength(1)
    expectRpcError(await t.opA.client.rpc('decide_stock_request', {
      p_request_id: id, p_accept: true,
    }), 'permission_denied')
    const accepted = await t.opB.client.rpc('decide_stock_request', {
      p_request_id: id, p_accept: true,
    })
    expect(accepted.error).toBeNull()
    expect(accepted.data.status).toBe('dispatched')
    expect(await balance(t.branchA)).toBe(2)
    expect(await balance(t.branchB)).toBe(6)
    expectRpcError(await t.opB.client.rpc('decide_stock_request', {
      p_request_id: id, p_accept: true,
    }), 'invalid_request_state')
    expect(await balance(t.branchB)).toBe(6)
    const received = await t.opA.client.rpc('receive_transfer', {
      p_key: randomUUID(), p_transfer_id: accepted.data.transfer_id,
    })
    expect(received.error).toBeNull()
    expect(await balance(t.branchA)).toBe(6)
  })

  it('un local puede rechazar con motivo sin descontar stock', async () => {
    const id = randomUUID()
    const request = await t.opA.client.rpc('request_stock', { p_id: id, p_product_id: productId, p_qty: 2 })
    expect(request.error).toBeNull()
    expect((await t.adminUser.client.rpc('review_stock_request', { p_request_id: id, p_source_branch_id: t.branchB })).error).toBeNull()
    expectRpcError(await t.opB.client.rpc('decide_stock_request', { p_request_id: id, p_accept: false }), 'reason_required')
    const declined = await t.opB.client.rpc('decide_stock_request', { p_request_id: id, p_accept: false, p_reason: 'Lo necesitamos hoy' })
    expect(declined.error).toBeNull()
    expect(declined.data.status).toBe('declined')
    expect(await balance(t.branchB)).toBe(6)
    const reassigned = await t.adminUser.client.rpc('review_stock_request', {
      p_request_id: id, p_source_branch_id: t.branchB,
    })
    expect(reassigned.error).toBeNull()
    expect(reassigned.data.status).toBe('pending_source')
    const accepted = await t.opB.client.rpc('decide_stock_request', { p_request_id: id, p_accept: true })
    expect(accepted.error).toBeNull()
    expect(await balance(t.branchB)).toBe(4)
  })

  it('permite pedir un producto nuevo y lo incorpora al destino al enviarlo', async () => {
    const created = await t.adminUser.client.rpc('upsert_product', {
      p_sku: `NEW-${randomUUID().slice(0, 8)}`, p_name: 'Producto nuevo para el local', p_unit: 'unit',
    })
    if (created.error) throw created.error
    const newProductId = created.data.id
    const loaded = await t.adminUser.client.rpc('assign_stock', {
      p_key: randomUUID(), p_branch_id: t.branchB, p_product_id: newProductId, p_qty: 3,
    })
    expect(loaded.error).toBeNull()
    const request = await t.opA.client.rpc('request_stock', {
      p_id: randomUUID(), p_product_id: newProductId, p_qty: 2,
    })
    expect(request.error).toBeNull()
    expect((await t.adminUser.client.rpc('review_stock_request', {
      p_request_id: request.data.id, p_source_branch_id: t.branchB,
    })).error).toBeNull()
    const accepted = await t.opB.client.rpc('decide_stock_request', {
      p_request_id: request.data.id, p_accept: true,
    })
    expect(accepted.error).toBeNull()
    const before = await admin.from('inventory').select('balance,initialized_at')
      .eq('branch_id', t.branchA).eq('product_id', newProductId).single()
    expect(before.error).toBeNull()
    if (!before.data) throw before.error ?? new Error('No se creó el inventario de destino')
    expect(Number(before.data.balance)).toBe(0)
    expect(before.data.initialized_at).not.toBeNull()
    const received = await t.opA.client.rpc('receive_transfer', {
      p_key: randomUUID(), p_transfer_id: accepted.data.transfer_id,
    })
    expect(received.error).toBeNull()
    const after = await admin.from('inventory').select('balance')
      .eq('branch_id', t.branchA).eq('product_id', newProductId).single()
    if (!after.data) throw after.error ?? new Error('No se encontró el inventario de destino')
    expect(Number(after.data.balance)).toBe(2)
  })
})
