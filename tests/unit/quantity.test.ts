import { describe, expect, it } from 'vitest'
import { formatNumber, formatQuantity, packagesToBase, parseQuantity } from '@/lib/quantity'

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

describe('packagesToBase', () => {
  it('2 envases de 1.000 ml son 2.000 ml', () => {
    expect(packagesToBase(2, 1000)).toBe(2000)
  })
  it('evita error de coma flotante', () => {
    expect(packagesToBase(3, 0.1)).toBe(0.3)
  })
})
