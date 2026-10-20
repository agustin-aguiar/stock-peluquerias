import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { messageFor } from '@/lib/errors'
import { AUDIT_PAGE_SIZE, useAuditEvents, type AuditEvent, type AuditLookups } from './api'
import { describeAuditEvent } from './describeEvent'
import { formatDate } from '@/lib/dates'

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function groupByDay(rows: AuditEvent[]): [string, AuditEvent[]][] {
  const groups = new Map<string, AuditEvent[]>()
  for (const row of rows) {
    const day = formatDate(row.created_at)
    groups.set(day, [...(groups.get(day) ?? []), row])
  }
  return [...groups]
}

const entities = [
  { value: '', label: 'Todos' },
  { value: 'inventory', label: 'Inventario' },
  { value: 'product', label: 'Productos' },
  { value: 'branch', label: 'Sucursales' },
  { value: 'profile', label: 'Usuarios' },
  { value: 'transfer', label: 'Transferencias' },
  { value: 'stock_request', label: 'Pedidos de stock' },
  { value: 'physical_count', label: 'Conteos' },
  { value: 'import_batch', label: 'Importaciones' },
]

function AuditItem({ event, lookups }: { event: AuditEvent; lookups: AuditLookups }) {
  const description = describeAuditEvent(event, lookups)
  const actor = event.actor_profile_id
    ? lookups.actors[event.actor_profile_id] ?? 'Usuario no disponible'
    : 'Sistema'

  return <li className="grid grid-cols-[3.25rem_1fr] gap-x-3 px-4 py-3 text-sm">
    <time className="pt-px text-muted tnum" dateTime={event.created_at}>{formatTime(event.created_at)}</time>
    <div className="min-w-0">
      <p><span className="font-semibold">{actor}</span> <span className="text-muted">·</span> {description.summary}</p>
      {description.changes.length > 0 && <details className="mt-1">
      <summary className="cursor-pointer text-xs text-muted underline-offset-2 hover:underline">Ver qué cambió</summary>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {description.changes.map((change) => <li key={change}>{change}</li>)}
      </ul>
      </details>}
    </div>
  </li>
}

export function AuditoriaPage() {
  const [type, setType] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(0)
  const events = useAuditEvents(type, from, to, page)

  return <>
    <PageHeader eyebrow="Control" title="Historial de cambios" description="Consultá quién hizo cada cambio y qué ocurrió con el stock, los pedidos, los usuarios y los locales." />
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
      <div className="flex flex-col gap-5">
        {groupByDay(events.data.rows).map(([day, rows]) => <section key={day}>
          <h2 className="label-caps mb-2 text-muted">{day}</h2>
          <ul className="divide-y divide-hairline rounded-lg border border-hairline bg-surface">
            {rows.map((event) => <AuditItem key={event.id} event={event} lookups={events.data.lookups} />)}
          </ul>
        </section>)}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted">
        <span>{page * AUDIT_PAGE_SIZE + 1}–{Math.min((page + 1) * AUDIT_PAGE_SIZE, events.data.count)} de {events.data.count}</span>
        <div className="flex gap-2"><Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
          <Button variant="secondary" disabled={(page + 1) * AUDIT_PAGE_SIZE >= events.data.count} onClick={() => setPage(page + 1)}>Siguiente</Button></div>
      </div>
    </>}
  </>
}
