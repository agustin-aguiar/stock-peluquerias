import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Search } from 'lucide-react'
import { useCurrentProfile } from '@/app/guards'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { useActiveBranch } from '@/features/branches/activeBranch'
import { useBranches } from '@/features/branches/api'
import { messageFor } from '@/lib/errors'
import { formatQuantity, UNIT_LABEL } from '@/lib/quantity'
import type { InventoryStatus, UnitKind } from '@/types/models'
import { COMPARE_LIMIT, PAGE_SIZE, useInventory } from './api'
import { groupByProduct } from './group'
import { StatusChip } from './StatusChip'
import { QuickStockDialog } from './QuickStockDialog'

function Cell({ row, unit, onAssign }: { row: InventoryStatus | undefined; unit: UnitKind; onAssign?: () => void }) {
  return (
    <span className="flex flex-col items-end gap-1">
      <span className="font-semibold tnum">{row ? formatQuantity(Number(row.balance ?? 0), unit) : '—'}</span>
      {row && (!row.initialized_at || row.below_min) && <StatusChip row={row} />}
      {onAssign && <button type="button" className="text-xs underline" onClick={onAssign}>Asignar</button>}
    </span>
  )
}

export function InventarioPage() {
  const profile = useCurrentProfile()
  const isAdmin = profile.role === 'admin'
  const { branchId } = useActiveBranch()
  const branches = useBranches()
  const [search, setSearch] = useState('')
  const [onlyBelowMin, setOnlyBelowMin] = useState(false)
  const [page, setPage] = useState(0)
  const [assignment, setAssignment] = useState<{ branchId?: string; productId?: string } | null>(null)
  useEffect(() => setPage(0), [branchId, search, onlyBelowMin])
  const inventory = useInventory({ branchId, search, onlyBelowMin, page })

  const compare = branchId === 'all'
  const activeBranches = (branches.data ?? []).filter((b) => b.is_active)
  const branchName = branches.data?.find((b) => b.id === branchId)?.name

  const rows = inventory.data?.rows ?? []
  const count = inventory.data?.count ?? 0
  const from = page * PAGE_SIZE + 1
  const to = Math.min(count, (page + 1) * PAGE_SIZE)

  return (
    <>
      <PageHeader
        eyebrow={compare ? 'Comparación entre locales' : (branchName ?? 'Sucursal')}
        title="Inventario"
        description={compare ? 'Un mismo SKU en cada sucursal. No se suman unidades distintas.' : 'Saldo utilizable por producto.'}
        actions={isAdmin && <Button onClick={() => setAssignment({ branchId: branchId === 'all' ? undefined : branchId })}>Asignar stock</Button>}
      />
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div className="relative w-full max-w-sm">
          <Input label="Buscar" placeholder="Nombre o SKU" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          <Search size={16} className="pointer-events-none absolute bottom-3 left-3 text-muted" aria-hidden />
        </div>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyBelowMin} onChange={(e) => setOnlyBelowMin(e.target.checked)} />
          Solo bajo mínimo
        </label>
      </div>

      {inventory.isPending && <LoadingState />}
      {inventory.isError && <ErrorState message={messageFor(inventory.error)} onRetry={() => void inventory.refetch()} />}
      {inventory.data && rows.length === 0 && (
        <EmptyState
          title={search || onlyBelowMin ? 'Sin resultados' : 'No hay productos habilitados'}
          description={search || onlyBelowMin ? 'Probá quitando filtros.' : isAdmin ? 'Usá «Asignar stock» para cargar un producto en esta sucursal.' : 'El administrador carga productos para esta sucursal.'}
        />
      )}

      {inventory.data && rows.length > 0 && !compare && (
        <>
          <table className="hidden w-full border-collapse text-sm md:table">
            <thead>
              <tr className="label-caps text-left text-muted">
                <th className="py-2 pr-4">Producto</th>
                <th className="py-2 pr-4">SKU</th>
                <th className="py-2 pr-4">Unidad</th>
                <th className="py-2 pr-4 text-right">Saldo</th>
                <th className="py-2 pr-4 text-right">Mínimo</th>
                <th className="py-2">Estado</th>
                {isAdmin && <th className="py-2 text-right">Acción</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-hairline hover:bg-canvas">
                  <td className="py-3 pr-4">
                    <Link to={`/inventario/${r.product_id}`} className="font-semibold underline-offset-2 hover:underline">
                      {r.product_name}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 tnum">{r.sku}</td>
                  <td className="py-3 pr-4">{UNIT_LABEL[(r.unit ?? 'unit') as UnitKind]}</td>
                  <td className="py-3 pr-4 text-right font-semibold tnum">{formatQuantity(Number(r.balance ?? 0), (r.unit ?? 'unit') as UnitKind)}</td>
                  <td className="py-3 pr-4 text-right tnum">{formatQuantity(Number(r.min_qty ?? 0), (r.unit ?? 'unit') as UnitKind)}</td>
                  <td className="py-3">
                    <StatusChip row={r} />
                  </td>
                  {isAdmin && <td className="py-3 text-right"><Button variant="secondary" onClick={() => setAssignment({ branchId: r.branch_id ?? undefined, productId: r.product_id ?? undefined })}>Asignar stock</Button></td>}
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="flex flex-col gap-3 md:hidden">
            {rows.map((r) => (
              <li key={r.id} className="rounded-lg border border-hairline bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="label-caps text-muted tnum">{r.sku}</p>
                    <Link to={`/inventario/${r.product_id}`} className="font-semibold">
                      {r.product_name}
                    </Link>
                  </div>
                  <StatusChip row={r} />
                </div>
                <p className="mt-2 text-sm tnum">
                  <span className="font-semibold">{formatQuantity(Number(r.balance ?? 0), (r.unit ?? 'unit') as UnitKind)}</span>
                  <span className="text-muted"> · mínimo {formatQuantity(Number(r.min_qty ?? 0), (r.unit ?? 'unit') as UnitKind)}</span>
                </p>
                {isAdmin && <Button variant="secondary" className="mt-3 w-full" onClick={() => setAssignment({ branchId: r.branch_id ?? undefined, productId: r.product_id ?? undefined })}>Asignar stock</Button>}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between text-sm text-muted">
            <span className="tnum">
              Mostrando {from}–{to} de {count}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <Button variant="secondary" disabled={to >= count} onClick={() => setPage((p) => p + 1)}>
                Siguiente
              </Button>
            </div>
          </div>
        </>
      )}

      {inventory.data && rows.length > 0 && compare && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr className="label-caps text-left text-muted">
                <th className="py-2 pr-4">Producto</th>
                <th className="py-2 pr-4">Unidad</th>
                {activeBranches.map((b) => (
                  <th key={b.id} className="py-2 pr-4 text-right">
                    {b.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupByProduct(rows).map((g) => (
                <tr key={g.productId} className="border-t border-hairline hover:bg-canvas">
                  <td className="py-3 pr-4">
                    <Link to={`/inventario/${g.productId}`} className="font-semibold underline-offset-2 hover:underline">
                      {g.name}
                    </Link>
                    <span className="block text-xs text-muted tnum">{g.sku}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <Chip>{UNIT_LABEL[g.unit]}</Chip>
                  </td>
                  {activeBranches.map((b) => (
                    <td key={b.id} className="py-3 pr-4 text-right">
                      <Cell row={g.byBranch[b.id]} unit={g.unit}
                        onAssign={isAdmin ? () => setAssignment({ branchId: b.id, productId: g.productId }) : undefined} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length >= COMPARE_LIMIT && (
            <p className="mt-3 text-xs text-muted">Se muestran las primeras {COMPARE_LIMIT} filas. Refiná la búsqueda o elegí una sucursal.</p>
          )}
        </div>
      )}
      {assignment && <QuickStockDialog open onClose={() => setAssignment(null)} selection={assignment} />}
    </>
  )
}
