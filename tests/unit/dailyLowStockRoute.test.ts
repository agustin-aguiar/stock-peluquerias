import type { IncomingMessage, ServerResponse } from 'node:http'
import { afterEach, describe, expect, it, vi } from 'vitest'
import handler from '../../api/daily-low-stock'

afterEach(() => vi.unstubAllEnvs())

function fakeResponse() {
  const result = { statusCode: 200, body: '', setHeader: vi.fn(), end(body: string) { result.body = body } }
  return result
}

describe('ruta privada del correo diario', () => {
  it('rechaza solicitudes sin la clave del cron antes de leer datos', async () => {
    vi.stubEnv('CRON_SECRET', 'clave-de-prueba-larga')
    const response = fakeResponse()
    await handler({ method: 'GET', headers: {} } as IncomingMessage, response as unknown as ServerResponse)
    expect(response.statusCode).toBe(401)
    expect(response.body).toContain('No autorizado')
  })

  it('no acepta escrituras ni ejecuta el envío por POST', async () => {
    const response = fakeResponse()
    await handler({ method: 'POST', headers: {} } as IncomingMessage, response as unknown as ServerResponse)
    expect(response.statusCode).toBe(405)
  })
})
