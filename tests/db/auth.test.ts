import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { admin, anonClient, createTestChain, type TestChain } from './harness'

let t: TestChain
let productId: string

beforeAll(async () => {
  t = await createTestChain()
  const { data: p, error } = await admin
    .from('products')
    .insert({ chain_id: t.chainId, sku: 'T-RLS-1', name: 'Producto RLS', unit: 'ml' })
    .select()
    .single()
  if (error) throw error
  productId = p.id
  const { error: e2 } = await admin.from('inventory').insert([
    { chain_id: t.chainId, branch_id: t.branchA, product_id: productId, balance: 10, min_qty: 20 },
    { chain_id: t.chainId, branch_id: t.branchB, product_id: productId, balance: 30, min_qty: 5 },
  ])
  if (e2) throw e2
})

afterAll(async () => {
  await t.cleanup()
})

describe('CP-01 sin sesión', () => {
  it('anon no lee inventory', async () => {
    const res = await anonClient().from('inventory').select('*')
    expect(res.error).not.toBeNull()
  })
  it('anon no lee branches ni profiles', async () => {
    expect((await anonClient().from('branches').select('*')).error).not.toBeNull()
    expect((await anonClient().from('profiles').select('*')).error).not.toBeNull()
  })
})

describe('trigger de vinculación', () => {
  it('auth_user_id quedó vinculado al perfil por email', async () => {
    const { data } = await admin
      .from('profiles')
      .select('auth_user_id')
      .eq('id', t.opA.profileId)
      .single()
    expect(data!.auth_user_id).toBe(t.opA.authUserId)
  })
})

describe('CP-02 lectura por sucursal', () => {
  it('operador A solo ve inventario de A', async () => {
    const { data, error } = await t.opA.client.from('inventory').select('branch_id')
    expect(error).toBeNull()
    expect(data!.map((r) => r.branch_id)).toEqual([t.branchA])
  })
  it('operador A no ve inventario de B ni filtrando por id', async () => {
    const { data } = await t.opA.client.from('inventory').select('*').eq('branch_id', t.branchB)
    expect(data).toEqual([])
  })
  it('admin ve ambas sucursales', async () => {
    const { data } = await t.adminUser.client.from('inventory').select('branch_id')
    expect(data!.map((r) => r.branch_id).sort()).toEqual([t.branchA, t.branchB].sort())
  })
  it('operador A no puede escribir inventory directamente (sin privilegio)', async () => {
    const res = await t.opA.client.from('inventory').update({ balance: 999 }).eq('branch_id', t.branchA)
    expect(res.error).not.toBeNull()
    const { data } = await admin.from('inventory').select('balance').eq('branch_id', t.branchA).single()
    expect(Number(data!.balance)).toBe(10)
  })
  it('operador A no puede insertar productos ni sucursales directamente', async () => {
    const r1 = await t.opA.client.from('products').insert({ chain_id: t.chainId, sku: 'X', name: 'x', unit: 'g' })
    expect(r1.error).not.toBeNull()
    const r2 = await t.opA.client.from('branches').insert({ chain_id: t.chainId, code: 'ZZ', name: 'z' })
    expect(r2.error).not.toBeNull()
  })
})

describe('perfiles', () => {
  it('operador ve solo su fila; admin ve las tres', async () => {
    const mine = await t.opA.client.from('profiles').select('id')
    expect(mine.data!.map((r) => r.id)).toEqual([t.opA.profileId])
    const all = await t.adminUser.client.from('profiles').select('id')
    expect(all.data!.length).toBe(3)
  })
  it('CP-03 operador no puede cambiarse el rol por UPDATE directo', async () => {
    const res = await t.opA.client.from('profiles').update({ role: 'admin' }).eq('id', t.opA.profileId)
    expect(res.error).not.toBeNull()
    const { data } = await admin.from('profiles').select('role').eq('id', t.opA.profileId).single()
    expect(data!.role).toBe('operator')
  })
  it('profiles_public: operador ve nombres de toda la cadena sin email', async () => {
    const { data, error } = await t.opA.client.from('profiles_public').select('*')
    expect(error).toBeNull()
    expect(data!.length).toBe(3)
    expect(Object.keys(data![0]!)).not.toContain('email')
  })
})

describe('CP-04 usuario desactivado con sesión vigente', () => {
  it('pierde lecturas de inmediato y las recupera al reactivarlo', async () => {
    await admin.from('profiles').update({ is_active: false }).eq('id', t.opB.profileId)
    const inv = await t.opB.client.from('inventory').select('*')
    expect(inv.data).toEqual([])
    const me = await t.opB.client.from('profiles').select('*')
    expect(me.data).toEqual([])
    const pub = await t.opB.client.from('profiles_public').select('*')
    expect(pub.data).toEqual([])
    await admin.from('profiles').update({ is_active: true }).eq('id', t.opB.profileId)
    const again = await t.opB.client.from('inventory').select('branch_id')
    expect(again.data!.map((r) => r.branch_id)).toEqual([t.branchB])
  })
})

describe('aislamiento entre cadenas', () => {
  it('otra cadena no es visible ni para el admin', async () => {
    const { data: other } = await admin.from('chains').insert({ name: 'otra-cadena' }).select().single()
    await admin.from('branches').insert({ chain_id: other!.id, code: 'OT', name: 'Otra' })
    const { data } = await t.adminUser.client.from('branches').select('code')
    expect(data!.map((r) => r.code).sort()).toEqual(['TA', 'TB'])
    await admin.from('chains').delete().eq('id', other!.id)
  })
})

describe('audit_events e inventory_status', () => {
  it('audit_events: operador no ve, admin sí', async () => {
    await admin.from('audit_events').insert({
      chain_id: t.chainId, action: 'test', entity_type: 'test', new_values: { a: 1 },
    })
    const op = await t.opA.client.from('audit_events').select('*')
    expect(op.data).toEqual([])
    const ad = await t.adminUser.client.from('audit_events').select('*')
    expect(ad.data!.length).toBe(1)
  })
  it('inventory_status calcula below_min y respeta RLS', async () => {
    const { data, error } = await t.opA.client.from('inventory_status').select('*')
    expect(error).toBeNull()
    expect(data!.length).toBe(1)
    expect(data![0]!.below_min).toBe(true)
    expect(data![0]!.sku).toBe('T-RLS-1')
    expect(data![0]!.branch_code).toBe('TA')
    const b = await t.adminUser.client.from('inventory_status').select('below_min').eq('branch_id', t.branchB)
    expect(b.data![0]!.below_min).toBe(false)
  })
})
