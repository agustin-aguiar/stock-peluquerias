import { useState, type ChangeEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toast'
import { makeCsv, parseCsv } from '@/lib/csv'
import { messageFor } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { IMPORT_HEADERS as HEADERS, previewCsv, type ImportKind as Kind, type ImportRow as Row } from './preview'

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export function ImportacionesPage() {
  const toast = useToast()
  const qc = useQueryClient()
  const [kind, setKind] = useState<Kind>('catalog')
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [batchId, setBatchId] = useState(() => crypto.randomUUID())
  const [pending, setPending] = useState(false)
  const [exporting, setExporting] = useState(false)

  function changeKind(value: Kind) {
    setKind(value); setFileName(''); setRows([]); setErrors([]); setBatchId(crypto.randomUUID())
  }

  async function readFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setBatchId(crypto.randomUUID())
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer())
      const preview = previewCsv(kind, parseCsv(text))
      setRows(preview.rows)
      setErrors(preview.errors)
    } catch (err) {
      setRows([])
      setErrors([err instanceof Error ? err.message : 'No se pudo leer el CSV en UTF-8.'])
    }
  }

  async function confirm() {
    if (!rows.length || errors.length) return
    setPending(true)
    try {
      const { error } = await supabase.rpc('import_csv_batch', { p_id: batchId, p_kind: kind, p_rows: rows })
      if (error) throw error
      toast.push({ kind: 'success', text: `${rows.length} filas importadas en un lote.` })
      setRows([]); setFileName(''); setBatchId(crypto.randomUUID())
      void qc.invalidateQueries({ queryKey: ['inventory'] })
      void qc.invalidateQueries({ queryKey: ['products'] })
    } catch (err) { setErrors([messageFor(err)]) }
    finally { setPending(false) }
  }

  async function exportInventory() {
    setExporting(true)
    setErrors([])
    try {
      const all: Array<{ branch_code: string | null; sku: string | null; product_name: string | null; unit: string | null; balance: number | null; min_qty: number | null }> = []
      for (let start = 0; ; start += 500) {
        const { data, error } = await supabase.from('inventory_status').select('branch_code, sku, product_name, unit, balance, min_qty')
          .order('branch_code').order('sku').range(start, start + 499)
        if (error) throw error
        all.push(...data)
        if (data.length < 500) break
      }
      download('inventario.csv', makeCsv(['branch_code', 'sku', 'product_name', 'unit', 'balance', 'min_qty'],
        all.map((r) => [r.branch_code, r.sku, r.product_name, r.unit, r.balance, r.min_qty])))
    } catch (err) { setErrors([messageFor(err)]) }
    finally { setExporting(false) }
  }

  return <>
    <PageHeader eyebrow="Datos" title="Importación y exportación" description="Revisá el archivo antes de confirmar: el lote entero se aplica o se rechaza." />
    <div className="mb-5 flex flex-wrap gap-2">
      <Button variant="secondary" onClick={() => download('plantilla-catalogo.csv', makeCsv(HEADERS.catalog, []))}>Plantilla de catálogo</Button>
      <Button variant="secondary" onClick={() => download('plantilla-saldos.csv', makeCsv(HEADERS.initial, []))}>Plantilla de saldos</Button>
      <Button variant="secondary" onClick={() => void exportInventory()} disabled={exporting}>{exporting ? 'Exportando…' : 'Exportar inventario'}</Button>
    </div>
    <section className="rounded-lg border border-hairline bg-surface p-4">
      <div className="grid gap-3 md:grid-cols-2"><Select label="Tipo de archivo" value={kind} onChange={(e) => changeKind(e.target.value as Kind)}
        options={[{ value: 'catalog', label: 'Catálogo: productos nuevos' }, { value: 'initial', label: 'Saldos iniciales' }]} />
        <div className="flex flex-col gap-1"><label htmlFor="csv-file" className="text-sm font-semibold">Archivo CSV UTF-8</label>
          <input id="csv-file" type="file" accept=".csv,text/csv" onChange={(e) => void readFile(e)} className="text-sm" /></div></div>
      <p className="mt-3 text-sm text-muted">Separador: coma. Decimales: punto. Hasta 500 filas. Los saldos iniciales sólo se cargan una vez por producto y local; el mínimo existente debe coincidir con el archivo.</p>
      {fileName && <p className="mt-3 text-sm">Archivo: <strong>{fileName}</strong> · {rows.length} filas leídas.</p>}
      {errors.length > 0 && <ul role="alert" className="mt-3 list-disc pl-5 text-sm text-carmine-fg">{errors.slice(0, 20).map((error, i) => <li key={i}>{error}</li>)}
        {errors.length > 20 && <li>Hay {errors.length - 20} errores más.</li>}</ul>}
      {rows.length > 0 && <div className="mt-4 overflow-x-auto"><table className="min-w-full border-collapse text-sm"><thead><tr className="text-left text-muted">{HEADERS[kind].map((h) => <th key={h} className="border-b border-hairline p-2">{h}</th>)}</tr></thead>
        <tbody>{rows.slice(0, 20).map((row, i) => <tr key={i} className="border-b border-hairline">{HEADERS[kind].map((h) => <td key={h} className="p-2">{String(row[h] ?? '')}</td>)}</tr>)}</tbody></table>
        {rows.length > 20 && <p className="mt-2 text-xs text-muted">Vista previa de las primeras 20 filas.</p>}</div>}
      <div className="mt-4"><Button onClick={() => void confirm()} disabled={pending || !rows.length || errors.length > 0}>{pending ? 'Importando…' : 'Confirmar lote'}</Button></div>
    </section>
  </>
}
