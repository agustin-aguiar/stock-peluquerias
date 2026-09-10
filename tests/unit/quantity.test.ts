import { describe, expect, it } from 'vitest'
import { formatForInput, formatNumber, formatQuantity, packagesToBase, parseQuantity } from '@/lib/quantity'

describe('parseQuantity', () => {
  it('acepta coma decimal y punto de miles', () => {
    expect(parseQuantity('1.974,50', 'ml')).toEqual({ ok: true, value: 1974.5 })
    expect(parseQuantity('1974,5', 'ml')).toEqual({ ok: true, value: 1974.5 })
  })
  it('acepta punto decimal cuando no hay coma', () => {
    expect(parseQuantity('1974.50', 'g')).toEqual({ ok: true, value: 1974.5 })
    expect(parseQuantity(' 25 ', 'unit')).toEqual({ ok: true, value: 25 })
  })
  it('rechaza vacío, negativo y texto', () => {
    expect(parseQuantity('', 'ml').ok).toBe(false)
    expect(parseQuantity('-5', 'ml').ok).toBe(false)
    expect(parseQuantity('abc', 'ml').ok).toBe(false)
    expect(parseQuantity('1,2,3', 'ml').ok).toBe(false)
  })
  it('rechaza más de dos decimales sin redondear', () => {
    const r = parseQuantity('25,555', 'ml')
    expect(r).toEqual({ ok: false, error: 'Se admiten hasta dos decimales.' })
  })
  it('rechaza decimales en productos por unidad', () => {
    const r = parseQuantity('0,5', 'unit')
    expect(r).toEqual({ ok: false, error: 'Los productos por unidad solo admiten cantidades enteras.' })
  })
  it('acepta cero', () => {
    expect(parseQuantity('0', 'unit')).toEqual({ ok: true, value: 0 })
    expect(parseQuantity('0,00', 'ml')).toEqual({ ok: true, value: 0 })
  })
  it('acepta enteros agrupados por miles en productos por unidad', () => {
    expect(parseQuantity('1.000', 'unit')).toEqual({ ok: true, value: 1000 })
    expect(parseQuantity('100.000', 'unit')).toEqual({ ok: true, value: 100000 })
  })
  it('rechaza decimales agrupados en productos por unidad', () => {
    expect(parseQuantity('1.0', 'unit').ok).toBe(false)
  })
})

describe('formatNumber / formatQuantity', () => {
  it('ml y g con dos decimales, punto de miles y coma decimal', () => {
    expect(formatNumber(1974.5, 'ml')).toBe('1.974,50')
    expect(formatNumber(0, 'g')).toBe('0,00')
    expect(formatNumber(1234567.8, 'ml')).toBe('1.234.567,80')
    expect(formatQuantity(1974.5, 'ml')).toBe('1.974,50 ml')
  })
  it('unidades sin decimales', () => {
    expect(formatNumber(6, 'unit')).toBe('6')
    expect(formatNumber(1200, 'unit')).toBe('1.200')
    expect(formatQuantity(6, 'unit')).toBe('6 u')
  })
  it('conserva el signo', () => {
    expect(formatQuantity(-25.5, 'ml')).toBe('-25,50 ml')
  })
})

describe('formatForInput', () => {
  it('unidades: dígitos enteros sin agrupar', () => {
    expect(formatForInput(100000, 'unit')).toBe('100000')
  })
  it('ml/g: igual a formatNumber', () => {
    expect(formatForInput(1974.5, 'ml')).toBe('1.974,50')
  })
  it('round-trip: parseQuantity(formatForInput(v, u), u) devuelve v', () => {
    const cases: Array<[number, 'unit' | 'ml' | 'g']> = [
      [100000, 'unit'],
      [6, 'unit'],
      [1974.5, 'ml'],
      [0, 'g'],
    ]
    for (const [v, u] of cases) {
      expect(parseQuantity(formatForInput(v, u), u)).toEqual({ ok: true, value: v })
    }
  })
})

describe('packagesToBase', () => {
  it('2 envases de 1.000 ml son 2.000 ml', () => {
    expect(packagesToBase(2, 1000)).toBe(2000)
  })
  it('evita error de coma flotante', () => {
    expect(packagesToBase(3, 0.1)).toBe(0.3)
  })
})
