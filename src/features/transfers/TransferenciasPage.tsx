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
import { useProducts } from '@/features/products/api'
import { messageFor } from '@/lib/errors'
import { formatQuantity, parseQuantity } from '@/lib/quantity'
import { useTransferAction, useTransfers, type TransferView } from './api'

const STATUS: Record<string, string> = {
  draft: 'Borrador', dispatched: 'En tránsito', disputed: 'Con diferencia',
  received: 'Recibida', resolved: 'Resuelta', cancelled: 'Cancelada',
}
type ActionKind = 'cancel' | 'dispatch' | 'receive' | 'dispute' | 'resolve'

export function TransferenciasPage() {
  const me = useCurrentProfile()
  const isAdmin = me.role === 'admin'
  const toast = useToast()
  const [status, setStatus] = useState('all')
  const transfers = useTransfers(status)
  const branches = useBranches()
  const products = useProducts({ search: '', includeInactive: false })
  const mutation = useTransferAction()
  const [creating, setCreating] = useState(false)
  const [transferId, setTransferId] = useState(() => crypto.randomUUID())
  const [productId, setProductId] = useState('')
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [qtyText, setQtyText] = useState('')
  const [shippingRef, setShippingRef] = useState('')
  const [selected, setSelected] = useState<TransferView | null>(null)
  const [action, setAction] = useState<ActionKind>('dispatch')
  const [actionKey, setActionKey] = useState(() => crypto.randomUUID())
  const [note, setNote] = useState('')
  const [received, setReceived] = useState('')
  const [returned, setReturned] = useState('0')
  const [lost, setLost] = useState('0')
  const [error, setError] = useState<string | null>(null)
  const activeBranches = (branches.data ?? []).filter((b) => b.is_active)
  const product = products.data?.find((p) => p.id === productId)
  const parsedQty = parseQuantity(qtyText, product?.unit ?? 'unit')

  function openCreate() {
    setTransferId(crypto.randomUUID())
    setProductId('')
    setFromId('')
    setToId('')
    setQtyText('')
    setShippingRef('')
    setError(null)
    setCreating(true)
  }

  async function create(e: FormEvent) {
    e.preventDefault()
    if (!parsedQty.ok || parsedQty.value <= 0 || !productId || !fromId || !toId || fromId === toId) {
      setError('Elegí producto, dos sucursales diferentes y una cantidad positiva.')
      return
    }
    try {
      await mutation.mutateAsync({ kind: 'create', id: transferId, productId, fromBranchId: fromId,
        toBranchId: toId, qty: parsedQty.value, shippingRef: shippingRef.trim() || null })
      toast.push({ kind: 'success', text: 'Borrador de transferencia creado.' })
      setCreating(false)
    } catch (err) { setError(messageFor(err)) }
  }

  function openAction(row: TransferView, kind: ActionKind) {
    setSelected(row)
    setAction(kind)
    setActionKey(crypto.randomUUID())
    setNote('')
    setReceived(String(row.qty))
    setReturned('0')
    setLost('0')
    setError(null)
  }

  async function submitAction(e: FormEvent) {
    e.preventDefault()
    if (!selected) return
    const unit = selected.product?.unit ?? 'unit'
    const r = parseQuantity(received, unit)
    const d = parseQuantity(returned, unit)
    const l = parseQuantity(lost, unit)
    if ((action === 'dispute' || action === 'resolve') && !note.trim()) return setError('Ingresá una explicación.')
    if (action === 'resolve' && (!r.ok || !d.ok || !l.ok || r.value + d.value + l.value !== Number(selected.qty))) {
      return setError('Recibido + devuelto + merma debe ser igual a lo despachado.')
    }
    try {
      if (action === 'cancel') await mutation.mutateAsync({ kind: 'cancel', transferId: selected.id })
      if (action === 'dispatch') await mutation.mutateAsync({ kind: 'dispatch', key: actionKey, transferId: selected.id })
      if (action === 'receive') await mutation.mutateAsync({ kind: 'receive', key: actionKey, transferId: selected.id })
      if (action === 'dispute') await mutation.mutateAsync({ kind: 'dispute', transferId: selected.id, note: note.trim() })
      if (action === 'resolve' && r.ok && d.ok && l.ok) await mutation.mutateAsync({ kind: 'resolve', key: actionKey,
        transferId: selected.id, received: r.value, returned: d.value, lost: l.value, note: note.trim() })
      toast.push({ kind: 'success', text: 'Transferencia actualizada.' })
      setSelected(null)
    } catch (err) { setError(messageFor(err)) }
  }

  return <>
    <PageHeader eyebrow="Entre locales" title="Transferencias" description="El despacho descuenta el origen; la recepción acredita el destino. Lo pendiente permanece en tránsito."
      actions={isAdmin && <Button onClick={openCreate}>Nueva transferencia</Button>} />
    <div className="mb-4 max-w-xs"><Select label="Estado" value={status} onChange={(e) => setStatus(e.target.value)}
      options={[{ value: 'all', label: 'Todas' }, ...Object.entries(STATUS).map(([value, label]) => ({ value, label }))]} /></div>
    {transfers.isPending && <LoadingState />}
    {transfers.isError && <ErrorState message={messageFor(transfers.error)} onRetry={() => void transfers.refetch()} />}
    {transfers.data?.length === 0 && <EmptyState title="No hay transferencias" description="Probá otro estado o creá un borrador." />}
    <ul className="grid gap-3">{transfers.data?.map((row) => {
      const canReceive = isAdmin || me.branch_id === row.to_branch_id
      const unit = row.product?.unit ?? 'unit'
      return <li key={row.id} className="rounded-lg border border-hairline bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="label-caps text-muted">{STATUS[row.status]} · {new Date(row.created_at).toLocaleString('es-UY')}</p>
            <h2 className="font-semibold">{row.product?.name ?? 'Producto'} <span className="text-muted">{row.product?.sku}</span></h2>
            <p className="text-sm">{row.origin?.name} → {row.destination?.name} · <strong>{formatQuantity(Number(row.qty), unit)}</strong></p>
            {row.shipping_ref && <p className="text-sm text-muted">Referencia: {row.shipping_ref}</p>}
            {row.dispute_note && <p className="text-sm text-amber-fg">Diferencia: {row.dispute_note}</p>}
            {row.status === 'resolved' && <p className="text-sm">Recibido {formatQuantity(Number(row.resolved_qty_received), unit)} · devuelto {formatQuantity(Number(row.resolved_qty_returned), unit)} · merma {formatQuantity(Number(row.resolved_qty_lost), unit)}</p>}
            <p className="font-mono text-xs text-muted" title={row.id}>N.º {row.id}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {row.status === 'draft' && isAdmin && <><Button variant="secondary" onClick={() => openAction(row, 'cancel')}>Cancelar</Button><Button onClick={() => openAction(row, 'dispatch')}>Despachar</Button></>}
            {row.status === 'dispatched' && canReceive && <><Button variant="secondary" onClick={() => openAction(row, 'dispute')}>Reportar diferencia</Button><Button onClick={() => openAction(row, 'receive')}>Recibir completo</Button></>}
            {row.status === 'disputed' && isAdmin && <Button onClick={() => openAction(row, 'resolve')}>Resolver diferencia</Button>}
          </div>
        </div>
      </li>
    })}</ul>
    {creating && <Dialog open onClose={() => setCreating(false)} title="Nueva transferencia">
      <form onSubmit={create} className="flex flex-col gap-4" noValidate>
        <Select label="Producto" placeholder="Elegí un producto" value={productId} onChange={(e) => setProductId(e.target.value)}
          options={(products.data ?? []).map((p) => ({ value: p.id, label: `${p.sku} · ${p.name}` }))} />
        <Select label="Origen" placeholder="Elegí una sucursal" value={fromId} onChange={(e) => setFromId(e.target.value)}
          options={activeBranches.map((b) => ({ value: b.id, label: b.name }))} />
        <Select label="Destino" placeholder="Elegí una sucursal" value={toId} onChange={(e) => setToId(e.target.value)}
          options={activeBranches.map((b) => ({ value: b.id, label: b.name }))} />
        <Input label={`Cantidad (${product?.unit ?? 'unidad'})`} value={qtyText} onChange={(e) => setQtyText(e.target.value)} inputMode="decimal" />
        <Input label="Referencia de envío (opcional)" value={shippingRef} onChange={(e) => setShippingRef(e.target.value)} maxLength={120} />
        <p className="text-sm text-muted">El borrador no reserva stock. El saldo se comprueba al despachar.</p>
        {error && <p role="alert" className="text-sm text-carmine-fg">{error}</p>}
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setCreating(false)}>Cancelar</Button>
          <Button type="submit" disabled={mutation.isPending}>Crear borrador</Button></div>
      </form>
    </Dialog>}
    {selected && <Dialog open onClose={() => setSelected(null)} title={`${STATUS[selected.status]} · ${selected.product?.name ?? 'Transferencia'}`}>
      <form onSubmit={submitAction} className="flex flex-col gap-4" noValidate>
        <p className="text-sm">{selected.origin?.name} → {selected.destination?.name} · {formatQuantity(Number(selected.qty), selected.product?.unit ?? 'unit')}</p>
        {action === 'dispatch' && <p className="text-sm">Se descontará del origen y quedará en tránsito hasta la recepción.</p>}
        {action === 'receive' && <p className="text-sm">Confirmás que llegó la cantidad completa. Si hay diferencia, reportala antes.</p>}
        {action === 'cancel' && <p className="text-sm">Se cancelará el borrador sin cambiar ningún saldo.</p>}
        {action === 'resolve' && <><p className="text-sm">La devolución al origen debe haberse confirmado físicamente antes de acreditarla.</p>
          <Input label="Cantidad recibida" value={received} onChange={(e) => setReceived(e.target.value)} inputMode="decimal" />
          <Input label="Cantidad devuelta" value={returned} onChange={(e) => setReturned(e.target.value)} inputMode="decimal" />
          <Input label="Merma" value={lost} onChange={(e) => setLost(e.target.value)} inputMode="decimal" /></>}
        {(action === 'dispute' || action === 'resolve') && <Input label="Explicación (obligatoria)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />}
        {error && <p role="alert" className="text-sm text-carmine-fg">{error}</p>}
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setSelected(null)} disabled={mutation.isPending}>Volver</Button>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Guardando…' : 'Confirmar'}</Button></div>
      </form>
    </Dialog>}
  </>
}
