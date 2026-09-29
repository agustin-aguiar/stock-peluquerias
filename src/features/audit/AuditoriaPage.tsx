import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { messageFor } from '@/lib/errors'
import type { Json } from '@/types/database'
import { AUDIT_PAGE_SIZE, useAuditEvents } from './api'

const entities = [
  { value: '', label: 'Todos' },
  { value: 'inventory', label: 'Inventario' },
  { value: 'product', label: 'Productos' },
  { value: 'branch', label: 'Sucursales' },
  { value: 'profile', label: 'Usuarios' },
  { value: 'transfer', label: 'Transferencias' },
  { value: 'physical_count', label: 'Conteos' },
  { value: 'import_batch', label: 'Importaciones' },
]

const actions: Record<string, string> = {
  'branch.create': 'Sucursal creada', 'branch.update': 'Sucursal editada',
  'product.create': 'Producto creado', 'product.update': 'Producto editado',
  'profile.create': 'Usuario creado', 'profile.update': 'Usuario editado',
  'inventory.enable': 'Producto habilitado', 'inventory.set_min': 'Mínimo cambiado',
  'inventory.initial_balance': 'Saldo inicial', 'inventory.purchase': 'Ingreso',
  'inventory.consumption': 'Consumo', 'inventory.sale': 'Venta',
  'inventory.shrinkage': 'Merma', 'inventory.adjustment': 'Ajuste',
  'inventory.reversal': 'Reversión',
  'transfer.create': 'Transferencia creada', 'transfer.cancel': 'Transferencia cancelada',
  'transfer.dispatch': 'Transferencia despachada', 'transfer.receive': 'Transferencia recibida',
  'transfer.dispute': 'Diferencia informada', 'transfer.resolve': 'Diferencia resuelta',
  'count.submit': 'Conteo presentado', 'count.approve': 'Conteo aprobado',
  'count.reject': 'Conteo rechazado', 'import.catalog': 'Catálogo importado',
  'import.initial_stock': 'Saldo inicial importado',
}

function changedFields(before: Json | null, after: Json | null) {
  if (!after || typeof after !== 'object' || Array.isArray(after)) return []
  if (!before || typeof before !== 'object' || Array.isArray(before)) return []
  return Object.keys(after).filter((key) => JSON.stringify(after[key]) !== JSON.stringify(before[key]))
}

export function AuditoriaPage() {
  const [type, setType] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(0)
  const events = useAuditEvents(type, from, to, page)

  return <>
    <PageHeader eyebrow="Control" title="Auditoría" description="Cambios registrados en usuarios, productos, sucursales y stock." />
    <div className="mb-5 grid gap-3 md:grid-cols-3">
      <Select label="Área" value={type} onChange={(e) => { setType(e.target.value); setPage(0) }} options={entities} />
      <Input label="Desde" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0) }} />
      <Input label="Hasta" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0) }} />
    </div>
    {from && to && from > to && <p role="alert" className="text-sm text-carmine-fg">La fecha inicial debe ser anterior a la final.</p>}
    {events.isPending && (!from || !to || from <= to) && <LoadingState />}
    {events.isError && <ErrorState message={messageFor(events.error)} onRetry={() => void events.refetch()} />}
    {events.data?.rows.length === 0 && <EmptyState title="Sin cambios para estos filtros" />}
    {events.data && events.data.rows.length > 0 && <>
      <div className="overflow-x-auto"><table className="w-full min-w-[42rem] border-collapse text-sm">
        <thead><tr className="label-caps text-left text-muted"><th className="py-2">Fecha</th><th>Acción</th><th>Realizada por</th><th>Detalle</th></tr></thead>
        <tbody>{events.data.rows.map((event) => <tr key={event.id} className="border-t border-hairline align-top">
          <td className="py-3 pr-4 whitespace-nowrap">{new Date(event.created_at).toLocaleString('es-UY')}</td>
          <td className="py-3 pr-4 font-semibold">{actions[event.action] ?? event.action}</td>
          <td className="py-3 pr-4">{events.data.actors[event.actor_profile_id ?? ''] ?? 'Cuenta anterior'}</td>
          <td className="py-3"><details><summary className="cursor-pointer underline">Ver cambio</summary>
            <p className="mt-2 text-xs text-muted">{event.entity_type} · {event.entity_id ?? 'sin identificador'}</p>
            {changedFields(event.old_values, event.new_values).length > 0 && <p className="mt-1 text-xs">Campos: {changedFields(event.old_values, event.new_values).join(', ')}</p>}
            <pre className="mt-2 max-h-48 overflow-auto rounded-control bg-canvas p-2 text-xs">{JSON.stringify({ antes: event.old_values, despues: event.new_values }, null, 2)}</pre>
          </details></td>
        </tr>)}</tbody>
      </table></div>
      <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted">
        <span>{page * AUDIT_PAGE_SIZE + 1}–{Math.min((page + 1) * AUDIT_PAGE_SIZE, events.data.count)} de {events.data.count}</span>
        <div className="flex gap-2"><Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
          <Button variant="secondary" disabled={(page + 1) * AUDIT_PAGE_SIZE >= events.data.count} onClick={() => setPage(page + 1)}>Siguiente</Button></div>
      </div>
    </>}
  </>
}
