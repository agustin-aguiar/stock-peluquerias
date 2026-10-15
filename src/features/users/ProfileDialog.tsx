import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { useOnline } from '@/components/ui/OfflineBanner'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toast'
import { useBranches } from '@/features/branches/api'
import { messageFor } from '@/lib/errors'
import { fieldErrors, type FieldErrors } from '@/lib/validation'
import type { Profile, UserRole } from '@/types/models'
import { useCreateProfile, useUpdateProfile } from './api'
import { profileSchema } from './schema'
import { inviteProfile } from './invitations'

type Props = { open: boolean; onClose: () => void; profile: Profile | null; isSelf: boolean }

export function ProfileDialog({ open, onClose, profile, isSelf }: Props) {
  const online = useOnline()
  const toast = useToast()
  const branches = useBranches()
  const create = useCreateProfile()
  const update = useUpdateProfile()
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<UserRole>('operator')
  const [branchId, setBranchId] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setEmail(profile?.email ?? '')
    setFullName(profile?.full_name ?? '')
    setRole(profile?.role ?? 'operator')
    setBranchId(profile?.branch_id ?? '')
    setIsActive(profile?.is_active ?? true)
    setErrors({})
    setServerError(null)
  }, [open, profile])

  const pending = create.isPending || update.isPending
  const activeBranches = (branches.data ?? []).filter((b) => b.is_active || b.id === profile?.branch_id)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setServerError(null)
    const parsed = profileSchema.safeParse({ email: profile ? profile.email : email, full_name: fullName, role, branch_id: branchId })
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error))
      return
    }
    setErrors({})
    try {
      if (profile) {
        await update.mutateAsync({ id: profile.id, full_name: parsed.data.full_name, role: parsed.data.role, branch_id: parsed.data.branch_id, is_active: isActive })
        toast.push({ kind: 'success', text: 'Usuario actualizado.' })
      } else {
        const created = await create.mutateAsync(parsed.data)
        if (created.auth_user_id) {
          toast.push({ kind: 'success', text: 'Usuario creado. Ya puede iniciar sesión.' })
        } else {
          try {
            await inviteProfile(created.id)
            toast.push({ kind: 'success', text: 'Usuario creado e invitación enviada por correo.' })
          } catch (inviteError) {
            toast.push({ kind: 'error', text: `Usuario creado, pero no se envió la invitación: ${inviteError instanceof Error ? inviteError.message : 'Reintentá desde Usuarios.'}` })
          }
        }
      }
      onClose()
    } catch (err) {
      setServerError(messageFor(err))
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={profile ? 'Editar usuario' : 'Nuevo usuario'}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={Boolean(profile)} error={errors.email} />
        <Input label="Nombre completo" value={fullName} onChange={(e) => setFullName(e.target.value)} error={errors.full_name} maxLength={120} />
        <Select
          label="Rol"
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          options={[
            { value: 'operator', label: 'Encargado de local' },
            { value: 'admin', label: 'Administrador de cadena' },
          ]}
          disabled={isSelf}
          error={errors.role}
        />
        {role === 'operator' && (
          <Select
            label="Sucursal"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            placeholder="Elegí una sucursal"
            options={activeBranches.map((b) => ({ value: b.id, label: `${b.code} · ${b.name}` }))}
            error={errors.branch_id}
          />
        )}
        {profile && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} disabled={isSelf} />
            Usuario activo
          </label>
        )}
        {!profile && (
          <p className="rounded-control bg-indigo-bg p-3 text-xs text-indigo-fg">
            Al guardar, se enviará una invitación para que la persona elija su contraseña.
          </p>
        )}
        {serverError && (
          <p role="alert" className="text-sm text-carmine-fg">
            {serverError}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending || !online}>
            {pending ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
