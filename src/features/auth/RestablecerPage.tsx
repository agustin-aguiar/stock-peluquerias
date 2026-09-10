import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LoadingState } from '@/components/ui/States'
import { AuthLayout } from './AuthLayout'
import { authMessage } from './authErrors'
import { useSession } from './session'

export function RestablecerPage() {
  const { status } = useSession()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (status === 'loading') return <LoadingState label="Verificando enlace…" />
  if (status === 'signed_out') {
    return (
      <AuthLayout title="Enlace inválido">
        <p className="text-sm">El enlace no es válido o venció.</p>
        <Link to="/auth/recuperar" className="mt-4 inline-block text-sm underline">
          Pedir uno nuevo
        </Link>
      </AuthLayout>
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.')
    if (password !== confirm) return setError('Las contraseñas no coinciden.')
    setPending(true)
    const { error } = await supabase.auth.updateUser({ password })
    setPending(false)
    if (error) return setError(authMessage(error))
    navigate('/', { replace: true })
  }

  return (
    <AuthLayout title="Nueva contraseña">
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Input label="Nueva contraseña" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Input label="Repetir contraseña" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        {error && (
          <p role="alert" className="text-sm text-carmine-fg">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar contraseña'}
        </Button>
      </form>
    </AuthLayout>
  )
}
