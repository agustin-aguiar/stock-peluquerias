import { useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useOnline } from '@/components/ui/OfflineBanner'
import { supabase } from '@/lib/supabase'
import { AuthLayout } from './AuthLayout'
import { authMessage } from './authErrors'
import { useSession } from './session'

export function RegistroPage() {
  const { status } = useSession()
  const [params] = useSearchParams()
  const token = params.get('invitacion')
  const joining = Boolean(token)
  const online = useOnline()
  const [chainName, setChainName] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === 'signed_in') return <Navigate to={joining ? `/sin-perfil?invitacion=${encodeURIComponent(token!)}` : '/'} replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if ((!joining && !chainName.trim()) || !fullName.trim()) return setError('Completá tu nombre y los datos solicitados.')
    if (password.length < 10) return setError('La contraseña debe tener al menos 10 caracteres.')
    if (password !== confirm) return setError('Las contraseñas no coinciden.')
    setPending(true)
    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: {
        emailRedirectTo: `${window.location.origin}/sin-perfil${joining ? `?invitacion=${encodeURIComponent(token!)}` : ''}`,
        data: joining ? { branch_invite_token: token, full_name: fullName.trim() } : { chain_name: chainName.trim(), full_name: fullName.trim() },
      },
    })
    setPending(false)
    if (signUpError) return setError(authMessage(signUpError))
    setSent(true)
  }

  return <AuthLayout title={joining ? 'Unirse a un local' : 'Crear una cadena'}>
    {sent ? <div className="space-y-4 text-sm">
      <p>Revisá tu correo y confirmá tu cuenta. {joining ? 'Luego podrás activar tu acceso al local.' : 'Después podrás crear los locales e invitar a sus encargados.'}</p>
      <Link to="/login" className="font-semibold underline">Ir a iniciar sesión</Link>
    </div> : <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {!joining && <Input label="Nombre de la cadena" value={chainName} onChange={(e) => setChainName(e.target.value)} maxLength={120} required />}
      <Input label="Tu nombre" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} autoComplete="name" required />
      <Input label="Correo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      <Input label="Contraseña (mínimo 10 caracteres)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
      <Input label="Repetir contraseña" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
      {error && <p role="alert" className="text-sm text-carmine-fg">{error}</p>}
      <Button type="submit" disabled={pending || !online}>{pending ? 'Creando cuenta…' : 'Crear cuenta'}</Button>
      <Link to="/login" className="text-sm text-muted underline">Ya tengo cuenta</Link>
    </form>}
  </AuthLayout>
}
