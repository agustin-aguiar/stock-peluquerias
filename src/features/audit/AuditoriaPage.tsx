import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { messageFor } from '@/lib/errors'
import { AUDIT_PAGE_SIZE, useAuditEvents, type AuditEvent, type AuditLookups } from './api'
import { describeAuditEvent } from './describeEvent'

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

function AuditItem({ event, lookups }: { event: AuditEvent; lookups: AuditLookups }) {
  const description = describeAuditEvent(event, lookups)
  const actor = event.actor_profile_id
    ? lookups.actors[event.actor_profile_id] ?? 'Usuario no disponible'
    : 'Sistema'

  return <li className="rounded-lg border border-hairline bg-surface p-4 text-sm">
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <p><span className="text-muted">Quién: </span><span className="font-semibold">{actor}</span></p>
      <time className="text-muted" dateTime={event.created_at}>{new Date(event.created_at).toLocaleString('es-UY')}</time>
    </div>
    <p className="mt-2"><span className="font-semibold">Qué hizo: </span>{description.summary}</p>
    {description.changes.length > 0 && <details className="mt-2">
      <summary className="cursor-pointer text-muted underline">Ver detalles</summary>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {description.changes.map((change) => <li key={change}>{change}</li>)}
      </ul>
    </details>}
  </li>
}

export function AuditoriaPage() {
  const [type, setType] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(0)
  const events = useAuditEvents(type, from, to, page)

  return <>
    <PageHeader eyebrow="Control" title="Auditoría" description="Consultá quién hizo cada cambio y qué ocurrió con el stock, los usuarios y las sucursales." />
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
      <ul className="space-y-3">{events.data.rows.map((event) => <AuditItem key={event.id} event={event} lookups={events.data.lookups} />)}</ul>
      <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted">
        <span>{page * AUDIT_PAGE_SIZE + 1}–{Math.min((page + 1) * AUDIT_PAGE_SIZE, events.data.count)} de {events.data.count}</span>
        <div className="flex gap-2"><Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
          <Button variant="secondary" disabled={(page + 1) * AUDIT_PAGE_SIZE >= events.data.count} onClick={() => setPage(page + 1)}>Siguiente</Button></div>
      </div>
    </>}
  </>
}
