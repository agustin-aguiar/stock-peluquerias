import { useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { useCurrentProfile } from '@/app/guards'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { useBranches } from '@/features/branches/api'
import { messageFor } from '@/lib/errors'
import { ROLE_LABEL, type Profile } from '@/types/models'
import { useProfiles } from './api'
import { ProfileDialog } from './ProfileDialog'

export function UsuariosPage() {
  const me = useCurrentProfile()
  const profiles = useProfiles()
  const branches = useBranches()
  const [dialog, setDialog] = useState<{ open: boolean; profile: Profile | null }>({ open: false, profile: null })
  const branchName = (id: string | null) => branches.data?.find((b) => b.id === id)?.name ?? '—'

  const openNew = () => setDialog({ open: true, profile: null })
  const openEdit = (p: Profile) => setDialog({ open: true, profile: p })
  const close = () => setDialog((d) => ({ ...d, open: false }))

  function StatusChips({ p }: { p: Profile }) {
    return (
      <span className="flex flex-wrap gap-1">
        <Chip tone={p.is_active ? 'sage' : 'neutral'}>{p.is_active ? 'Activo' : 'Inactivo'}</Chip>
        {!p.auth_user_id && <Chip tone="amber">Sin cuenta</Chip>}
      </span>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Administración"
        title="Usuarios"
        description='"Sin cuenta" significa que falta crear el acceso en Supabase con ese email.'
        actions={
          <Button onClick={openNew}>
            <Plus size={16} aria-hidden /> Nuevo usuario
          </Button>
        }
      />
      {profiles.isPending && <LoadingState />}
      {profiles.isError && <ErrorState message={messageFor(profiles.error)} onRetry={() => void profiles.refetch()} />}
      {profiles.data && profiles.data.length === 0 && <EmptyState title="No hay usuarios" />}
      {profiles.data && profiles.data.length > 0 && (
        <>
          <table className="hidden w-full border-collapse text-sm md:table">
            <thead>
              <tr className="label-caps text-left text-muted">
                <th className="py-2 pr-4">Nombre</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Rol</th>
                <th className="py-2 pr-4">Sucursal</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {profiles.data.map((p) => (
                <tr key={p.id} className="border-t border-hairline hover:bg-canvas">
                  <td className="py-3 pr-4 font-semibold">
                    {p.full_name}
                    {p.id === me.id && <span className="ml-2 text-xs text-muted">(vos)</span>}
                  </td>
                  <td className="py-3 pr-4">{p.email}</td>
                  <td className="py-3 pr-4">{ROLE_LABEL[p.role]}</td>
                  <td className="py-3 pr-4">{p.role === 'operator' ? branchName(p.branch_id) : 'Toda la cadena'}</td>
                  <td className="py-3 pr-4">
                    <StatusChips p={p} />
                  </td>
                  <td className="py-3 text-right">
                    <Button variant="secondary" onClick={() => openEdit(p)} aria-label={`Editar ${p.full_name}`}>
                      <Pencil size={14} aria-hidden /> Editar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="flex flex-col gap-3 md:hidden">
            {profiles.data.map((p) => (
              <li key={p.id} className="rounded-lg border border-hairline bg-surface p-4">
                <p className="font-semibold">
                  {p.full_name}
                  {p.id === me.id && <span className="ml-2 text-xs text-muted">(vos)</span>}
                </p>
                <p className="text-sm text-muted">{p.email}</p>
                <p className="mt-1 text-sm">
                  {ROLE_LABEL[p.role]} · {p.role === 'operator' ? branchName(p.branch_id) : 'Toda la cadena'}
                </p>
                <div className="mt-2">
                  <StatusChips p={p} />
                </div>
                <Button variant="secondary" className="mt-3 w-full" onClick={() => openEdit(p)}>
                  <Pencil size={14} aria-hidden /> Editar
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
      <ProfileDialog open={dialog.open} onClose={close} profile={dialog.profile} isSelf={dialog.profile?.id === me.id} />
    </>
  )
}
