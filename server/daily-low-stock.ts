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
