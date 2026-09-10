import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { admin, anonClient, createTestChain, expectRpcError, type TestChain } from './harness'

let t: TestChain
let shampooId: string // ml, envase 1000
let botellaId: string // unit

beforeAll(async () => {
  t = await createTestChain()
  const s = await t.adminUser.client.rpc('upsert_product', {
    p_sku: 'SH-PRO', p_name: 'Shampoo profesional 1 L', p_unit: 'ml', p_presentation_qty: 1000, p_max_movement_qty: 50000,
  })
  if (s.error) throw s.error
  shampooId = s.data.id
  const b = await t.adminUser.client.rpc('upsert_product', { p_sku: 'VT-250', p_name: 'Shampoo venta 250 ml', p_unit: 'unit' })
  if (b.error) throw b.error
  botellaId = b.data.id
})
afterAll(async () => {
  await t.cleanup()
})

async function openAlerts(branchId: string, productId: string) {
  const { data } = await admin.from('alerts').select('id').eq('branch_id', branchId).eq('product_id', productId).eq('status', 'open')
  return data!.length
}
async function movementsFor(branchId: string, productId: string) {
  const { data } = await admin.from('movements').select('id, qty_delta').eq('branch_id', branchId).eq('product_id', productId)
  return data!
}

describe('enable_product_in_branch / set_min_qty', () => {
  it('habilita con saldo 0 y abre alerta (0 <= mínimo)', async () => {
    const res = await t.adminUser.client.rpc('enable_product_in_branch', { p_product_id: shampooId, p_branch_id: t.branchA, p_min_qty: 1980 })
    expect(res.error).toBeNull()
    expect(Number(res.data.balance)).toBe(0)
    expect(Number(res.data.min_qty)).toBe(1980)
    expect(res.data.initialized_at).toBeNull()
    expect(await openAlerts(t.branchA, shampooId)).toBe(1)
  })
  it('rechaza habilitar dos veces, mínimo con escala inválida y operador', async () => {
    expectRpcError(
      await t.adminUser.client.rpc('enable_product_in_branch', { p_product_id: shampooId, p_branch_id: t.branchA }),
      'already_enabled',
    )
    expectRpcError(
      await t.adminUser.client.rpc('enable_product_in_branch', { p_product_id: botellaId, p_branch_id: t.branchA, p_min_qty: 2.5 }),
      'invalid_quantity',
    )
    expectRpcError(
      await t.opA.client.rpc('enable_product_in_branch', { p_product_id: botellaId, p_branch_id: t.branchA }),
      'permission_denied',
    )
  })
  it('CP-20 (parcial) cambiar el mínimo recalcula sin duplicar alertas', async () => {
    const r1 = await t.adminUser.client.rpc('set_min_qty', { p_branch_id: t.branchA, p_product_id: shampooId, p_min_qty: 0 })
    expect(r1.error).toBeNull()
    expect(await openAlerts(t.branchA, shampooId)).toBe(1) // 0 <= 0 sigue en alerta
    const r2 = await t.adminUser.client.rpc('set_min_qty', { p_branch_id: t.branchA, p_product_id: shampooId, p_min_qty: 1980 })
    expect(r2.error).toBeNull()
    expect(await openAlerts(t.branchA, shampooId)).toBe(1)
    expectRpcError(
      await t.adminUser.client.rpc('set_min_qty', { p_branch_id: t.branchB, p_product_id: shampooId, p_min_qty: 1 }),
      'not_enabled',
    )
  })
})

describe('set_initial_balance', () => {
  it('CP-05/CP-07 rechaza negativo, decimales en unidad y más de dos decimales', async () => {
    await t.adminUser.client.rpc('enable_product_in_branch', { p_product_id: botellaId, p_branch_id: t.branchA, p_min_qty: 5 })
    expectRpcError(
      await t.adminUser.client.rpc('set_initial_balance', { p_key: randomUUID(), p_branch_id: t.branchA, p_product_id: shampooId, p_qty: -1 }),
      'invalid_quantity',
    )
    expectRpcError(
      await t.adminUser.client.rpc('set_initial_balance', { p_key: randomUUID(), p_branch_id: t.branchA, p_product_id: botellaId, p_qty: 0.5 }),
      'invalid_quantity',
    )
    expectRpcError(
      await t.adminUser.client.rpc('set_initial_balance', { p_key: randomUUID(), p_branch_id: t.branchA, p_product_id: shampooId, p_qty: 1.005 }),
      'invalid_quantity',
    )
    expectRpcError(
      await t.adminUser.client.rpc('set_initial_balance', { p_key: randomUUID(), p_branch_id: t.branchA, p_product_id: shampooId, p_qty: 60000 }),
      'invalid_quantity',
    )
    expect(await movementsFor(t.branchA, shampooId)).toEqual([])
  })
  it('registra 2.000 ml, crea movimiento y resuelve la alerta (2.000 > 1.980)', async () => {
    const key = randomUUID()
    const res = await t.adminUser.client.rpc('set_initial_balance', {
      p_key: key, p_branch_id: t.branchA, p_product_id: shampooId, p_qty: 2000, p_reference: 'Conteo 10/09',
    })
    expect(res.error).toBeNull()
    expect(Number(res.data.balance)).toBe(2000)
    expect(res.data.movement_id).toBeTruthy()
    const inv = await admin.from('inventory').select('balance, version, initialized_at').eq('branch_id', t.branchA).eq('product_id', shampooId).single()
    expect(Number(inv.data!.balance)).toBe(2000)
    expect(Number(inv.data!.version)).toBe(2)
    expect(inv.data!.initialized_at).not.toBeNull()
    expect((await movementsFor(t.branchA, shampooId)).length).toBe(1)
    expect(await openAlerts(t.branchA, shampooId)).toBe(0)

    // CP-10 idempotencia: misma clave y mismos datos devuelve el mismo resultado sin nuevo movimiento
    const again = await t.adminUser.client.rpc('set_initial_balance', {
      p_key: key, p_branch_id: t.branchA, p_product_id: shampooId, p_qty: 2000, p_reference: 'Conteo 10/09',
    })
    expect(again.error).toBeNull()
    expect(again.data.operation_id).toBe(res.data.operation_id)
    expect((await movementsFor(t.branchA, shampooId)).length).toBe(1)

    // CP-11 misma clave, otra cantidad
    expectRpcError(
      await t.adminUser.client.rpc('set_initial_balance', { p_key: key, p_branch_id: t.branchA, p_product_id: shampooId, p_qty: 2500 }),
      'idempotency_conflict',
    )
    // otra clave, ya inicializado
    expectRpcError(
      await t.adminUser.client.rpc('set_initial_balance', { p_key: randomUUID(), p_branch_id: t.branchA, p_product_id: shampooId, p_qty: 1 }),
      'already_initialized',
    )
    expect(Number((await admin.from('inventory').select('balance').eq('branch_id', t.branchA).eq('product_id', shampooId).single()).data!.balance)).toBe(2000)
  })
  it('inicializar con 0 marca initialized_at, no crea movimiento y deja alerta', async () => {
    const res = await t.adminUser.client.rpc('set_initial_balance', { p_key: randomUUID(), p_branch_id: t.branchA, p_product_id: botellaId, p_qty: 0 })
    expect(res.error).toBeNull()
    expect(res.data.movement_id).toBeNull()
    const inv = await admin.from('inventory').select('initialized_at').eq('branch_id', t.branchA).eq('product_id', botellaId).single()
    expect(inv.data!.initialized_at).not.toBeNull()
    expect(await movementsFor(t.branchA, botellaId)).toEqual([])
    expect(await openAlerts(t.branchA, botellaId)).toBe(1)
  })
  it('unit_locked tras inicializar', async () => {
    expectRpcError(
      await t.adminUser.client.rpc('upsert_product', { p_id: shampooId, p_sku: 'SH-PRO', p_name: 'S', p_unit: 'g' }),
      'unit_locked',
    )
  })
  it('CP-33 con saldo no se desactiva el producto', async () => {
    expectRpcError(
      await t.adminUser.client.rpc('upsert_product', { p_id: shampooId, p_sku: 'SH-PRO', p_name: 'S', p_unit: 'ml', p_is_active: false }),
      'has_stock',
    )
  })
  it('producto no habilitado y sucursal ajena', async () => {
    expectRpcError(
      await t.adminUser.client.rpc('set_initial_balance', { p_key: randomUUID(), p_branch_id: t.branchB, p_product_id: botellaId, p_qty: 1 }),
      'not_enabled',
    )
    expectRpcError(
      await t.opA.client.rpc('set_initial_balance', { p_key: randomUUID(), p_branch_id: t.branchA, p_product_id: botellaId, p_qty: 1 }),
      'permission_denied',
    )
  })
  it('CP-21 el saldo persiste tras cerrar sesión y volver a entrar', async () => {
    const fresh = anonClient()
    const { error } = await fresh.auth.signInWithPassword({ email: t.opA.email, password: t.opA.password })
    expect(error).toBeNull()
    const { data } = await fresh.from('inventory_status').select('balance, sku').eq('product_id', shampooId)
    expect(data!.length).toBe(1)
    expect(Number(data![0]!.balance)).toBe(2000)
    await fresh.auth.signOut()
  })
})

describe('CP-23 tercera sucursal por configuración', () => {
  it('opera con inventario, alertas y operador propios', async () => {
    const c = await t.adminUser.client.rpc('create_branch', { p_code: 'TC', p_name: 'Sucursal C' })
    expect(c.error).toBeNull()
    const opC = await t.addUser('operator', c.data.id, 'opc')
    const en = await t.adminUser.client.rpc('enable_product_in_branch', { p_product_id: shampooId, p_branch_id: c.data.id, p_min_qty: 500 })
    expect(en.error).toBeNull()
    const init = await t.adminUser.client.rpc('set_initial_balance', { p_key: randomUUID(), p_branch_id: c.data.id, p_product_id: shampooId, p_qty: 300 })
    expect(init.error).toBeNull()
    expect(await openAlerts(c.data.id, shampooId)).toBe(1)
    const mine = await opC.client.from('inventory_status').select('branch_id, balance')
    expect(mine.data!.map((r) => r.branch_id)).toEqual([c.data.id])
    expect(Number(mine.data![0]!.balance)).toBe(300)
    const notA = await opC.client.from('inventory').select('*').eq('branch_id', t.branchA)
    expect(notA.data).toEqual([])
  })
})
