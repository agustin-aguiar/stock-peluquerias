import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Input } from '@/components/ui/Input'
import { useOnline } from '@/components/ui/OfflineBanner'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useBranches } from '@/features/branches/api'
import { messageFor } from '@/lib/errors'
import { formatNumber, formatQuantity, parseQuantity, UNIT_LABEL } from '@/lib/quantity'
import type { Branch, InventoryStatus, UnitKind } from '@/types/models'
import { useEnableProduct, useProductAvailability, useSetMinQty } from './api'

type RowProps = { productId: string; unit: UnitKind; branch: Branch; row: InventoryStatus | undefined }

function AvailabilityRow({ productId, unit, branch, row }: RowProps) {
  const online = useOnline()
  const toast = useToast()
  const enable = useEnableProduct()
  const setMin = useSetMinQty()
  const [minStr, setMinStr] = useState(() => (row ? formatNumber(Number(row.min_qty ?? 0), unit) : '0'))
  const [error, setError] = useState<string | null>(null)
  const pending = enable.isPending || setMin.isPending

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const parsed = parseQuantity(minStr, unit)
    if (!parsed.ok) return setError(parsed.error)
    try {
      if (row) {
        await setMin.mutateAsync({ productId, branchId: branch.id, minQty: parsed.value })
        toast.push({ kind: 'success', text: `Mínimo actualizado en ${branch.name}.` })
      } else {
        await enable.mutateAsync({ productId, branchId: branch.id, minQty: parsed.value })
        toast.push({ kind: 'success', text: `Producto habilitado en ${branch.name}.` })
      }
    } catch (err) {
      setError(messageFor(err))
    }
  }

  const status = !row
    ? null
    : !row.initialized_at
      ? <Chip tone="amber">Sin saldo inicial</Chip>
      : row.below_min
        ? <Chip tone="amber">Bajo mínimo</Chip>
        : <Chip tone="sage">OK</Chip>

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <p className="label-caps text-muted">{branch.code}</p>
        <p className="font-semibold">{branch.name}</p>
        <p className="mt-1 text-sm tnum">
          Saldo: {row ? formatQuantity(Number(row.balance ?? 0), unit) : '—'}
        </p>
        <div className="mt-1 flex items-center gap-2">
          {status}
          {row && (
            <Link to={`/inventario/${productId}`} className="text-xs underline">
              Ver en inventario
            </Link>
          )}
        </div>
      </div>
      <form onSubmit={onSubmit} className="flex items-end gap-2" noValidate>
        <Input
          label={`Mínimo (${UNIT_LABEL[unit]})`}
          value={minStr}
          onChange={(e) => setMinStr(e.target.value)}
          inputMode="decimal"
          className="w-32 tnum"
          error={error ?? undefined}
        />
        <Button type="submit" variant={row ? 'secondary' : 'primary'} disabled={pending || !online}>
          {pending ? 'Guardando…' : row ? 'Guardar mínimo' : 'Habilitar'}
        </Button>
      </form>
    </li>
  )
}

export function AvailabilitySection({ productId, unit }: { productId: string; unit: UnitKind }) {
  const branches = useBranches()
  const availability = useProductAvailability(productId)
  if (branches.isPending || availability.isPending) return <LoadingState label="Cargando disponibilidad…" />
  if (branches.isError) return <ErrorState message={messageFor(branches.error)} onRetry={() => void branches.refetch()} />
  if (availability.isError) return <ErrorState message={messageFor(availability.error)} onRetry={() => void availability.refetch()} />
  const rows = availability.data ?? []
  const visible = (branches.data ?? []).filter((b) => b.is_active || rows.some((r) => r.branch_id === b.id))
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">Disponibilidad por sucursal</h2>
      <p className="mb-3 text-sm text-muted">
        También podés cargar stock directamente desde Inventario: el producto se habilita en la sucursal de forma automática.
      </p>
      <ul className="flex flex-col gap-3">
        {visible.map((b) => (
          <AvailabilityRow key={b.id} productId={productId} unit={unit} branch={b} row={rows.find((r) => r.branch_id === b.id)} />
        ))}
      </ul>
    </section>
  )
}
