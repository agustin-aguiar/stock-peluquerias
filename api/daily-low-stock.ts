import { createHash, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createClient } from '@supabase/supabase-js'

export type LowStockRow = {
  chain_id: string
  branch_code: string
  branch_name: string
  sku: string
  product_name: string
  balance: number
  min_qty: number
  unit: 'unit' | 'ml' | 'g'
}

const units = { unit: 'u', ml: 'ml', g: 'g' }

export function localDate(now: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const part = (type: string) => parts.find((item) => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]!)
}

export function dailyMessage(chainName: string, date: string, rows: LowStockRow[]) {
  const format = new Intl.NumberFormat('es-UY', { maximumFractionDigits: 2 })
  const ordered = [...rows].sort((a, b) =>
    a.branch_name.localeCompare(b.branch_name, 'es') || a.product_name.localeCompare(b.product_name, 'es'))
  const shown = ordered.slice(0, 100)
  const dateLabel = `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`
  const countLabel = `${rows.length} ${rows.length === 1 ? 'producto' : 'productos'}`
  const title = `Stock bajo: ${countLabel} · ${dateLabel}`
  const textLines = shown.map((row) =>
    `${row.branch_name} · ${row.product_name} (${row.sku}): ${format.format(row.balance)} ${units[row.unit]} / mínimo ${format.format(row.min_qty)} ${units[row.unit]}`)
  const omitted = rows.length - shown.length
  const text = [title, chainName, '', ...textLines, ...(omitted ? [`...y ${omitted} más. Consultá Inventario para ver todos.`] : []), '',
    'Ver inventario: https://stock-peluquerias.vercel.app/inventario'].join('\n')
  const htmlRows = shown.map((row) => `<tr><td>${escapeHtml(row.branch_name)}</td><td>${escapeHtml(row.product_name)} <small>(${escapeHtml(row.sku)})</small></td><td>${format.format(row.balance)} ${units[row.unit]}</td><td>${format.format(row.min_qty)} ${units[row.unit]}</td></tr>`).join('')
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;color:#292524"><h1>Stock bajo</h1><p>${escapeHtml(chainName)} · ${dateLabel} · ${countLabel}</p><table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse"><thead><tr><th>Sucursal</th><th>Producto</th><th>Saldo</th><th>Mínimo</th></tr></thead><tbody>${htmlRows}</tbody></table>${omitted ? `<p>Y ${omitted} productos más. Consultá Inventario para ver todos.</p>` : ''}<p><a href="https://stock-peluquerias.vercel.app/inventario">Abrir inventario</a></p></body></html>`
  return { subject: title, text, html }
}

type Recipient = { chain_id: string; email: string }
type Chain = { id: string; name: string; timezone: string }

function reply(response: ServerResponse, status: number, body: object) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(body))
}

function authorized(header: string | string[] | undefined, secret: string): boolean {
  if (!secret || typeof header !== 'string') return false
  const actual = Buffer.from(header)
  const expected = Buffer.from(`Bearer ${secret}`)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function deliveryKey(chainId: string, date: string, email: string): string {
  const hash = createHash('sha256').update(`${chainId}\0${date}\0${email}`).digest('hex')
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== 'GET') return reply(response, 405, { error: 'Método no permitido' })
  if (!authorized(request.headers.authorization, process.env.CRON_SECRET ?? '')) {
    return reply(response, 401, { error: 'No autorizado' })
  }

  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  const brevoKey = process.env.BREVO_API_KEY
  const senderEmail = process.env.BREVO_SENDER_EMAIL
  if (!url || !serviceKey || !brevoKey || !senderEmail) {
    return reply(response, 503, { error: 'Faltan variables de correo o base de datos' })
  }

  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const rows: LowStockRow[] = []
    const recipients: Recipient[] = []
    const pageSize = 1000
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await db.from('inventory_status')
        .select('id,chain_id,branch_code,branch_name,sku,product_name,balance,min_qty,unit')
        .eq('below_min', true).eq('product_active', true).eq('branch_active', true)
        .not('initialized_at', 'is', null).order('id').range(from, from + pageSize - 1)
      if (error) throw error
      rows.push(...(data as LowStockRow[]))
      if (!data || data.length < pageSize) break
    }
    if (rows.length === 0) return reply(response, 200, { alerts: 0, sent: 0, skipped: 0 })

    for (let from = 0; ; from += pageSize) {
      const { data, error } = await db.from('profiles').select('chain_id,email')
        .eq('role', 'admin').eq('is_active', true).not('auth_user_id', 'is', null)
        .order('id').range(from, from + pageSize - 1)
      if (error) throw error
      recipients.push(...(data as Recipient[]).filter((person) => !person.email.toLowerCase().endsWith('@example.com')))
      if (!data || data.length < pageSize) break
    }

    const { data: chains, error: chainError } = await db.from('chains').select('id,name,timezone')
    if (chainError) throw chainError
    const chainById = new Map((chains as Chain[]).map((chain) => [chain.id, chain]))
    const rowsByChain = new Map<string, LowStockRow[]>()
    for (const row of rows) {
      const group = rowsByChain.get(row.chain_id) ?? []
      group.push(row)
      rowsByChain.set(row.chain_id, group)
    }

    let sent = 0
    let skipped = 0
    let failed = 0
    for (const person of recipients) {
      const chain = chainById.get(person.chain_id)
      const lowStock = rowsByChain.get(person.chain_id)
      if (!chain || !lowStock?.length) continue
      const date = localDate(new Date(), chain.timezone)
      const email = person.email.trim().toLowerCase()
      const { data: claimed, error: claimError } = await db.rpc('claim_daily_low_stock_email', {
        p_chain_id: chain.id, p_local_date: date, p_recipient_email: email,
      })
      if (claimError) throw claimError
      if (!claimed) { skipped += 1; continue }

      try {
        const message = dailyMessage(chain.name, date, lowStock)
        const result = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST', signal: AbortSignal.timeout(15_000),
          headers: { 'api-key': brevoKey, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            sender: { name: 'Stock Peluquerías', email: senderEmail },
            to: [{ email }], subject: message.subject,
            htmlContent: message.html,
            headers: { idempotencyKey: deliveryKey(chain.id, date, email) },
            tags: ['stock-bajo-diario'],
          }),
        })
        const body = await result.json() as { messageId?: string; message?: string; code?: string }
        const alreadyProcessed = result.status === 400 && body.code === 'duplicate_parameter'
        if (!alreadyProcessed && (!result.ok || !body.messageId)) {
          throw new Error(`Brevo ${result.status}: ${body.message ?? 'sin confirmación de envío'}`)
        }
        const { error: markError } = await db.from('daily_low_stock_emails')
          .update({ sent_at: new Date().toISOString(), brevo_message_id: body.messageId ?? null, locked_until: null })
          .eq('chain_id', chain.id).eq('local_date', date).eq('recipient_email', email)
        if (markError) throw markError
        sent += 1
      } catch (error) {
        failed += 1
        const reason = error instanceof Error ? error.message.slice(0, 500) : 'Error desconocido'
        console.error('No se pudo enviar el resumen diario:', reason)
        const { error: releaseError } = await db.from('daily_low_stock_emails')
          .update({ locked_until: null, last_error: reason })
          .eq('chain_id', chain.id).eq('local_date', date).eq('recipient_email', email)
          .is('sent_at', null)
        if (releaseError) console.error('No se pudo liberar el envío fallido:', releaseError.message)
      }
    }
    return reply(response, failed ? 502 : 200, { alerts: rows.length, sent, skipped, failed })
  } catch (error) {
    console.error('Error en el resumen diario:', error)
    return reply(response, 500, { error: 'No se pudo procesar el resumen diario' })
  }
}
