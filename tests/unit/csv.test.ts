import { describe, expect, it } from 'vitest'
import { csvCell, makeCsv, parseCsv } from '@/lib/csv'

describe('CSV', () => {
  it('lee BOM, comas y comillas escapadas', () => {
    expect(parseCsv('\uFEFFsku,name\r\nA,"Shampoo, ""azul"""\r\n')).toEqual([['sku', 'name'], ['A', 'Shampoo, "azul"']])
  })
  it('rechaza comillas inválidas', () => {
    expect(() => parseCsv('a,"sin cerrar')).toThrow()
  })
  it('protege texto que Excel podría ejecutar como fórmula', () => {
    expect(csvCell('=1+1')).toBe("'=1+1")
    expect(csvCell('  @cmd')).toBe("'  @cmd")
    expect(makeCsv(['name'], [['A,B']])).toContain('"A,B"')
  })
})
