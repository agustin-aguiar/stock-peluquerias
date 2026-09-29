import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toast'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { messageFor } from '@/lib/errors'
import { formatQuantity } from '@/lib/quantity'
import type { InventoryStatus, Product } from '@/types/models'
import { HISTORY_PAGE_SIZE, useMovementHistory, useReverseMovement, type MovementRecord } from './movementsApi'

const LABELS: Record<string, string> = {
  initial: 'Saldo inicial', purchase: 'Ingreso', consumption: 'Consumo', sale: 'Venta',
  shrinkage: 'Merma', adjustment: 'Ajuste', reversal: 'Reversión',
}

type Props = { product: Product; rows: InventoryStatus[]; isAdmin: boolean }

export function MovementHistory({ product, rows, isAdmin }: Props) {
  const toast = useToast()
  const reversal = useReverseMovement()
  const [branchId, setBranchId] = useState<string>('all')
  const [type, setType] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(0)
  const [target, setTarget] = useState<MovementRecord | null>(null)
  const [reason, setReason] = useState('')
  const [key, setKey] = useState(() => crypto.randomUUID())
  const [error, setError] = useState<string | null>(null)
  const history = useMovementHistory({ productId: product.id, branchId, type, from, to, page })
  const branches = Object.fromEntries(rows.map((row) => [row.branch_id, row.branch_name]))

  function openReversal(movement: MovementRecord) {
    setTarget(movement)
    setReason('')
    setKey(crypto.randomUUID())
    setError(null)
  }

  async function submitReversal(e: FormEvent) {
    e.preventDefault()
    if (!target || !reason.trim()) return setError('Ingresá un motivo.')
    try {
      const result = await reversal.mutateAsync({ key, movementId: target.id, reason: reason.trim() })
      toast.push({ kind: 'success', text: `Operación ${result.operation_id} · nuevo saldo ${formatQuantity(Number(result.balance), product.unit)}.` })
      setTarget(null)
    } catch (err) {
      setError(messageFor(err))
    }
  }

  return (
    <section className="mt-8">
      <h2 className="mb-4 text-lg font-semibold">Historial</h2>
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        {isAdmin && <Select label="Sucursal" value={branchId} onChange={(e) => { setBranchId(e.target.value); setPage(0) }}
          options={[{ value: 'all', label: 'Todas' }, ...rows.map((r) => ({ value: r.branch_id as string, label: r.branch_name as string }))]} />}
        <Select label="Tipo" value={type} onChange={(e) => { setType(e.target.value); setPage(0) }}
          options={[{ value: '', label: 'Todos' }, ...Object.entries(LABELS).map(([value, label]) => ({ value, label }))]} />
        <Input label="Desde" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0) }} />
        <Input label="Hasta" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0) }} />
      </div>
      {history.isPending && <LoadingState />}
      {history.isError && <ErrorState message={messageFor(history.error)} onRetry={() => void history.refetch()} />}
      {history.data && history.data.rows.length === 0 && <EmptyState title="Sin movimientos" description="Probá otro filtro o registrá el primer movimiento." />}
      {history.data && history.data.rows.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] border-collapse text-sm">
              <thead><tr className="label-caps text-left text-muted">
                <th className="py-2 pr-4">Fecha</th><th className="py-2 pr-4">Sucursal</th>
                <th className="py-2 pr-4">Tipo</th><th className="py-2 pr-4 text-right">Cantidad</th>
                <th className="py-2 pr-4">Referencia y motivo</th><th className="py-2">Operación</th>
              </tr></thead>
              <tbody>{history.data.rows.map((movement) => (
                <tr key={movement.id} className="border-t border-hairline">
                  <td className="py-3 pr-4 whitespace-nowrap">{new Date(movement.created_at).toLocaleString('es-UY')}</td>
                  <td className="py-3 pr-4">{branches[movement.branch_id ?? ''] ?? '—'}</td>
                  <td className="py-3 pr-4">{LABELS[movement.operation.type] ?? movement.operation.type}</td>
                  <td className="py-3 pr-4 text-right font-semibold tnum">{movement.qty_delta > 0 ? '+' : ''}{formatQuantity(Number(movement.qty_delta), product.unit)}</td>
                  <td className="py-3 pr-4">{[movement.operation.reference, movement.operation.reason].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="py-3"><span className="block max-w-36 truncate font-mono text-xs" title={movement.operation.id}>{movement.operation.id}</span>
                    {isAdmin && !movement.reverses_movement_id && ['purchase', 'consumption', 'sale', 'shrinkage', 'adjustment'].includes(movement.operation.type) &&
                      <button type="button" className="mt-1 text-xs underline" onClick={() => openReversal(movement)}>Revertir</button>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-muted">
            <span>{page * HISTORY_PAGE_SIZE + 1}–{Math.min((page + 1) * HISTORY_PAGE_SIZE, history.data.count)} de {history.data.count}</span>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
              <Button variant="secondary" disabled={(page + 1) * HISTORY_PAGE_SIZE >= history.data.count} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
            </div>
          </div>
        </>
      )}
      {target && <Dialog open onClose={() => setTarget(null)} title="Revertir movimiento">
        <p className="mb-4 text-sm">Se registrará un movimiento contrario por {formatQuantity(Math.abs(Number(target.qty_delta)), product.unit)}. Operación original: {target.operation.id}.</p>
        <form onSubmit={submitReversal} className="flex flex-col gap-4">
          <Input label="Motivo (obligatorio)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} autoFocus />
          {error && <p role="alert" className="text-sm text-carmine-fg">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTarget(null)} disabled={reversal.isPending}>Cancelar</Button>
            <Button type="submit" disabled={reversal.isPending || !reason.trim()}>{reversal.isPending ? 'Revirtiendo…' : 'Confirmar reversión'}</Button>
          </div>
        </form>
      </Dialog>}
    </section>
  )
}
