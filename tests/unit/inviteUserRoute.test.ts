import type { IncomingMessage, ServerResponse } from 'node:http'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  invite: vi.fn(),
  from: vi.fn(),
}))
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }))
import handler from '../../api/invite-user'

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks() })

function response() {
  const value = { statusCode: 200, body: '', setHeader: vi.fn(), end(body: string) { value.body = body } }
  return value
}

function request(profileId: string) {
  return {
    method: 'POST', headers: { authorization: 'Bearer valid-token' },
    async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify({ profileId })) },
  } as unknown as IncomingMessage
}

function setup(actor: object, target: object) {
  vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('SUPABASE_SECRET_KEY', 'test-secret')
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
  mocks.invite.mockResolvedValue({ error: null })
  mocks.from.mockImplementation((table: string) => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({
      data: table === 'profiles' && mocks.from.mock.calls.filter(([name]) => name === 'profiles').length === 1 ? actor : target,
      error: null,
    }) }) }),
  }))
  mocks.createClient.mockReturnValue({ auth: { getUser: mocks.getUser, admin: { inviteUserByEmail: mocks.invite } }, from: mocks.from })
}

const profileId = '11111111-1111-4111-8111-111111111111'

describe('invitaciones de usuarios', () => {
  it('rechaza solicitudes sin sesión', async () => {
    const result = response()
    await handler({ method: 'POST', headers: {} } as IncomingMessage, result as unknown as ServerResponse)
    expect(result.statusCode).toBe(401)
    expect(mocks.createClient).not.toHaveBeenCalled()
  })

  it('no invita usuarios de otra cadena', async () => {
    setup({ id: 'admin', chain_id: 'chain-a', role: 'admin', is_active: true },
      { id: profileId, chain_id: 'chain-b', email: 'otro@example.com', is_active: true, auth_user_id: null })
    const result = response()
    await handler(request(profileId), result as unknown as ServerResponse)
    expect(result.statusCode).toBe(404)
    expect(mocks.invite).not.toHaveBeenCalled()
  })

  it('solo el administrador activo puede invitar', async () => {
    setup({ id: 'operator', chain_id: 'chain-a', role: 'operator', is_active: true },
      { id: profileId, chain_id: 'chain-a', email: 'nuevo@example.com', is_active: true, auth_user_id: null })
    const result = response()
    await handler(request(profileId), result as unknown as ServerResponse)
    expect(result.statusCode).toBe(403)
    expect(mocks.invite).not.toHaveBeenCalled()
  })

  it('invita al perfil activo de su propia cadena', async () => {
    setup({ id: 'admin', chain_id: 'chain-a', role: 'admin', is_active: true },
      { id: profileId, chain_id: 'chain-a', email: 'nuevo@example.com', is_active: true, auth_user_id: null })
    const result = response()
    await handler(request(profileId), result as unknown as ServerResponse)
    expect(result.statusCode).toBe(200)
    expect(mocks.invite).toHaveBeenCalledWith('nuevo@example.com', {
      redirectTo: 'https://stock-peluquerias.vercel.app/auth/restablecer',
    })
  })
})
