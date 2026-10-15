import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useCurrentProfile } from '@/app/guards'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useBranches } from '@/features/branches/api'
import { useProducts, useProductAvailability } from '@/features/products/api'
import { messageFor } from '@/lib/errors'
import { formatQuantity, parseQuantity, UNIT_NAME } from '@/lib/quantity'
import type { UnitKind } from '@/types/models'
import { useRequestTransferStatuses, useStockRequestAction, useStockRequests, type StockRequest } from './api'

type Choice = { row: StockRequest; kind: 'forward' | 'reject' | 'accept' | 'decline' }

export function SolicitudesPage() {
  const me = useCurrentProfile()
  const admin = me.role === 'admin'
  const toast = useToast()
  const requests = useStockRequests()
  const branches = useBranches()
  const products = useProducts({ search: '', includeInactive: false })
  const transferIds = (requests.data ?? []).flatMap((r) => r.transfer_id ? [r.transfer_id] : [])
  const transfers = useRequestTransferStatuses(transferIds)
  const action = useStockRequestAction()
  const [creating, setCreating] = useState(false)
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())
  const [productId, setProductId] = useState('')
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [choice, setChoice] = useState<Choice | null>(null)
  const [sourceId, setSourceId] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const availability = useProductAvailability(choice?.row.product_id)
  const product = products.data?.find((p) => p.id === productId)
  const parsed = parseQuantity(qty, product?.unit ?? 'unit')
  const productById = new Map(products.data?.map((p) => [p.id, p]) ?? [])
  const branchById = new Map(branches.data?.map((b) => [b.id, b]) ?? [])
  const transferById = new Map(transfers.data?.map((t) => [t.id, t]) ?? [])
  const pending = (requests.data ?? []).filter((r) => admin ? r.status === 'pending_admin' : r.status === 'pending_source' && r.source_branch_id === me.branch_id)
  const history = (requests.data ?? []).filter((r) => !pending.includes(r))

  function startRequest() {
    setRequestId(crypto.randomUUID())
    setProductId('')
    setQty('')
    setNote('')
    setError(null)
    setCreating(true)
  }

  async function submitRequest(e: FormEvent) {
    e.preventDefault()
    if (!product || !parsed.ok || parsed.value <= 0) return setError('Elegí un producto y una cantidad mayor que cero.')
    try {
      await action.mutateAsync({ kind: 'request', id: requestId, productId, qty: parsed.value, note: note.trim() || null })
      toast.push({ kind: 'success', text: 'Pedido enviado al administrador.' })
      setCreating(false)
    } catch (err) { setError(messageFor(err)) }
  }

  function openChoice(row: StockRequest, kind: Choice['kind']) {
    setChoice({ row, kind })
    setSourceId('')
    setReason('')
    setError(null)
  }

  async function submitChoice(e: FormEvent) {
    e.preventDefault()
    if (!choice) return
    if (choice.kind === 'forward' && !sourceId) return setError('Elegí el local que enviará el producto.')
    if ((choice.kind === 'reject' || choice.kind === 'decline') && !reason.trim()) return setError('Contá por qué no se puede atender el pedido.')
    try {
      if (choice.kind === 'forward' || choice.kind === 'reject') {
        await action.mutateAsync({ kind: 'review', id: choice.row.id,
          sourceBranchId: choice.kind === 'forward' ? sourceId : null, reason: reason.trim() || null })
      } else {
        await action.mutateAsync({ kind: 'decide', id: choice.row.id,
          accept: choice.kind === 'accept', reason: reason.trim() || null })
      }
      toast.push({ kind: 'success', text: choice.kind === 'forward' ? 'Pedido enviado al local elegido.'
        : choice.kind === 'accept' ? 'Envío registrado. El local solicitante ya puede confirmar la recepción.'
          : 'Respuesta registrada.' })
      setChoice(null)
    } catch (err) { setError(messageFor(err)) }
  }

  function label(row: StockRequest) {
    if (row.status === 'pending_admin') return 'Esperando al administrador'
    if (row.status === 'pending_source') return 'Esperando al local que envía'
    if (row.status === 'rejected') return 'Rechazado por el administrador'
    if (row.status === 'declined') return 'El local elegido no pudo enviarlo'
    const transfer = row.transfer_id ? transferById.get(row.transfer_id) : undefined
    if (transfer?.status === 'received') return 'Recibido'
    if (transfer?.status === 'resolved') return 'Diferencia resuelta'
    if (transfer?.status === 'disputed') return 'Con diferencia informada'
    return 'En camino al local solicitante'
  }

  function card(row: StockRequest) {
    const p = productById.get(row.product_id)
    const unit: UnitKind = p?.unit ?? 'unit'
    return <li key={row.id} className="rounded-lg border border-hairline bg-surface p-4">
      <p className="text-xs text-muted">{new Date(row.requested_at).toLocaleString('es-UY')} · {label(row)}</p>
      <h3 className="mt-1 font-semibold">{p?.name ?? 'Producto'} · {formatQuantity(Number(row.qty), unit)}</h3>
      <p className="text-sm">Lo pide: {branchById.get(row.branch_id)?.name ?? 'Sucursal'}</p>
      {row.source_branch_id && <p className="text-sm">Lo envía: {branchById.get(row.source_branch_id)?.name ?? 'Sucursal'}</p>}
      {row.note && <p className="mt-1 text-sm text-muted">Nota del pedido: {row.note}</p>}
      {row.decision_note && <p className="mt-1 text-sm text-muted">Respuesta: {row.decision_note}</p>}
      {row.transfer_id && <Link to="/transferencias" className="mt-2 inline-block text-sm font-semibold underline">Ver envío y recepción</Link>}
      <div className="mt-3 flex flex-wrap gap-2">
        {admin && row.status === 'pending_admin' && <>
          <Button onClick={() => openChoice(row, 'forward')}>Elegir local que envía</Button>
          <Button variant="secondary" onClick={() => openChoice(row, 'reject')}>Rechazar</Button>
        </>}
        {!admin && row.status === 'pending_source' && row.source_branch_id === me.branch_id && <>
          <Button onClick={() => openChoice(row, 'accept')}>Aceptar y enviar</Button>
          <Button variant="secondary" onClick={() => openChoice(row, 'decline')}>No puedo enviar</Button>
        </>}
      </div>
    </li>
  }

  const sourceOptions = (availability.data ?? []).filter((r) => r.branch_id !== choice?.row.branch_id &&
    r.branch_active && r.initialized_at).map((r) => ({
      value: r.branch_id as string,
      label: `${r.branch_name}: ${formatQuantity(Number(r.balance), (r.unit ?? 'unit') as UnitKind)} disponibles`,
      disabled: Number(r.balance) < Number(choice?.row.qty ?? 0),
    }))

  return <>
    <PageHeader eyebrow="Entre locales" title="Pedidos de stock"
      description={admin ? 'Revisá los pedidos de los locales y elegí desde dónde se puede enviar cada producto.'
        : 'Pedí productos para tu local y respondé cuando otro local necesite que le envíes stock.'}
      actions={!admin && <Button onClick={startRequest}>Pedir stock</Button>} />
    <p className="mb-5 text-sm text-muted">El stock se descuenta del local que envía cuando acepta. El local que pidió debe confirmar la recepción en Envíos entre locales.</p>
    {requests.isPending && <LoadingState />}
    {requests.isError && <ErrorState message={messageFor(requests.error)} onRetry={() => void requests.refetch()} />}
    {requests.data && <>
      <section><h2 className="mb-3 text-lg font-semibold">Para responder ({pending.length})</h2>
        {pending.length ? <ul className="grid gap-3">{pending.map(card)}</ul>
          : <EmptyState title="No hay pedidos esperando tu respuesta" />}</section>
      <section className="mt-8"><h2 className="mb-3 text-lg font-semibold">Otros pedidos</h2>
        {history.length ? <ul className="grid gap-3">{history.map(card)}</ul>
          : <p className="text-sm text-muted">Todavía no hay otros pedidos.</p>}</section>
    </>}
    {creating && <Dialog open onClose={() => setCreating(false)} title="Pedir stock para mi local">
      <form onSubmit={submitRequest} className="flex flex-col gap-4" noValidate>
        <Select label="Producto" placeholder="Elegí un producto" value={productId} onChange={(e) => setProductId(e.target.value)}
          options={(products.data ?? []).map((p) => ({ value: p.id, label: p.name }))} />
        <Input label={`Cantidad que necesitás (${product ? UNIT_NAME[product.unit] : 'unidades'})`}
          value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" />
        <Input label="Comentario para el administrador (opcional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        <p className="text-sm text-muted">Para recibir un traslado, el producto ya debe tener una primera carga en tu local. Si falta, pedile al administrador que la registre.</p>
        {error && <p role="alert" className="text-sm text-carmine-fg">{error}</p>}
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setCreating(false)}>Volver</Button>
          <Button type="submit" disabled={action.isPending}>Enviar pedido</Button></div>
      </form>
    </Dialog>}
    {choice && <Dialog open onClose={() => setChoice(null)} title={choice.kind === 'forward' ? 'Elegir local que envía'
      : choice.kind === 'accept' ? 'Aceptar y enviar producto' : 'Responder al pedido'}>
      <form onSubmit={submitChoice} className="flex flex-col gap-4" noValidate>
        <p className="text-sm">{productById.get(choice.row.product_id)?.name ?? 'Producto'} · {formatQuantity(Number(choice.row.qty), productById.get(choice.row.product_id)?.unit ?? 'unit')} para {branchById.get(choice.row.branch_id)?.name ?? 'el local solicitante'}</p>
        {choice.kind === 'forward' && <>
          <p className="text-sm text-muted">Se muestra cuánto hay hoy en cada local. El saldo se volverá a comprobar cuando el local acepte.</p>
          <Select label="Local que puede enviar" placeholder="Elegí un local" value={sourceId} onChange={(e) => setSourceId(e.target.value)}
            options={sourceOptions} />
          {availability.isPending && <p className="text-sm">Consultando existencias…</p>}
          {!availability.isPending && sourceOptions.length === 0 && <p className="text-sm text-amber-fg">Ningún otro local tiene este producto disponible. Podés cargar stock o rechazar el pedido.</p>}
        </>}
        {choice.kind === 'accept' && <p className="text-sm text-muted">Al aceptar se descontará la cantidad de tu local y quedará en camino hasta que el destino confirme la recepción.</p>}
        {choice.kind !== 'forward' && <Input label={choice.kind === 'accept' ? 'Comentario (opcional)' : 'Motivo (obligatorio)'}
          value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />}
        {error && <p role="alert" className="text-sm text-carmine-fg">{error}</p>}
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setChoice(null)}>Volver</Button>
          <Button type="submit" disabled={action.isPending || (choice.kind === 'forward' && !sourceId)}>
            {choice.kind === 'forward' ? 'Enviar al local' : choice.kind === 'accept' ? 'Confirmar envío' : 'Confirmar respuesta'}
          </Button></div>
      </form>
    </Dialog>}
  </>
}
