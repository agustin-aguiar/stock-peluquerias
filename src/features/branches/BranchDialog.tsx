import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { useOnline } from '@/components/ui/OfflineBanner'
import { useToast } from '@/components/ui/Toast'
import { messageFor } from '@/lib/errors'
import { fieldErrors, type FieldErrors } from '@/lib/validation'
import type { Branch } from '@/types/models'
import { useCreateBranch, useUpdateBranch } from './api'
import { branchSchema } from './schema'

type Props = { open: boolean; onClose: () => void; branch: Branch | null }

/** Alta (branch = null) o edición de sucursal. El código no se edita. */
export function BranchDialog({ open, onClose, branch }: Props) {
  const online = useOnline()
  const toast = useToast()
  const create = useCreateBranch()
  const update = useUpdateBranch()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setCode(branch?.code ?? '')
    setName(branch?.name ?? '')
    setIsActive(branch?.is_active ?? true)
    setErrors({})
    setServerError(null)
  }, [open, branch])

  const pending = create.isPending || update.isPending

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setServerError(null)
    const parsed = branchSchema.safeParse({ code: branch ? branch.code : code.toUpperCase(), name })
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error))
      return
    }
    setErrors({})
    try {
      if (branch) {
        await update.mutateAsync({ id: branch.id, name: parsed.data.name, is_active: isActive })
        toast.push({ kind: 'success', text: 'Sucursal actualizada.' })
      } else {
        await create.mutateAsync(parsed.data)
        toast.push({ kind: 'success', text: 'Sucursal creada.' })
      }
      onClose()
    } catch (err) {
      setServerError(messageFor(err))
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={branch ? 'Editar sucursal' : 'Nueva sucursal'}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Input
          label="Código"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          disabled={Boolean(branch)}
          hint="Entre 2 y 8 letras mayúsculas o números. No se puede cambiar después."
          error={errors.code}
          maxLength={8}
        />
        <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} maxLength={120} />
        {branch && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Sucursal activa
          </label>
        )}
        {branch && branch.is_active && !isActive && (
          <p className="rounded-control bg-amber-bg p-3 text-xs text-amber-fg">
            Solo se puede desactivar sin saldo, sin transferencias abiertas y sin usuarios activos asignados.
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
