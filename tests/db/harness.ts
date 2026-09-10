import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect } from 'vitest'

const URL = process.env.SUPABASE_URL!
const ANON = process.env.SUPABASE_ANON_KEY!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!

const noSession = { auth: { persistSession: false, autoRefreshToken: false } }

/** Cliente con service_role: salta RLS. Solo para preparar y limpiar datos. */
export const admin: SupabaseClient = createClient(URL, SERVICE, noSession)

export function anonClient(): SupabaseClient {
  return createClient(URL, ANON, noSession)
}

export type TestUser = {
  email: string
  password: string
  authUserId: string
  profileId: string
  client: SupabaseClient
}

export type TestChain = {
  chainId: string
  branchA: string
  branchB: string
  adminUser: TestUser
  opA: TestUser
  opB: TestUser
  addUser: (role: 'admin' | 'operator', branchId: string | null, label: string) => Promise<TestUser>
  cleanup: () => Promise<void>
}

/** Crea cadena aislada con 2 sucursales y 3 usuarios autenticados. */
export async function createTestChain(): Promise<TestChain> {
  const tag = randomUUID().slice(0, 8)
  const users: TestUser[] = []

  const { data: chain, error: e1 } = await admin
    .from('chains')
    .insert({ name: `test-${tag}` })
    .select()
    .single()
  if (e1) throw e1

  const { data: branches, error: e2 } = await admin
    .from('branches')
    .insert([
      { chain_id: chain.id, code: 'TA', name: `Sucursal A ${tag}` },
      { chain_id: chain.id, code: 'TB', name: `Sucursal B ${tag}` },
    ])
    .select()
  if (e2) throw e2
  const branchA = branches.find((b) => b.code === 'TA')!.id as string
  const branchB = branches.find((b) => b.code === 'TB')!.id as string

  const addUser = async (role: 'admin' | 'operator', branchId: string | null, label: string) => {
    const email = `${label}-${tag}@example.com`
    const password = `Test-${randomUUID()}`
    const { data: profile, error: ep } = await admin
      .from('profiles')
      .insert({ chain_id: chain.id, email, full_name: label, role, branch_id: branchId })
      .select()
      .single()
    if (ep) throw ep
    const { data: created, error: ea } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (ea) throw ea
    const client = anonClient()
    const { error: es } = await client.auth.signInWithPassword({ email, password })
    if (es) throw es
    const user: TestUser = {
      email,
      password,
      authUserId: created.user.id,
      profileId: profile.id,
      client,
    }
    users.push(user)
    return user
  }

  const adminUser = await addUser('admin', null, 'admin')
  const opA = await addUser('operator', branchA, 'opa')
  const opB = await addUser('operator', branchB, 'opb')

  const cleanup = async () => {
    await admin.from('chains').delete().eq('id', chain.id)
    for (const u of users) await admin.auth.admin.deleteUser(u.authUserId)
  }

  return { chainId: chain.id, branchA, branchB, adminUser, opA, opB, addUser, cleanup }
}

/** Afirma que una respuesta de supabase-js trae el código RPC esperado. */
export function expectRpcError(res: { error: { message: string } | null }, code: string) {
  expect(res.error, `esperaba error ${code} y no hubo error`).not.toBeNull()
  expect(res.error!.message).toBe(code)
}
