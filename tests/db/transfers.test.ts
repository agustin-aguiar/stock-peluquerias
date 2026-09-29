import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { admin, createTestChain, expectRpcError, type TestChain } from './harness'

let t: TestChain
beforeAll(async () => { t = await createTestChain() })
afterAll(async () => { await t.cleanup() })

async function setup(qtyA: number, qtyB: number) {
  const sku = `TR-${randomUUID().slice(0, 8)}`
  const p = await t.adminUser.client.rpc('upsert_product', { p_sku: sku, p_name: sku, p_unit: 'unit' })
  if (p.error) throw p.error
  for (const [branch, qty] of [[t.branchA, qtyA], [t.branchB, qtyB]] as const) {
    const enabled = await t.adminUser.client.rpc('enable_product_in_branch', { p_product_id: p.data.id, p_branch_id: branch })
    if (enabled.error) throw enabled.error
    const init = await t.adminUser.client.rpc('set_initial_balance', { p_key: randomUUID(), p_branch_id: branch, p_product_id: p.data.id, p_qty: qty })
    if (init.error) throw init.error
  }
  const transferId = randomUUID()
  const draft = await t.adminUser.client.rpc('create_transfer', {
    p_id: transferId, p_product_id: p.data.id, p_from_branch_id: t.branchA,
    p_to_branch_id: t.branchB, p_qty: 4,
  })
  if (draft.error) throw draft.error
  return { productId: p.data.id as string, transferId }
}

async function balance(productId: string, branchId: string) {
  const r = await admin.from('inventory').select('balance').eq('product_id', productId).eq('branch_id', branchId).single()
  return Number(r.data!.balance)
}

async function transit(transferId: string) {
  const r = await admin.from('movements').select('qty_delta').eq('transfer_id', transferId).is('branch_id', null)
  return r.data!.reduce((sum, movement) => sum + Number(movement.qty_delta), 0)
}

describe('SP3 transferencias', () => {
  it('CP-12 despacho separa tránsito y recepción acredita destino una vez', async () => {
    const { productId, transferId } = await setup(10, 2)
    const dispatchKey = randomUUID()
    const dispatch = await t.adminUser.client.rpc('dispatch_transfer', { p_key: dispatchKey, p_transfer_id: transferId })
    expect(dispatch.error).toBeNull()
    expect((await t.adminUser.client.rpc('dispatch_transfer', { p_key: dispatchKey, p_transfer_id: transferId })).data).toEqual(dispatch.data)
    expect(await balance(productId, t.branchA)).toBe(6)
    expect(await balance(productId, t.branchB)).toBe(2)
    expect(await transit(transferId)).toBe(4)
    const received = await t.opB.client.rpc('receive_transfer', { p_key: randomUUID(), p_transfer_id: transferId })
    expect(received.error).toBeNull()
    expect(await balance(productId, t.branchA)).toBe(6)
    expect(await balance(productId, t.branchB)).toBe(6)
    expect(await transit(transferId)).toBe(0)
    expectRpcError(await t.opB.client.rpc('receive_transfer', { p_key: randomUUID(), p_transfer_id: transferId }), 'invalid_transfer_state')
  })

  it('CP-13 origen no recibe ni reporta diferencia; operador no despacha', async () => {
    const { transferId } = await setup(10, 2)
    expectRpcError(await t.opA.client.rpc('dispatch_transfer', { p_key: randomUUID(), p_transfer_id: transferId }), 'permission_denied')
    await t.adminUser.client.rpc('dispatch_transfer', { p_key: randomUUID(), p_transfer_id: transferId })
    expectRpcError(await t.opA.client.rpc('receive_transfer', { p_key: randomUUID(), p_transfer_id: transferId }), 'permission_denied')
    expectRpcError(await t.opA.client.rpc('report_transfer_difference', { p_transfer_id: transferId, p_note: 'Falta una unidad' }), 'permission_denied')
  })

  it('CP-15/16 diferencia resuelta concilia recibido, devuelto y merma', async () => {
    const { productId, transferId } = await setup(10, 2)
    await t.adminUser.client.rpc('dispatch_transfer', { p_key: randomUUID(), p_transfer_id: transferId })
    const dispute = await t.opB.client.rpc('report_transfer_difference', { p_transfer_id: transferId, p_note: 'Llegaron tres' })
    expect(dispute.data.status).toBe('disputed')
    expectRpcError(await t.adminUser.client.rpc('resolve_transfer', {
      p_key: randomUUID(), p_transfer_id: transferId, p_qty_received: 3, p_qty_returned: 0, p_qty_lost: 0, p_note: 'Conteo',
    }), 'transfer_mismatch')
    expect(await transit(transferId)).toBe(4)
    const resolved = await t.adminUser.client.rpc('resolve_transfer', {
      p_key: randomUUID(), p_transfer_id: transferId, p_qty_received: 3, p_qty_returned: 0, p_qty_lost: 1, p_note: 'Unidad rota',
    })
    expect(resolved.error).toBeNull()
    expect(await balance(productId, t.branchA)).toBe(6)
    expect(await balance(productId, t.branchB)).toBe(5)
    expect(await transit(transferId)).toBe(0)
    expectRpcError(await t.adminUser.client.rpc('resolve_transfer', {
      p_key: randomUUID(), p_transfer_id: transferId, p_qty_received: 3, p_qty_returned: 0, p_qty_lost: 1, p_note: 'Unidad rota',
    }), 'invalid_transfer_state')
  })

  it('CP-14 recepción y resolución simultáneas producen un único cierre', async () => {
    const { transferId } = await setup(10, 2)
    await t.adminUser.client.rpc('dispatch_transfer', { p_key: randomUUID(), p_transfer_id: transferId })
    await t.opB.client.rpc('report_transfer_difference', { p_transfer_id: transferId, p_note: 'Revisar' })
    const results = await Promise.all([
      t.opB.client.rpc('receive_transfer', { p_key: randomUUID(), p_transfer_id: transferId }),
      t.adminUser.client.rpc('resolve_transfer', { p_key: randomUUID(), p_transfer_id: transferId,
        p_qty_received: 4, p_qty_returned: 0, p_qty_lost: 0, p_note: 'Verificado' }),
    ])
    expect(results.filter((r) => !r.error)).toHaveLength(1)
    expect(await transit(transferId)).toBe(0)
  })

  it('CP-17 cancelar borrador no mueve stock; tránsito no se cancela', async () => {
    const first = await setup(10, 2)
    const cancelled = await t.adminUser.client.rpc('cancel_transfer', { p_transfer_id: first.transferId })
    expect(cancelled.data.status).toBe('cancelled')
    expect(await balance(first.productId, t.branchA)).toBe(10)
    expect(await transit(first.transferId)).toBe(0)
    const second = await setup(10, 2)
    await t.adminUser.client.rpc('dispatch_transfer', { p_key: randomUUID(), p_transfer_id: second.transferId })
    expectRpcError(await t.adminUser.client.rpc('cancel_transfer', { p_transfer_id: second.transferId }), 'invalid_transfer_state')
  })
})
