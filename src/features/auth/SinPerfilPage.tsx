import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useOnline } from '@/components/ui/OfflineBanner'
import { messageFor } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { AuthLayout } from './AuthLayout'
import { signOut, useSession } from './session'
import { useProfile } from './useProfile'

export function SinPerfilPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const online = useOnline()
  const { session } = useSession()
  const profile = useProfile()
  const metadata = session?.user.user_metadata
  const token = params.get('invitacion') ?? (typeof metadata?.branch_invite_token === 'string' ? metadata.branch_invite_token : null)
  const joining = Boolean(token)
  const [chainName, setChainName] = useState(() => String(metadata?.chain_name ?? ''))
  const [fullName, setFullName] = useState(() => String(metadata?.full_name ?? ''))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (metadata?.chain_name) setChainName(String(metadata.chain_name))
    if (metadata?.full_name) setFullName(String(metadata.full_name))
  }, [session?.user.id])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setPending(true)
    const { error: createError } = joining
      ? await supabase.rpc('join_branch_with_link', { p_token: token!, p_full_name: fullName.trim() })
      : await supabase.rpc('create_my_chain', { p_chain_name: chainName.trim(), p_full_name: fullName.trim() })
    setPending(false)
    if (createError) return setError(messageFor(createError))
    await profile.refetch()
    navigate(joining ? '/inventario' : '/inicio', { replace: true })
  }

  return <AuthLayout title={joining ? 'Activar acceso al local' : 'Preparar tu cadena'}>
    <p className="mb-4 text-sm">{joining ? 'Confirmá tu nombre para ingresar como encargado al local que te invitó.' : 'Si creaste una cuenta nueva, completá estos datos para empezar. Si te invitaron por correo, actualizá la página; tu acceso se vincula automáticamente.'}</p>
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {!joining && <Input label="Nombre de la cadena" value={chainName} onChange={(e) => setChainName(e.target.value)} maxLength={120} required />}
      <Input label="Tu nombre" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} required />
      {error && <p role="alert" className="text-sm text-carmine-fg">{error}</p>}
      <Button type="submit" disabled={pending || !online}>{pending ? 'Preparando…' : 'Empezar'}</Button>
    </form>
    <Button className="mt-4" variant="secondary" onClick={async () => { await signOut(); navigate('/login', { replace: true }) }}>Cerrar sesión</Button>
  </AuthLayout>
}
