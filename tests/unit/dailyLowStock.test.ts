import { describe, expect, it } from 'vitest'
import { dailyMessage, localDate, type LowStockRow } from '../../server/daily-low-stock'

const row: LowStockRow = {
  chain_id: 'chain', branch_code: 'POC', branch_name: 'Pocitos',
  sku: 'TIN-01', product_name: 'Tinte', balance: 25.5, min_qty: 50, unit: 'ml',
}

describe('resumen diario de stock', () => {
  it('usa la fecha local de la cadena aunque UTC ya haya cambiado de día', () => {
    expect(localDate(new Date('2026-09-30T01:30:00Z'), 'America/Montevideo')).toBe('2026-09-29')
  })

  it('muestra cantidades y protege el HTML de nombres cargados por usuarios', () => {
    const message = dailyMessage('Cadena <demo>', '2026-09-29', [
      { ...row, product_name: '<script>alert(1)</script>' },
    ])
    expect(message.subject).toContain('1 producto')
    expect(message.text).toContain('25,5 ml / mínimo 50 ml')
    expect(message.html).toContain('&lt;script&gt;')
    expect(message.html).not.toContain('<script>')
    expect(message.html).toContain('Cadena &lt;demo&gt;')
  })

  it('acota el correo largo e indica que hay más faltantes en la app', () => {
    const message = dailyMessage('Cadena', '2026-09-29', Array.from({ length: 101 }, (_, index) => ({
      ...row, sku: `SKU-${index}`,
    })))
    expect(message.text).toContain('...y 1 más')
    expect((message.html.match(/<tr>/g) ?? []).length).toBe(101) // cabecera + 100 productos
  })
})
