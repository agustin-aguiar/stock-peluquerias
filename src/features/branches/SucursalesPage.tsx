import { useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { messageFor } from '@/lib/errors'
import type { Branch } from '@/types/models'
import { useBranches } from './api'
import { BranchDialog } from './BranchDialog'

export function SucursalesPage() {
  const branches = useBranches()
  const [dialog, setDialog] = useState<{ open: boolean; branch: Branch | null }>({ open: false, branch: null })

  const openNew = () => setDialog({ open: true, branch: null })
  const openEdit = (b: Branch) => setDialog({ open: true, branch: b })
  const close = () => setDialog((d) => ({ ...d, open: false }))

  return (
    <>
      <PageHeader
        eyebrow="Administración"
        title="Sucursales"
        description="Cada sucursal tiene su propio inventario."
        actions={
          <Button onClick={openNew}>
            <Plus size={16} aria-hidden /> Nueva sucursal
          </Button>
        }
      />
      {branches.isPending && <LoadingState />}
      {branches.isError && <ErrorState message={messageFor(branches.error)} onRetry={() => void branches.refetch()} />}
      {branches.data && branches.data.length === 0 && (
        <EmptyState title="Todavía no hay sucursales" action={<Button onClick={openNew}>Crear la primera</Button>} />
      )}
      {branches.data && branches.data.length > 0 && (
        <>
          <table className="hidden w-full border-collapse text-sm md:table">
            <thead>
              <tr className="label-caps text-left text-muted">
                <th className="py-2 pr-4">Código</th>
                <th className="py-2 pr-4">Nombre</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {branches.data.map((b) => (
                <tr key={b.id} className="border-t border-hairline hover:bg-canvas">
                  <td className="py-3 pr-4 font-semibold tnum">{b.code}</td>
                  <td className="py-3 pr-4">{b.name}</td>
                  <td className="py-3 pr-4">
                    <Chip tone={b.is_active ? 'sage' : 'neutral'}>{b.is_active ? 'Activa' : 'Inactiva'}</Chip>
                  </td>
                  <td className="py-3 text-right">
                    <Button variant="secondary" onClick={() => openEdit(b)} aria-label={`Editar ${b.name}`}>
                      <Pencil size={14} aria-hidden /> Editar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="flex flex-col gap-3 md:hidden">
            {branches.data.map((b) => (
              <li key={b.id} className="rounded-lg border border-hairline bg-surface p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="label-caps text-muted">{b.code}</p>
                    <p className="font-semibold">{b.name}</p>
                  </div>
                  <Chip tone={b.is_active ? 'sage' : 'neutral'}>{b.is_active ? 'Activa' : 'Inactiva'}</Chip>
                </div>
                <Button variant="secondary" className="mt-3 w-full" onClick={() => openEdit(b)}>
                  <Pencil size={14} aria-hidden /> Editar
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
      <BranchDialog open={dialog.open} onClose={close} branch={dialog.branch} />
    </>
  )
}
