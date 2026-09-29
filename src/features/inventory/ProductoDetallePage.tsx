import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useCurrentProfile } from '@/app/guards'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { useProduct, useProductAvailability } from '@/features/products/api'
import { messageFor } from '@/lib/errors'
import { formatQuantity, UNIT_NAME } from '@/lib/quantity'
import type { InventoryStatus } from '@/types/models'
import { SaldoInicialDialog } from './SaldoInicialDialog'
import { MovementDialog } from './MovementDialog'
import { MovementHistory } from './MovementHistory'
import { StatusChip } from './StatusChip'

export function ProductoDetallePage() {
  const { productId } = useParams<{ productId: string }>()
  const me = useCurrentProfile()
  const product = useProduct(productId)
  const availability = useProductAvailability(productId)
  const [initRow, setInitRow] = useState<InventoryStatus | null>(null)
  const [movementRow, setMovementRow] = useState<InventoryStatus | null>(null)

  if (product.isPending || availability.isPending) return <LoadingState />
  if (product.isError) return <ErrorState message={messageFor(product.error)} onRetry={() => void product.refetch()} />
  if (availability.isError) return <ErrorState message={messageFor(availability.error)} onRetry={() => void availability.refetch()} />
  if (!product.data) return <ErrorState message="El producto no existe o no pertenece a tu cadena." />

  const p = product.data
  const rows = availability.data ?? []

  return (
    <>
      <PageHeader
        eyebrow={`${p.sku} · ${UNIT_NAME[p.unit]}`}
        title={p.name}
        description={[p.brand, p.category, p.variant, p.presentation].filter(Boolean).join(' · ') || undefined}
        actions={
          <>
            <Link to="/inventario" className="text-sm underline">
              Volver al inventario
            </Link>
            {me.role === 'admin' && (
              <Link to={`/catalogo/${p.id}`} className="text-sm underline">
                Editar en catálogo
              </Link>
            )}
          </>
        }
      />
      {rows.length === 0 && (
        <EmptyState
          title="Este producto no está habilitado en tu sucursal"
          description={me.role === 'admin' ? 'Habilitalo desde el catálogo.' : undefined}
        />
      )}
      {rows.length > 0 && (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="label-caps text-muted">{r.branch_code}</p>
                <p className="font-semibold">{r.branch_name}</p>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm tnum md:grid-cols-3">
                <dt className="text-muted">Saldo</dt>
                <dd className="font-semibold md:col-span-2">{formatQuantity(Number(r.balance ?? 0), p.unit)}</dd>
                <dt className="text-muted">Mínimo</dt>
                <dd className="md:col-span-2">{formatQuantity(Number(r.min_qty ?? 0), p.unit)}</dd>
                <dt className="text-muted">Estado</dt>
                <dd className="md:col-span-2">
                  <StatusChip row={r} />
                </dd>
              </dl>
              {me.role === 'admin' && !r.initialized_at && <Button onClick={() => setInitRow(r)}>Registrar saldo inicial</Button>}
              {r.initialized_at && r.branch_active && p.is_active &&
                <Button onClick={() => setMovementRow(r)}>Registrar movimiento</Button>}
            </li>
          ))}
        </ul>
      )}
      <MovementHistory product={p} rows={rows} isAdmin={me.role === 'admin'} />
      {initRow && (
        <SaldoInicialDialog open={Boolean(initRow)} onClose={() => setInitRow(null)} product={p} row={initRow} />
      )}
      {movementRow && (
        <MovementDialog open={Boolean(movementRow)} onClose={() => setMovementRow(null)} product={p} row={movementRow} isAdmin={me.role === 'admin'} />
      )}
    </>
  )
}
