import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { admin, createTestChain, expectRpcError, type TestChain } from './harness'

let t: TestChain

beforeAll(async () => {
  t = await createTestChain()
})
afterAll(async () => {
  await t.cleanup()
})

describe('create_branch / update_branch', () => {
  it('admin crea sucursal y queda auditada', async () => {
    const res = await t.adminUser.client.rpc('create_branch', { p_code: 'TC', p_name: 'Sucursal C' })
    expect(res.error).toBeNull()
    expect(res.data.code).toBe('TC')
    const audit = await t.adminUser.client
      .from('audit_events')
      .select('action, entity_id')
      .eq('action', 'branch.create')
    expect(audit.data!.some((a) => a.entity_id === res.data.id)).toBe(true)
  })
  it('rechaza código inválido y duplicado', async () => {
    expectRpcError(await t.adminUser.client.rpc('create_branch', { p_code: 'tc', p_name: 'x' }), 'invalid_code')
    expectRpcError(await t.adminUser.client.rpc('create_branch', { p_code: 'TA', p_name: 'x' }), 'duplicate_code')
    expectRpcError(await t.adminUser.client.rpc('create_branch', { p_code: 'TD', p_name: '   ' }), 'invalid_name')
  })
  it('operador no puede crear ni editar sucursales', async () => {
    expectRpcError(await t.opA.client.rpc('create_branch', { p_code: 'TX', p_name: 'x' }), 'permission_denied')
    expectRpcError(
      await t.opA.client.rpc('update_branch', { p_id: t.branchA, p_name: 'Hack', p_is_active: true }),
      'permission_denied',
    )
  })
  it('no desactiva sucursal con usuarios activos; sí sin ellos', async () => {
    expectRpcError(
      await t.adminUser.client.rpc('update_branch', { p_id: t.branchB, p_name: 'B', p_is_active: false }),
      'has_active_users',
    )
    const { data: c } = await admin.from('branches').select('id').eq('chain_id', t.chainId).eq('code', 'TC').single()
    const ok = await t.adminUser.client.rpc('update_branch', { p_id: c!.id, p_name: 'C cerrada', p_is_active: false })
    expect(ok.error).toBeNull()
    expect(ok.data.is_active).toBe(false)
    expect(ok.data.name).toBe('C cerrada')
  })
  it('no desactiva sucursal con saldo', async () => {
    const { data: p } = await admin
      .from('products').insert({ chain_id: t.chainId, sku: 'B-STOCK', name: 'Con stock', unit: 'g' }).select().single()
    const { data: c } = await admin.from('branches').select('id').eq('chain_id', t.chainId).eq('code', 'TC').single()
    await admin.from('inventory').insert({ chain_id: t.chainId, branch_id: c!.id, product_id: p!.id, balance: 5 })
    await t.adminUser.client.rpc('update_branch', { p_id: c!.id, p_name: 'C', p_is_active: true })
    expectRpcError(
      await t.adminUser.client.rpc('update_branch', { p_id: c!.id, p_name: 'C', p_is_active: false }),
      'has_stock',
    )
    await admin.from('inventory').delete().eq('product_id', p!.id)
  })
})

describe('upsert_product', () => {
  let productId: string
  it('crea producto con unidad y lo audita', async () => {
    const res = await t.adminUser.client.rpc('upsert_product', {
      p_sku: 'SH-PRO-1', p_name: 'Shampoo profesional 1 L', p_unit: 'ml',
      p_brand: 'Marca', p_category: 'Profesional', p_presentation: 'Envase 1.000 ml', p_presentation_qty: 1000,
    })
    expect(res.error).toBeNull()
    expect(res.data.unit).toBe('ml')
    expect(Number(res.data.presentation_qty)).toBe(1000)
    expect(Number(res.data.max_movement_qty)).toBe(100000)
    productId = res.data.id
  })
  it('CP-05 rechaza SKU duplicado (sin distinguir mayúsculas) e inválido', async () => {
    expectRpcError(
      await t.adminUser.client.rpc('upsert_product', { p_sku: 'sh-pro-1', p_name: 'Otro', p_unit: 'ml' }),
      'duplicate_sku',
    )
    expectRpcError(
      await t.adminUser.client.rpc('upsert_product', { p_sku: 'con espacio', p_name: 'Otro', p_unit: 'ml' }),
      'invalid_sku',
    )
    expectRpcError(
      await t.adminUser.client.rpc('upsert_product', { p_sku: 'OK-1', p_name: 'x', p_unit: 'ml', p_presentation_qty: -1 }),
      'invalid_quantity',
    )
    expectRpcError(
      await t.adminUser.client.rpc('upsert_product', { p_sku: 'OK-2', p_name: 'x', p_unit: 'unit', p_presentation_qty: 1.5 }),
      'invalid_quantity',
    )
  })
  it('edita nombre y permite cambiar unidad mientras no haya saldo', async () => {
    const res = await t.adminUser.client.rpc('upsert_product', {
      p_id: productId, p_sku: 'SH-PRO-1', p_name: 'Shampoo profesional neutro 1 L', p_unit: 'g',
    })
    expect(res.error).toBeNull()
    expect(res.data.unit).toBe('g')
    const back = await t.adminUser.client.rpc('upsert_product', {
      p_id: productId, p_sku: 'SH-PRO-1', p_name: 'Shampoo profesional neutro 1 L', p_unit: 'ml',
    })
    expect(back.error).toBeNull()
  })
  it('CP-33 con saldo no se desactiva; sin saldo sí y conserva la fila', async () => {
    await admin.from('inventory').insert({ chain_id: t.chainId, branch_id: t.branchA, product_id: productId, balance: 3 })
    expectRpcError(
      await t.adminUser.client.rpc('upsert_product', { p_id: productId, p_sku: 'SH-PRO-1', p_name: 'S', p_unit: 'ml', p_is_active: false }),
      'has_stock',
    )
    await admin.from('inventory').update({ balance: 0 }).eq('product_id', productId)
    const off = await t.adminUser.client.rpc('upsert_product', { p_id: productId, p_sku: 'SH-PRO-1', p_name: 'S', p_unit: 'ml', p_is_active: false })
    expect(off.error).toBeNull()
    expect(off.data.is_active).toBe(false)
    const still = await admin.from('products').select('id').eq('id', productId).single()
    expect(still.data!.id).toBe(productId)
  })
  it('operador no puede crear productos', async () => {
    expectRpcError(await t.opA.client.rpc('upsert_product', { p_sku: 'X', p_name: 'x', p_unit: 'g' }), 'permission_denied')
  })
})

describe('create_profile / update_profile', () => {
  let newOperatorId: string
  it('crea operador con sucursal', async () => {
    const res = await t.adminUser.client.rpc('create_profile', {
      p_email: `nuevo-${t.chainId.slice(0, 6)}@example.com`, p_full_name: 'Nuevo Op', p_role: 'operator', p_branch_id: t.branchB,
    })
    expect(res.error).toBeNull()
    expect(res.data.role).toBe('operator')
    newOperatorId = res.data.id
  })
  it('rechaza operador sin sucursal, email inválido y duplicado', async () => {
    expectRpcError(
      await t.adminUser.client.rpc('create_profile', { p_email: 'a@example.com', p_full_name: 'A', p_role: 'operator' }),
      'branch_required',
    )
    expectRpcError(
      await t.adminUser.client.rpc('create_profile', { p_email: 'no-es-email', p_full_name: 'A', p_role: 'admin' }),
      'invalid_email',
    )
    expectRpcError(
      await t.adminUser.client.rpc('create_profile', { p_email: t.opA.email.toUpperCase(), p_full_name: 'A', p_role: 'admin' }),
      'duplicate_email',
    )
  })
  it('CP-03 operador no puede ascenderse ni reasignarse', async () => {
    expectRpcError(
      await t.opA.client.rpc('update_profile', { p_id: t.opA.profileId, p_full_name: 'X', p_role: 'admin' }),
      'permission_denied',
    )
  })
  it('CP-31 admin edita y queda auditado con valores anteriores', async () => {
    const res = await t.adminUser.client.rpc('update_profile', {
      p_id: newOperatorId, p_full_name: 'Nuevo Op Editado', p_role: 'operator', p_branch_id: t.branchA, p_is_active: true,
    })
    expect(res.error).toBeNull()
    expect(res.data.branch_id).toBe(t.branchA)
    const audit = await t.adminUser.client.from('audit_events').select('*').eq('action', 'profile.update').eq('entity_id', newOperatorId)
    expect(audit.data!.length).toBe(1)
    expect(audit.data![0]!.old_values.full_name).toBe('Nuevo Op')
  })
  it('no permite autodesactivarse ni dejar la cadena sin administrador', async () => {
    expectRpcError(
      await t.adminUser.client.rpc('update_profile', { p_id: t.adminUser.profileId, p_full_name: 'A', p_role: 'admin', p_is_active: false }),
      'self_deactivation',
    )
    expectRpcError(
      await t.adminUser.client.rpc('update_profile', { p_id: t.adminUser.profileId, p_full_name: 'A', p_role: 'operator', p_branch_id: t.branchA, p_is_active: true }),
      'last_admin',
    )
  })
  it('CP-04 desactivar vía RPC bloquea la siguiente RPC del usuario', async () => {
    const off = await t.adminUser.client.rpc('update_profile', { p_id: t.opB.profileId, p_full_name: 'opb', p_role: 'operator', p_branch_id: t.branchB, p_is_active: false })
    expect(off.error).toBeNull()
    expectRpcError(await t.opB.client.rpc('create_branch', { p_code: 'QQ', p_name: 'q' }), 'inactive_user')
    await t.adminUser.client.rpc('update_profile', { p_id: t.opB.profileId, p_full_name: 'opb', p_role: 'operator', p_branch_id: t.branchB, p_is_active: true })
  })
})
