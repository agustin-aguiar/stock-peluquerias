import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useOnline } from '@/components/ui/OfflineBanner'
import { AuthLayout } from './AuthLayout'
import { authMessage } from './authErrors'

export function RecuperarPage() {
  const online = useOnline()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/restablecer`,
    })
    setPending(false)
    if (error && /failed to fetch|network|rate limit/i.test(error.message)) {
      setError(authMessage(error))
      return
    }
    // No revelar si el email existe.
    setSent(true)
  }

  return (
    <AuthLayout title="Recuperar contraseña">
      {sent ? (
        <div className="flex flex-col gap-4 text-sm">
          <p role="status">Si el email existe, te enviamos un enlace para restablecer la contraseña.</p>
          <Link to="/login" className="underline">
            Volver a iniciar sesión
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          {error && (
            <p role="alert" className="text-sm text-carmine-fg">
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending || !online || !email.trim()}>
            {pending ? 'Enviando…' : 'Enviar enlace'}
          </Button>
          <Link to="/login" className="text-sm text-muted underline">
            Volver
          </Link>
        </form>
      )}
    </AuthLayout>
  )
}
