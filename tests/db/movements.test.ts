import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { admin, createTestChain, expectRpcError, type TestChain } from './harness'

let t: TestChain
let mlId: string
let unitId: string

const move = (client: TestChain['adminUser']['client'], input: {
  key?: string; type: 'purchase' | 'consumption' | 'sale' | 'shrinkage' | 'adjustment';
  branchId?: string; productId?: string; qty: number; reason?: string; reference?: string
}) => client.rpc('register_movement', {
  p_key: input.key ?? randomUUID(), p_type: input.type,
  p_branch_id: input.branchId ?? t.branchA, p_product_id: input.productId ?? mlId,
  p_qty: input.qty, p_reason: input.reason ?? null, p_reference: input.reference ?? null,
})

async function balance(productId = mlId) {
  const r = await admin.from('inventory').select('balance').eq('branch_id', t.branchA).eq('product_id', productId).single()
  return Number(r.data!.balance)
}

beforeAll(async () => {
  t = await createTestChain()
  const ml = await t.adminUser.client.rpc('upsert_product', {
    p_sku: 'SP2-ML', p_name: 'Shampoo SP2', p_unit: 'ml', p_presentation_qty: 1000, p_max_movement_qty: 5000,
  })
  if (ml.error) throw ml.error
  mlId = ml.data.id
  const unit = await t.adminUser.client.rpc('upsert_product', { p_sku: 'SP2-U', p_name: 'Producto por unidad', p_unit: 'unit' })
  if (unit.error) throw unit.error
  unitId = unit.data.id
  for (const productId of [mlId, unitId]) {
    const en = await t.adminUser.client.rpc('enable_product_in_branch', { p_product_id: productId, p_branch_id: t.branchA, p_min_qty: 10 })
    if (en.error) throw en.error
    const init = await t.adminUser.client.rpc('set_initial_balance', {
      p_key: randomUUID(), p_branch_id: t.branchA, p_product_id: productId, p_qty: 0,
    })
    if (init.error) throw init.error
  }
})
afterAll(async () => { await t.cleanup() })

describe('SP2 movimientos', () => {
  it('CP-06 ingreso de 2 envases y consumo fraccionado', async () => {
    const receipt = await move(t.adminUser.client, { type: 'purchase', qty: 2000, reference: 'Proveedor A' })
    expect(receipt.error).toBeNull()
    expect(Number(receipt.data.balance)).toBe(2000)
    const consumption = await move(t.opA.client, { type: 'consumption', qty: 25.5 })
    expect(consumption.error).toBeNull()
    expect(Number(consumption.data.balance)).toBe(1974.5)
    expect(await balance()).toBe(1974.5)
  })

  it('CP-07/08 unidades enteras y salida excesiva no alteran el saldo', async () => {
    expectRpcError(await move(t.opA.client, { type: 'sale', productId: unitId, qty: 0.5 }), 'invalid_quantity')
    const before = await balance()
    expectRpcError(await move(t.opA.client, { type: 'consumption', qty: before + 1 }), 'insufficient_stock')
    expect(await balance()).toBe(before)
  })

  it('CP-10/11/22 doble envío, conflicto y consulta por clave', async () => {
    const key = randomUUID()
    const first = await move(t.opA.client, { key, type: 'sale', qty: 1, reference: 'Ticket 1' })
    const second = await move(t.opA.client, { key, type: 'sale', qty: 1, reference: 'Ticket 1' })
    expect(first.error).toBeNull()
    expect(second.error).toBeNull()
    expect(second.data).toEqual(first.data)
    expectRpcError(await move(t.opA.client, { key, type: 'sale', qty: 2, reference: 'Ticket 1' }), 'idempotency_conflict')
    const lookup = await t.opA.client.from('operations').select('result').eq('idempotency_key', key).single()
    expect(lookup.error).toBeNull()
    expect(lookup.data!.result).toEqual(first.data)
    const movements = await admin.from('movements').select('id').eq('operation_id', first.data.operation_id)
    expect(movements.data).toHaveLength(1)
  })

  it('CP-02/18 operadores no ingresan, ajustan ni operan otra sucursal', async () => {
    expectRpcError(await move(t.opA.client, { type: 'purchase', qty: 1 }), 'permission_denied')
    expectRpcError(await move(t.opA.client, { type: 'adjustment', qty: 1, reason: 'Conteo' }), 'permission_denied')
    expectRpcError(await move(t.opA.client, { type: 'sale', branchId: t.branchB, qty: 1 }), 'permission_denied')
    expectRpcError(await move(t.opB.client, { type: 'sale', qty: 1 }), 'permission_denied')
  })

  it('merma exige motivo; ajuste admin conserva auditoría y recalcula alerta', async () => {
    expectRpcError(await move(t.opA.client, { type: 'shrinkage', qty: 1 }), 'reason_required')
    const adjustment = await move(t.adminUser.client, { type: 'adjustment', qty: -1900, reason: 'Conteo físico' })
    expect(adjustment.error).toBeNull()
    const audit = await admin.from('audit_events').select('id').eq('chain_id', t.chainId).eq('action', 'inventory.adjustment')
    expect(audit.data).toHaveLength(1)
    const shrinkage = await move(t.opA.client, { type: 'shrinkage', qty: 70, reason: 'Envase roto' })
    expect(shrinkage.error).toBeNull()
    expect(await balance()).toBe(3.5)
    const alerts = await admin.from('alerts').select('id').eq('branch_id', t.branchA).eq('product_id', mlId).eq('status', 'open')
    expect(alerts.data).toHaveLength(1)
  })

  it('CP-19 reversión rechaza saldo negativo y permite una sola compensación', async () => {
    const purchase = await move(t.adminUser.client, { type: 'purchase', qty: 20 })
    expect(purchase.error).toBeNull()
    await move(t.opA.client, { type: 'consumption', qty: 10 })
    expectRpcError(await t.adminUser.client.rpc('reverse_movement', {
      p_key: randomUUID(), p_movement_id: purchase.data.movement_id, p_reason: 'Factura anulada',
    }), 'insufficient_stock')
    const sale = await move(t.opA.client, { type: 'sale', qty: 1 })
    const key = randomUUID()
    const reversed = await t.adminUser.client.rpc('reverse_movement', {
      p_key: key, p_movement_id: sale.data.movement_id, p_reason: 'Venta anulada',
    })
    expect(reversed.error).toBeNull()
    const replay = await t.adminUser.client.rpc('reverse_movement', {
      p_key: key, p_movement_id: sale.data.movement_id, p_reason: 'Venta anulada',
    })
    expect(replay.data).toEqual(reversed.data)
    expectRpcError(await t.adminUser.client.rpc('reverse_movement', {
      p_key: randomUUID(), p_movement_id: sale.data.movement_id, p_reason: 'Venta anulada',
    }), 'already_reversed')
    expectRpcError(await t.opA.client.rpc('reverse_movement', {
      p_key: randomUUID(), p_movement_id: sale.data.movement_id, p_reason: 'Prueba',
    }), 'permission_denied')
  })

  it('CP-09 dos retiros simultáneos sobre 100 dejan uno confirmado y uno rechazado', async () => {
    const topup = await move(t.adminUser.client, { type: 'adjustment', qty: 100 - await balance(), reason: 'Preparar concurrencia' })
    expect(topup.error).toBeNull()
    const results = await Promise.all([
      move(t.opA.client, { type: 'consumption', qty: 70 }),
      move(t.adminUser.client, { type: 'consumption', qty: 70 }),
    ])
    expect(results.filter((r) => !r.error)).toHaveLength(1)
    expect(results.filter((r) => r.error && r.error.message === 'insufficient_stock')).toHaveLength(1)
    expect(await balance()).toBe(30)
  })
})
