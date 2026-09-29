export type ImportKind = 'catalog' | 'initial'
export type ImportRow = Record<string, string | number | null>
export const IMPORT_HEADERS: Record<ImportKind, string[]> = {
  catalog: ['sku', 'name', 'unit', 'brand', 'category', 'presentation', 'presentation_qty'],
  initial: ['branch_code', 'sku', 'qty', 'min_qty'],
}

function parseDecimal(value: string, unit: string, positive: boolean): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null
  if (unit === 'unit' && value.includes('.')) return null
  const n = Number(value)
  return Number.isFinite(n) && (positive ? n > 0 : n >= 0) ? n : null
}

export function previewCsv(kind: ImportKind, cells: string[][]): { rows: ImportRow[]; errors: string[] } {
  const expected = IMPORT_HEADERS[kind]
  if (!cells.length || cells[0]!.map((v) => v.trim()).join(',') !== expected.join(',')) {
    return { rows: [], errors: [`La primera fila debe ser: ${expected.join(',')}`] }
  }
  if (cells.length < 2 || cells.length > 501) return { rows: [], errors: ['El archivo debe tener entre 1 y 500 filas de datos.'] }
  const rows: ImportRow[] = []
  const errors: string[] = []
  const seen = new Set<string>()
  for (const [index, cellsRow] of cells.slice(1).entries()) {
    const line = index + 2
    if (cellsRow.length !== expected.length) { errors.push(`Fila ${line}: cantidad de columnas incorrecta.`); continue }
    const values = Object.fromEntries(expected.map((header, i) => [header, cellsRow[i]!.trim()])) as Record<string, string>
    const field = (name: string) => values[name] ?? ''
    const duplicateKey = kind === 'catalog' ? field('sku').toLowerCase() : `${field('branch_code').toUpperCase()}:${field('sku').toLowerCase()}`
    if (seen.has(duplicateKey)) errors.push(`Fila ${line}: SKU repetido en el archivo.`)
    seen.add(duplicateKey)
    if (kind === 'catalog') {
      if (!/^[A-Za-z0-9._-]{1,40}$/.test(field('sku')) || !field('name') || field('name').length > 160 || !['unit', 'ml', 'g'].includes(field('unit'))) {
        errors.push(`Fila ${line}: SKU, nombre o unidad inválidos.`)
      }
      const presentation = field('presentation_qty') ? parseDecimal(field('presentation_qty'), field('unit'), true) : null
      if (field('presentation_qty') && presentation === null) errors.push(`Fila ${line}: contenido por envase inválido.`)
      rows.push({ ...values, presentation_qty: presentation })
    } else {
      if (!/^[A-Z0-9]{2,8}$/.test(field('branch_code').toUpperCase()) || !field('sku')) errors.push(`Fila ${line}: sucursal o SKU inválido.`)
      const qty = parseDecimal(field('qty'), 'ml', false)
      const min = parseDecimal(field('min_qty'), 'ml', false)
      if (qty === null || min === null) errors.push(`Fila ${line}: cantidad o mínimo inválido; usá punto decimal.`)
      rows.push({ branch_code: field('branch_code').toUpperCase(), sku: field('sku'), qty, min_qty: min })
    }
  }
  return { rows, errors }
}
