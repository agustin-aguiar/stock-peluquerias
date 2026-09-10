import { Link, useNavigate } from 'react-router'
import { Package, Store, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { useActiveBranch } from '@/features/branches/activeBranch'
import { useBranches } from '@/features/branches/api'
import { messageFor } from '@/lib/errors'
import { useInventorySummary, useOpenAlertCount } from './api'

export function InicioAdminPage() {
  const navigate = useNavigate()
  const { setBranchId } = useActiveBranch()
  const branches = useBranches()
  const summary = useInventorySummary()
  const alerts = useOpenAlertCount()

  if (branches.isPending || summary.isPending || alerts.isPending) return <LoadingState />
  if (branches.isError) return <ErrorState message={messageFor(branches.error)} onRetry={() => void branches.refetch()} />
  if (summary.isError) return <ErrorState message={messageFor(summary.error)} onRetry={() => void summary.refetch()} />
  if (alerts.isError) return <ErrorState message={messageFor(alerts.error)} onRetry={() => void alerts.refetch()} />

  const active = (branches.data ?? []).filter((b) => b.is_active)

  return (
    <>
      <PageHeader eyebrow="Cadena" title="Inicio" description="Estado de cada sucursal y accesos rápidos." />
      {active.length === 0 && (
        <EmptyState title="No hay sucursales activas" action={<Link to="/sucursales"><Button>Crear sucursal</Button></Link>} />
      )}
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {active.map((b) => {
          const s = summary.data?.[b.id] ?? { enabled: 0, belowMin: 0, uninitialized: 0 }
          const open = alerts.data?.[b.id] ?? 0
          return (
            <li key={b.id} className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="label-caps text-muted">{b.code}</p>
                  <h2 className="text-lg font-semibold">{b.name}</h2>
                </div>
                {open > 0 ? <Chip tone="amber">{open} alertas</Chip> : <Chip tone="sage">Sin alertas</Chip>}
              </div>
              <dl className="grid grid-cols-3 gap-2 text-center tnum">
                <div>
                  <dt className="label-caps text-muted">Habilitados</dt>
                  <dd className="text-2xl font-bold">{s.enabled}</dd>
                </div>
                <div>
                  <dt className="label-caps text-muted">Bajo mínimo</dt>
                  <dd className={`text-2xl font-bold ${s.belowMin > 0 ? 'text-amber-fg' : ''}`}>{s.belowMin}</dd>
                </div>
                <div>
                  <dt className="label-caps text-muted">Sin saldo inicial</dt>
                  <dd className="text-2xl font-bold">{s.uninitialized}</dd>
                </div>
              </dl>
              <Button
                variant="secondary"
                onClick={() => {
                  setBranchId(b.id)
                  navigate('/inventario')
                }}
              >
                Ver inventario
              </Button>
            </li>
          )
        })}
      </ul>
      <section className="mt-8">
        <h2 className="label-caps mb-3 text-muted">Accesos rápidos</h2>
        <div className="flex flex-wrap gap-2">
          <Link to="/catalogo"><Button variant="secondary"><Package size={16} aria-hidden /> Catálogo</Button></Link>
          <Link to="/sucursales"><Button variant="secondary"><Store size={16} aria-hidden /> Sucursales</Button></Link>
          <Link to="/usuarios"><Button variant="secondary"><Users size={16} aria-hidden /> Usuarios</Button></Link>
          <Button
            variant="secondary"
            onClick={() => {
              setBranchId('all')
              navigate('/inventario')
            }}
          >
            Comparar locales
          </Button>
        </div>
      </section>
    </>
  )
}
