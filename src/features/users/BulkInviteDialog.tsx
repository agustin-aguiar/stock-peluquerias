import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Select } from '@/components/ui/Select'
import { useBranches } from '@/features/branches/api'
import { messageFor } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/models'
import { useCreateProfile } from './api'
import { parseBulkInvites } from './bulkInvites'
import { inviteProfile } from './invitations'

type Result = { email: string; text: string; ok: boolean }

export function BulkInviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const branches = useBranches()
  const create = useCreateProfile()
  const qc = useQueryClient()
  const [branchId, setBranchId] = useState('')
  const [list, setList] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<Result[]>([])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setResults([])
    if (!branchId || !branches.data?.some((b) => b.id === branchId && b.is_active)) {
      setError('Elegí un local activo.')
      return
    }
    let rows
    try { rows = parseBulkInvites(list) } catch (err) { setError((err as Error).message); return }
    setPending(true)
    const { data: existing, error: queryError } = await supabase.from('profiles').select('*')
    if (queryError) { setError(messageFor(queryError)); setPending(false); return }
    const byEmail = new Map(existing.map((p) => [p.email.toLowerCase(), p as Profile]))
    for (const row of rows) {
      try {
        let profile = byEmail.get(row.email)
        if (profile && (profile.branch_id !== branchId || profile.role !== 'operator')) {
          throw new Error('Ya está asignado a otro local o tiene otro rol.')
        }
        if (profile?.auth_user_id) {
          setResults((prev) => [...prev, { email: row.email, text: 'Ya tiene acceso.', ok: true }])
          continue
        }
        if (!profile) {
          profile = await create.mutateAsync({ email: row.email, full_name: row.full_name, role: 'operator', branch_id: branchId })
          byEmail.set(row.email, profile)
        }
        if (!profile.is_active) throw new Error('El usuario está desactivado. Activá su cuenta antes de invitarlo.')
        await inviteProfile(profile.id)
        setResults((prev) => [...prev, { email: row.email, text: 'Invitación enviada.', ok: true }])
      } catch (err) {
        setResults((prev) => [...prev, { email: row.email, text: err instanceof Error && !('code' in err) ? err.message : messageFor(err), ok: false }])
      }
    }
    void qc.invalidateQueries({ queryKey: ['profiles'] })
    setPending(false)
  }

  return <Dialog open={open} onClose={onClose} title="Invitar varios encargados">
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <p className="text-sm">Elegí el local y escribí una persona por línea, con este formato:</p>
      <p className="rounded-control bg-canvas p-2 text-xs">Ana Pérez;ana@ejemplo.com<br />Luis Gómez;luis@ejemplo.com</p>
      <Select label="Local" value={branchId} onChange={(event) => setBranchId(event.target.value)} placeholder="Elegí un local" options={(branches.data ?? []).filter((b) => b.is_active).map((b) => ({ value: b.id, label: b.name }))} />
      <label className="block text-sm font-semibold" htmlFor="bulk-invite-list">Personas y correos (máximo 20)</label>
      <textarea id="bulk-invite-list" value={list} onChange={(event) => setList(event.target.value)} rows={7} className="w-full rounded-control border border-hairline bg-surface p-2 text-sm" />
      {error && <p role="alert" className="text-sm text-carmine-fg">{error}</p>}
      {results.length > 0 && <div aria-live="polite" className="max-h-40 overflow-auto rounded-control border border-hairline p-2 text-sm">
        {results.map((result) => <p key={result.email} className={result.ok ? 'text-sage-fg' : 'text-carmine-fg'}>{result.email}: {result.text}</p>)}
      </div>}
      <p className="text-xs text-muted">Si falla algún correo, podés volver a enviar esta misma lista. Los usuarios creados se reutilizan.</p>
      <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cerrar</Button><Button type="submit" disabled={pending}>{pending ? 'Enviando…' : 'Enviar invitaciones'}</Button></div>
    </form>
  </Dialog>
}
