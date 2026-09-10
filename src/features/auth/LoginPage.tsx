import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useOnline } from '@/components/ui/OfflineBanner'
import { AuthLayout } from './AuthLayout'
import { authMessage } from './authErrors'
import { SESSION_EXPIRED_FLAG, useSession } from './session'

function consumeExpiredFlag(): boolean {
  try {
    const v = window.sessionStorage.getItem(SESSION_EXPIRED_FLAG) === '1'
    window.sessionStorage.removeItem(SESSION_EXPIRED_FLAG)
    return v
  } catch {
    return false
  }
}

export function LoginPage() {
  const { status } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const online = useOnline()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [expired] = useState(consumeExpiredFlag)

  if (status === 'signed_in') return <Navigate to="/" replace />

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setPending(false)
    if (error) {
      setError(authMessage(error))
      return
    }
    navigate(from, { replace: true })
  }

  return (
    <AuthLayout title="Iniciar sesión">
      {expired && (
        <p role="status" className="mb-4 rounded-control bg-amber-bg p-3 text-sm text-amber-fg">
          Tu sesión venció. Volvé a ingresar.
        </p>
      )}
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input label="Contraseña" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && (
          <p role="alert" className="text-sm text-carmine-fg">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending || !online}>
          {pending ? 'Ingresando…' : 'Ingresar'}
        </Button>
        <Link to="/auth/recuperar" className="text-sm text-muted underline">
          Olvidé mi contraseña
        </Link>
      </form>
    </AuthLayout>
  )
}
