import { MapPin } from 'lucide-react'
import { useBranches } from '@/features/branches/api'
import { useActiveBranch } from '@/features/branches/activeBranch'

/** Sucursal activa siempre visible. Admin puede cambiarla; operador la ve fija. */
export function BranchPill() {
  const { branchId, setBranchId, canChange } = useActiveBranch()
  const branches = useBranches()
  const active = (branches.data ?? []).filter((b) => b.is_active)
  const current = branches.data?.find((b) => b.id === branchId)
  const label = branchId === 'all' ? 'Todas las sucursales' : (current?.name ?? 'Sucursal')

  const base =
    'inline-flex h-9 items-center gap-2 rounded-full border border-champagne/30 bg-canvas px-3 text-sm font-semibold'

  if (!canChange) {
    return (
      <span className={base} aria-label={`Sucursal activa: ${label}`}>
        <MapPin size={16} className="text-champagne" aria-hidden /> {label}
      </span>
    )
  }
  return (
    <label className={`${base} cursor-pointer`}>
      <MapPin size={16} className="text-champagne" aria-hidden />
      <span className="sr-only">Sucursal activa</span>
      <select
        value={branchId}
        onChange={(e) => setBranchId(e.target.value === 'all' ? 'all' : e.target.value)}
        className="bg-transparent pr-1 text-sm font-semibold outline-none"
      >
        <option value="all">Todas las sucursales</option>
        {active.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </label>
  )
}
