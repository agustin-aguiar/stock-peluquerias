/** CSV UTF-8 con separador coma y comillas RFC 4180. */
export function parseCsv(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  let closed = false
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') { quoted = false; closed = true }
      else cell += ch
      continue
    }
    if (ch === '"') {
      if (cell || closed) throw new Error('Comillas CSV fuera de lugar.')
      quoted = true
    } else if (ch === ',' || ch === '\n' || ch === '\r') {
      row.push(cell)
      cell = ''
      closed = false
      if (ch !== ',') {
        if (ch === '\r' && input[i + 1] === '\n') i++
        if (row.some((value) => value !== '')) rows.push(row)
        row = []
      }
    } else {
      if (closed) throw new Error('Texto después de comillas CSV.')
      cell += ch
    }
  }
  if (quoted) throw new Error('Comillas CSV sin cerrar.')
  row.push(cell)
  if (row.some((value) => value !== '')) rows.push(row)
  return rows
}

/** Evita que Excel/Sheets interpreten texto externo como fórmula. */
export function csvCell(value: string | number | null | undefined): string {
  let text = String(value ?? '')
  if (/^\s*[=+\-@]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function makeCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  return '\uFEFF' + [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
