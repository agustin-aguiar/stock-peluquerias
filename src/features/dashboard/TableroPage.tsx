import { useState } from 'react'
import { Link } from 'react-router'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { Stats } from '@/components/ui/Stats'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { messageFor } from '@/lib/errors'
import { formatQuantity } from '@/lib/quantity'
import { useDashboardSnapshot } from './api'

function localDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
const today = new Date()
const start = new Date(today)
start.setDate(start.getDate() - 29)

export function TableroPage() {
  const [from, setFrom] = useState(localDate(start))
  const [to, setTo] = useState(localDate(today))
  const [branchId, setBranchId] = useState('all')
  const snapshot = useDashboardSnapshot(from, to)
  const branches = snapshot.data?.branches ?? []
  const usage = (snapshot.data?.usage ?? []).filter((row) => branchId === 'all' || row.branch_id === branchId)

  return <>
    <PageHeader eyebrow="Seguimiento" title="Resumen de stock" description="Compará los locales y mirá qué productos se usaron o se perdieron en el período elegido." />
    <div className="mb-5 grid gap-3 md:grid-cols-3">
      <Input label="Desde" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
      <Input label="Hasta" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      <Select label="Sucursal" value={branchId} onChange={(e) => setBranchId(e.target.value)}
        options={[{ value: 'all', label: 'Todas' }, ...branches.map((b) => ({ value: b.branch_id, label: b.branch_name }))]} />
    </div>
    {from > to && <p role="alert" className="text-sm text-carmine-fg">La fecha inicial debe ser anterior a la final.</p>}
    {snapshot.isPending && from <= to && <LoadingState />}
    {snapshot.isError && <ErrorState message={messageFor(snapshot.error)} onRetry={() => void snapshot.refetch()} />}
    {snapshot.data && <>
      <p className="mb-3 text-sm text-muted">Los productos con poco stock, agotados y los envíos pendientes muestran la situación de hoy. Los productos usados y perdidos corresponden a las fechas elegidas.</p>
      <ul className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{branches.filter((b) => branchId === 'all' || b.branch_id === branchId).map((b) =>
        <li key={b.branch_id} className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-5">
          <h2 className="text-lg font-semibold">{b.branch_name}</h2>
          <Stats items={[
            { label: 'Queda poco', value: b.below_min, tone: 'amber' },
            { label: 'Agotados', value: b.zero_balance, tone: 'carmine' },
            { label: 'Envíos en curso', value: b.open_transfers },
          ]} />
        </li>)}</ul>
      <h2 className="mb-3 text-lg font-semibold">Productos usados o perdidos</h2>
      {usage.length === 0 && <EmptyState title="Sin salidas en este período" />}
      {usage.length > 0 && <div className="overflow-x-auto"><table className="w-full min-w-[36rem] border-collapse text-sm">
        <thead><tr className="label-caps text-left text-muted"><th className="py-2">Producto</th><th>Sucursal</th><th className="text-right">Consumo</th><th className="text-right">Merma</th></tr></thead>
        <tbody>{usage.map((row) => <tr key={`${row.branch_id}-${row.product_id}`} className="border-t border-hairline">
          <td className="py-3"><Link to={`/inventario/${row.product_id}`} className="font-semibold underline-offset-2 hover:underline">{row.product_name}</Link><span className="block text-xs text-muted">{row.sku}</span></td>
          <td>{row.branch_name}</td><td className="text-right tnum">{formatQuantity(Number(row.consumption ?? 0), row.unit)}</td>
          <td className="text-right tnum">{formatQuantity(Number(row.shrinkage ?? 0), row.unit)}</td>
        </tr>)}</tbody></table></div>}
    </>}
  </>
}
