import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { admin, createTestChain, expectRpcError, type TestChain } from './harness'

let t: TestChain
let productId: string
beforeAll(async () => {
  t = await createTestChain()
  const p = await t.adminUser.client.rpc('upsert_product', { p_sku: 'REPORT-ML', p_name: 'Producto de reporte', p_unit: 'ml' })
  if (p.error) throw p.error
  productId = p.data.id
  const en = await t.adminUser.client.rpc('enable_product_in_branch', { p_product_id: productId, p_branch_id: t.branchA, p_min_qty: 10 })
  if (en.error) throw en.error
  const init = await t.adminUser.client.rpc('set_initial_balance', { p_key: randomUUID(), p_branch_id: t.branchA, p_product_id: productId, p_qty: 100 })
  if (init.error) throw init.error
})
afterAll(async () => { await t.cleanup() })

describe('SP4 tablero, conteo e importación', () => {
  it('CP-24 tablero separa SKU y unidad, sin contar transferencias como consumo', async () => {
    await t.opA.client.rpc('register_movement', { p_key: randomUUID(), p_type: 'consumption', p_branch_id: t.branchA, p_product_id: productId, p_qty: 25.5 })
    const result = await t.adminUser.client.rpc('dashboard_snapshot', {
      p_from: new Date(Date.now() - 86_400_000).toISOString(), p_to: new Date(Date.now() + 86_400_000).toISOString(),
    })
    expect(result.error).toBeNull()
    const usage = (result.data.usage as Array<{ product_id: string; unit: string; consumption: number }>).find((r) => r.product_id === productId)
    expect(usage?.unit).toBe('ml')
    expect(Number(usage?.consumption)).toBe(25.5)
  })

  it('CP-27 conteo viejo no pisa un consumo nuevo', async () => {
    const countId = randomUUID()
    const submitted = await t.opA.client.rpc('submit_physical_count', {
      p_id: countId, p_branch_id: t.branchA, p_product_id: productId, p_observed_qty: 70,
    })
    expect(submitted.error).toBeNull()
    await t.opA.client.rpc('register_movement', { p_key: randomUUID(), p_type: 'consumption',
      p_branch_id: t.branchA, p_product_id: productId, p_qty: 1 })
    expectRpcError(await t.adminUser.client.rpc('approve_physical_count', { p_count_id: countId }), 'stale_count')
    const inv = await admin.from('inventory').select('balance').eq('branch_id', t.branchA).eq('product_id', productId).single()
    expect(Number(inv.data!.balance)).toBe(73.5)
    const freshId = randomUUID()
    await t.opA.client.rpc('submit_physical_count', { p_id: freshId, p_branch_id: t.branchA, p_product_id: productId, p_observed_qty: 72 })
    const approved = await t.adminUser.client.rpc('approve_physical_count', { p_count_id: freshId })
    expect(approved.error).toBeNull()
    expect(Number(approved.data.balance)).toBe(72)
  })

  it('CP-25 lote inválido no aplica cambios; reintento y contenido repetido no duplican', async () => {
    const sku = `CSV-${randomUUID().slice(0, 8)}`
    const rows = [{ sku, name: 'Producto CSV', unit: 'unit' }, { sku, name: 'Duplicado', unit: 'unit' }]
    expectRpcError(await t.adminUser.client.rpc('import_csv_batch', { p_id: randomUUID(), p_kind: 'catalog', p_rows: rows }), 'duplicate_sku')
    const missing = await admin.from('products').select('id').eq('chain_id', t.chainId).eq('sku', sku)
    expect(missing.data).toHaveLength(0)
    const key = randomUUID()
    const valid = [rows[0]]
    const first = await t.adminUser.client.rpc('import_csv_batch', { p_id: key, p_kind: 'catalog', p_rows: valid })
    expect(first.error).toBeNull()
    expect((await t.adminUser.client.rpc('import_csv_batch', { p_id: key, p_kind: 'catalog', p_rows: valid })).data).toEqual(first.data)
    expectRpcError(await t.adminUser.client.rpc('import_csv_batch', { p_id: randomUUID(), p_kind: 'catalog', p_rows: valid }), 'duplicate_import')
    const products = await admin.from('products').select('id').eq('chain_id', t.chainId).eq('sku', sku)
    expect(products.data).toHaveLength(1)
  })
})
