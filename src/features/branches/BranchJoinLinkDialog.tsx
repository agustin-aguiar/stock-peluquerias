import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { messageFor } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { Branch } from '@/types/models'

type LinkInfo = { token: string; expires_at: string; uses: number; max_uses: number; revoked_at: string | null }

export function BranchJoinLinkDialog({ branch, onClose }: { branch: Branch | null; onClose: () => void }) {
  const [link, setLink] = useState<LinkInfo | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!branch) return
    let active = true
    setLink(null)
    setError(null)
    setCopied(false)
    void supabase.rpc('get_branch_join_link', { p_branch_id: branch.id }).then(({ data, error: queryError }) => {
      if (!active) return
      if (queryError) setError(messageFor(queryError))
      else setLink(data as LinkInfo | null)
    })
    return () => { active = false }
  }, [branch])

  const valid = link && !link.revoked_at && new Date(link.expires_at) > new Date() && link.uses < link.max_uses
  const url = link ? `${window.location.origin}/registro?invitacion=${link.token}` : ''

  async function generate() {
    if (!branch) return
    setPending(true)
    setError(null)
    const { data, error: rpcError } = await supabase.rpc('create_branch_join_link', { p_branch_id: branch.id })
    setPending(false)
    if (rpcError) setError(messageFor(rpcError))
    else { setLink(data as LinkInfo); setCopied(false) }
  }

  async function revoke() {
    if (!branch) return
    setPending(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc('revoke_branch_join_link', { p_branch_id: branch.id })
    setPending(false)
    if (rpcError) setError(messageFor(rpcError))
    else setLink((current) => current ? { ...current, revoked_at: new Date().toISOString() } : null)
  }

  return <Dialog open={Boolean(branch)} onClose={onClose} title={`Invitar al local ${branch?.name ?? ''}`}>
    <div className="space-y-4 text-sm">
      <p>Compartí este enlace con los encargados del local. Cada persona crea su cuenta con su propio correo y contraseña. El enlace dura 7 días y admite hasta 20 altas.</p>
      {valid ? <>
        <label className="block font-semibold" htmlFor="branch-join-url">Enlace de registro</label>
        <input id="branch-join-url" readOnly value={url} className="w-full rounded-control border border-hairline bg-canvas p-2 text-xs" onFocus={(e) => e.target.select()} />
        <p className="text-muted">Usos: {link.uses} de {link.max_uses}. Vence el {new Date(link.expires_at).toLocaleString('es-UY')}.</p>
        <Button onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true) } catch { setError('No se pudo copiar. Seleccioná el enlace y copialo manualmente.') } }}>{copied ? 'Copiado' : 'Copiar enlace'}</Button>
        <Button variant="secondary" disabled={pending} onClick={() => void revoke()}>Desactivar enlace</Button>
      </> : <p className="text-muted">No hay un enlace activo para este local.</p>}
      <Button variant="secondary" disabled={pending || !branch?.is_active} onClick={() => void generate()}>{pending ? 'Guardando…' : valid ? 'Crear un enlace nuevo' : 'Crear enlace'}</Button>
      {error && <p role="alert" className="text-carmine-fg">{error}</p>}
    </div>
  </Dialog>
}
