import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { admin, createTestChain, type TestChain } from './harness'

let chain: TestChain

beforeAll(async () => { chain = await createTestChain() })
afterAll(async () => { await chain.cleanup() })

describe('reserva del correo diario', () => {
  it('solo permite al servicio reservar y bloquea duplicados del mismo día', async () => {
    const input = {
      p_chain_id: chain.chainId,
      p_local_date: '2026-09-29',
      p_recipient_email: chain.adminUser.email,
    }
    const denied = await chain.adminUser.client.rpc('claim_daily_low_stock_email', input)
    expect(denied.error).not.toBeNull()

    const first = await admin.rpc('claim_daily_low_stock_email', input)
    expect(first.error).toBeNull()
    expect(first.data).toBe(true)
    const second = await admin.rpc('claim_daily_low_stock_email', input)
    expect(second.error).toBeNull()
    expect(second.data).toBe(false)

    const { error: markError } = await admin.from('daily_low_stock_emails')
      .update({ sent_at: new Date().toISOString(), locked_until: null })
      .eq('chain_id', chain.chainId)
    expect(markError).toBeNull()
    const afterSend = await admin.rpc('claim_daily_low_stock_email', input)
    expect(afterSend.error).toBeNull()
    expect(afterSend.data).toBe(false)
    const noRead = await chain.adminUser.client.from('daily_low_stock_emails').select('id')
    expect(noRead.error).not.toBeNull()
  })
})
