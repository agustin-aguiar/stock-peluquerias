export type UnitKind = 'unit' | 'ml' | 'g'

export const UNIT_LABEL: Record<UnitKind, string> = { unit: 'u', ml: 'ml', g: 'g' }
export const UNIT_NAME: Record<UnitKind, string> = { unit: 'Unidad', ml: 'Mililitros', g: 'Gramos' }

export type ParseResult = { ok: true; value: number } | { ok: false; error: string }

/**
 * Convierte texto ingresado por el usuario a número.
 * Acepta "1.974,50", "1974,50", "1974.50" y "25". No redondea: si hay más
 * decimales que los admitidos, devuelve error.
 */
export function parseQuantity(input: string, unit: UnitKind): ParseResult {
  const raw = input.trim()
  if (raw === '') return { ok: false, error: 'Ingresá una cantidad.' }

  // Con coma: la coma es decimal y los puntos son separadores de miles.
  // Sin coma: el punto (si hay) es decimal — salvo en productos por unidad, donde
  // un entero agrupado por miles ("1.000", "100.000") se interpreta como tal.
  let normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw
  if (!raw.includes(',') && unit === 'unit' && /^\d{1,3}(\.\d{3})+$/.test(raw)) {
    normalized = raw.replace(/\./g, '')
  }

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return { ok: false, error: 'La cantidad debe ser un número positivo.' }
  }
  const decimals = normalized.split('.')[1]?.length ?? 0
  if (unit === 'unit' && decimals > 0) {
    return { ok: false, error: 'Los productos por unidad solo admiten cantidades enteras.' }
  }
  if (decimals > 2) return { ok: false, error: 'Se admiten hasta dos decimales.' }

  const value = Number(normalized)
  if (!Number.isFinite(value)) return { ok: false, error: 'La cantidad no es válida.' }
  return { ok: true, value }
}

/** "1.974,50" para ml/g; "1.200" para unidades. Sin sufijo de unidad. */
export function formatNumber(value: number, unit: UnitKind): string {
  const decimals = unit === 'unit' ? 0 : 2
  const fixed = Math.abs(value).toFixed(decimals)
  const [intPart, fracPart] = fixed.split('.')
  const grouped = (intPart ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const sign = value < 0 ? '-' : ''
  return fracPart ? `${sign}${grouped},${fracPart}` : `${sign}${grouped}`
}

/**
 * Texto de precarga para inputs editables: siempre un valor que `parseQuantity`
 * acepta de vuelta sin transformación (round-trip seguro). Para `unit`, dígitos
 * enteros sin agrupar (evita que un punto agrupador se lea como decimal cuando
 * no hay coma). Para `ml`/`g`, igual a `formatNumber`.
 */
export function formatForInput(value: number, unit: UnitKind): string {
  if (unit !== 'unit') return formatNumber(value, unit)
  const sign = value < 0 ? '-' : ''
  return `${sign}${Math.trunc(Math.abs(value)).toString()}`
}

/** "1.974,50 ml" / "6 u". Siempre cantidad y unidad juntas. */
export function formatQuantity(value: number, unit: UnitKind): string {
  return `${formatNumber(value, unit)} ${UNIT_LABEL[unit]}`
}

/** Envases × contenido por envase, redondeado a 2 decimales. */
export function packagesToBase(packages: number, presentationQty: number): number {
  return Math.round(packages * presentationQty * 100) / 100
}
