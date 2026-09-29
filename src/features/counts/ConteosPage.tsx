import { useState, type FormEvent } from 'react'
import { useCurrentProfile } from '@/app/guards'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useBranches } from '@/features/branches/api'
import { messageFor } from '@/lib/errors'
import { formatQuantity, parseQuantity } from '@/lib/quantity'
import { useCountAction, useCountInventory, useCounts, type CountRow } from './api'

export function ConteosPage() {
  const me = useCurrentProfile()
  const isAdmin = me.role === 'admin'
  const toast = useToast()
  const branches = useBranches()
  const [branchId, setBranchId] = useState(me.branch_id ?? '')
  const [productId, setProductId] = useState('')
  const [observed, setObserved] = useState('')
  const [note, setNote] = useState('')
  const [countId, setCountId] = useState(() => crypto.randomUUID())
  const [status, setStatus] = useState('pending')
  const [review, setReview] = useState<{ row: CountRow; kind: 'approve' | 'reject' } | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inventory = useCountInventory(branchId)
  const counts = useCounts(status)
  const mutation = useCountAction()
  const selected = inventory.data?.find((r) => r.product_id === productId)
  const parsed = parseQuantity(observed, selected?.unit ?? 'unit')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!selected || !parsed.ok) return setError('Elegí un producto e ingresá la cantidad observada.')
    try {
      await mutation.mutateAsync({ kind: 'submit', id: countId, branchId,
        productId, observed: parsed.value, note: note.trim() || null })
      toast.push({ kind: 'success', text: 'Conteo enviado para revisión.' })
      setCountId(crypto.randomUUID())
      setProductId('')
      setObserved('')
      setNote('')
      setError(null)
    } catch (err) { setError(messageFor(err)) }
  }

  async function reviewCount(e: FormEvent) {
    e.preventDefault()
    if (!review) return
    if (review.kind === 'reject' && !reason.trim()) return setError('Explicá el rechazo.')
    try {
      if (review.kind === 'approve') await mutation.mutateAsync({ kind: 'approve', id: review.row.id })
      else await mutation.mutateAsync({ kind: 'reject', id: review.row.id, reason: reason.trim() })
      toast.push({ kind: 'success', text: review.kind === 'approve' ? 'Conteo aprobado.' : 'Conteo rechazado.' })
      setReview(null)
      setError(null)
    } catch (err) { setError(messageFor(err)) }
  }

  return <>
    <PageHeader eyebrow="Control físico" title="Conteos" description="El operador registra lo observado; el administrador aprueba si el saldo no cambió desde entonces." />
    <section className="mb-8 rounded-lg border border-hairline bg-surface p-4">
      <h2 className="mb-3 text-lg font-semibold">Registrar observación</h2>
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-2" noValidate>
        {isAdmin ? <Select label="Sucursal" placeholder="Elegí una sucursal" value={branchId} onChange={(e) => { setBranchId(e.target.value); setProductId('') }}
          options={(branches.data ?? []).filter((b) => b.is_active).map((b) => ({ value: b.id, label: b.name }))} />
          : <p className="text-sm">Sucursal: <strong>{branches.data?.find((b) => b.id === branchId)?.name ?? 'Asignada'}</strong></p>}
        <Select label="Producto" placeholder="Elegí un producto" value={productId} onChange={(e) => setProductId(e.target.value)}
          options={(inventory.data ?? []).map((r) => ({ value: r.product_id as string, label: `${r.sku} · ${r.product_name}` }))} />
        <Input label={`Cantidad observada (${selected?.unit ?? 'unidad'})`} value={observed} onChange={(e) => setObserved(e.target.value)} inputMode="decimal" />
        <Input label="Nota (opcional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        {selected && <p className="text-sm text-muted">Saldo al abrir el formulario: {formatQuantity(Number(selected.balance), selected.unit as 'unit' | 'ml' | 'g')}. La base guardará el saldo vigente al enviar.</p>}
        {error && !review && <p role="alert" className="text-sm text-carmine-fg">{error}</p>}
        <div className="md:col-span-2"><Button type="submit" disabled={mutation.isPending || !selected || !parsed.ok}>Enviar conteo</Button></div>
      </form>
    </section>
    <section><div className="mb-3 max-w-xs"><Select label="Estado" value={status} onChange={(e) => setStatus(e.target.value)}
      options={[{ value: 'pending', label: 'Pendientes' }, { value: 'approved', label: 'Aprobados' }, { value: 'rejected', label: 'Rechazados' }, { value: 'all', label: 'Todos' }]} /></div>
      {counts.isPending && <LoadingState />}
      {counts.isError && <ErrorState message={messageFor(counts.error)} onRetry={() => void counts.refetch()} />}
      {counts.data?.length === 0 && <EmptyState title="No hay conteos para este estado" />}
      <ul className="grid gap-3">{counts.data?.map((row) => <li key={row.id} className="rounded-lg border border-hairline bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div>
          <p className="label-caps text-muted">{row.branch_name} · {new Date(row.submitted_at).toLocaleString('es-UY')} · {row.status}</p>
          <h3 className="font-semibold">{row.product_name} <span className="text-muted">{row.sku}</span></h3>
          <p className="text-sm">Saldo base {formatQuantity(Number(row.base_balance), row.unit)} → observado <strong>{formatQuantity(Number(row.observed_qty), row.unit)}</strong></p>
          {row.note && <p className="text-sm text-muted">{row.note}</p>}
        </div>{isAdmin && row.status === 'pending' && <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { setReview({ row, kind: 'reject' }); setReason(''); setError(null) }}>Rechazar</Button>
          <Button onClick={() => { setReview({ row, kind: 'approve' }); setError(null) }}>Aprobar</Button>
        </div>}</div>
      </li>)}</ul>
    </section>
    {review && <Dialog open onClose={() => setReview(null)} title={review.kind === 'approve' ? 'Aprobar conteo' : 'Rechazar conteo'}>
      <form onSubmit={reviewCount} className="flex flex-col gap-4">
        <p className="text-sm">{review.row.product_name} · {review.row.branch_name}: {formatQuantity(Number(review.row.base_balance), review.row.unit)} → {formatQuantity(Number(review.row.observed_qty), review.row.unit)}</p>
        {review.kind === 'approve' ? <p className="text-sm">La base rechazará la aprobación si hubo movimientos desde la observación.</p>
          : <Input label="Motivo del rechazo" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} autoFocus />}
        {error && <p role="alert" className="text-sm text-carmine-fg">{error}</p>}
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setReview(null)}>Cancelar</Button>
          <Button type="submit" disabled={mutation.isPending}>Confirmar</Button></div>
      </form>
    </Dialog>}
  </>
}
