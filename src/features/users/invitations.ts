import { supabase } from '@/lib/supabase'

export async function inviteProfile(profileId: string) {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) throw new Error('Tu sesión venció. Volvé a ingresar.')
  const response = await fetch('/api/invite-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
    body: JSON.stringify({ profileId }),
  })
  const body = await response.json() as { error?: string }
  if (!response.ok) throw new Error(body.error ?? 'No se pudo enviar la invitación.')
}
