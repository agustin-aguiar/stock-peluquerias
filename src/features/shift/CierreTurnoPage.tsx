import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useCurrentProfile } from '@/app/guards'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { useOnline } from '@/components/ui/OfflineBanner'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useActiveBranch } from '@/features/branches/activeBranch'
import { useBranches } from '@/features/branches/api'
import { useCountInventory } from '@/features/counts/api'
import { messageFor } from '@/lib/errors'
import { formatQuantity, UNIT_LABEL, type UnitKind } from '@/lib/quantity'
import { supabase } from '@/lib/supabase'
import { buildShiftLines, type ShiftLine } from './shiftLines'

const REFERENCE = 'Cierre de turno'

export function CierreTurnoPage() {
  const me = useCurrentProfile()
  const isAdmin = me.role === 'admin'
  const online = useOnline()
  const toast = useToast()
  const qc = useQueryClient()
  const active = useActiveBranch()
  const branches = useBranches()
  const [chosenBranch, setChosenBranch] = useState('')
  const branchId = isAdmin ? (active.branchId !== 'all' ? active.branchId : chosenBranch) : (me.branch_id ?? '')
  const inventory = useCountInventory(branchId)
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failures, setFailures] = useState<Record<string, string>>({})
  // Una clave por producto y cantidad: un reintento no descuenta dos veces.
  const keys = useRef(new Map<string, { key: string; qty: number }>())

  const rows = inventory.data ?? []
  const stockRows = rows.map((r) => ({ product_id: r.product_id!, balance: Number(r.balance ?? 0), unit: (r.unit ?? 'unit') as UnitKind }))
  const { lines, errors } = buildShiftLines(stockRows, inputs)
  const byId = new Map(rows.map((r) => [r.product_id!, r]))
  const term = search.toLocaleLowerCase('es-UY')
  const visible = rows.filter((r) => `${r.sku} ${r.product_name}`.toLocaleLowerCase('es-UY').includes(term))
  const canSave = online && lines.length > 0 && Object.keys(errors).length === 0 && !saving

  function keyFor(line: ShiftLine) {
    const current = keys.current.get(line.productId)
    if (current && current.qty === line.qty) return current.key
    const next = { key: crypto.randomUUID(), qty: line.qty }
    keys.current.set(line.productId, next)
    return next.key
  }

  async function save() {
    setSaving(true)
    const failed: Record<string, string> = {}
    let saved = 0
    for (const line of lines) {
      const { error } = await supabase.rpc('register_movement', {
        p_key: keyFor(line), p_type: 'consumption', p_branch_id: branchId, p_product_id: line.productId,
        p_qty: line.qty, p_reason: null, p_reference: REFERENCE,
      })
      if (error) failed[line.productId] = messageFor(error)
      else { saved++; keys.current.delete(line.productId) }
    }
    setInputs((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => failed[id])))
    setFailures(failed)
    setSaving(false)
    setConfirming(false)
    void qc.invalidateQueries({ queryKey: ['counts', 'inventory'] })
    void qc.invalidateQueries({ queryKey: ['inventory'] })
    void qc.invalidateQueries({ queryKey: ['movements'] })
    void qc.invalidateQueries({ queryKey: ['home'] })
    const failedCount = Object.keys(failed).length
    if (failedCount === 0) toast.push({ kind: 'success', text: `Turno cerrado: se descontaron ${saved} producto${saved === 1 ? '' : 's'}.` })
    else toast.push({ kind: 'error', text: `Se guardaron ${saved}; ${failedCount} no se pudieron guardar. Revisalos y volvé a intentar.` })
  }

  return (
    <>
      <PageHeader
        eyebrow={branches.data?.find((b) => b.id === branchId)?.name ?? 'Sucursal'}
        title="Cierre de turno"
        description="Anotá cuánto se usó de cada producto en el turno. Dejá en blanco lo que no se usó."
      />
      {isAdmin && active.branchId === 'all' && (
        <div className="mb-4 max-w-sm">
          <Select label="Local" value={chosenBranch} onChange={(e) => { setChosenBranch(e.target.value); setInputs({}); setFailures({}) }}
            placeholder="Elegí un local" options={(branches.data ?? []).filter((b) => b.is_active).map((b) => ({ value: b.id, label: b.name }))} />
        </div>
      )}
      {!branchId && <EmptyState title="Elegí un local" description="El cierre se registra en un local por vez." />}
      {branchId && inventory.isPending && <LoadingState />}
      {inventory.isError && <ErrorState message={messageFor(inventory.error)} onRetry={() => void inventory.refetch()} />}
      {inventory.data && rows.length === 0 && (
        <EmptyState title="No hay productos con stock en este local" description="El administrador tiene que hacer la primera carga." />
      )}
      {rows.length > 0 && (
        <>
          <div className="relative mb-4 w-full max-w-sm">
            <Input label="Buscar" placeholder="Nombre o código" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            <Search size={16} className="pointer-events-none absolute bottom-3 left-3 text-muted" aria-hidden />
          </div>
          <ul className="flex flex-col divide-y divide-hairline rounded-lg border border-hairline bg-surface">
            {visible.map((r) => {
              const id = r.product_id!
              const unit = (r.unit ?? 'unit') as UnitKind
              return (
                <li key={id} className={`grid grid-cols-[1fr_7.5rem] items-start gap-3 p-3 ${inputs[id]?.trim() ? 'bg-canvas' : ''}`}>
                  <div className="min-w-0 pt-1">
                    <p className="font-semibold">{r.product_name}</p>
                    <p className="text-xs text-muted tnum">{r.sku} · hay <span className="font-semibold text-ink">{formatQuantity(Number(r.balance ?? 0), unit)}</span></p>
                  </div>
                  <Input label={`Usado (${UNIT_LABEL[unit]})`} value={inputs[id] ?? ''} inputMode={unit === 'unit' ? 'numeric' : 'decimal'}
                    onChange={(e) => {
                      const value = e.target.value
                      setInputs((prev) => ({ ...prev, [id]: value }))
                      setFailures((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => key !== id)))
                    }}
                    error={errors[id] ?? failures[id]} placeholder="0" />
                </li>
              )
            })}
          </ul>
          <div className="sticky bottom-20 mt-4 flex items-center justify-between gap-3 rounded-lg border border-hairline bg-surface p-3 shadow-[0_4px_16px_rgb(28_25_23/0.08)] md:bottom-4">
            <p className="min-w-0 text-sm">{lines.length === 0 ? <span className="text-muted">Sin consumos anotados</span> : <><strong className="tnum">{lines.length}</strong> producto{lines.length === 1 ? '' : 's'} para descontar</>}</p>
            <Button className="shrink-0" disabled={!canSave} onClick={() => setConfirming(true)}>Revisar</Button>
          </div>
        </>
      )}
      <Dialog open={confirming} onClose={() => !saving && setConfirming(false)} title="Confirmar cierre de turno">
        <ul className="mb-4 space-y-1 text-sm">
          {lines.map((line) => {
            const row = byId.get(line.productId)!
            const unit = (row.unit ?? 'unit') as UnitKind
            return <li key={line.productId} className="flex justify-between gap-3">
              <span>{row.product_name}</span>
              <span className="tnum">−{formatQuantity(line.qty, unit)} · quedan {formatQuantity(Number(row.balance ?? 0) - line.qty, unit)}</span>
            </li>
          })}
        </ul>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={saving} onClick={() => setConfirming(false)}>Volver</Button>
          <Button disabled={saving || !online} onClick={() => void save()}>{saving ? 'Guardando…' : 'Descontar del stock'}</Button>
        </div>
      </Dialog>
    </>
  )
}
