import type { IncomingMessage, ServerResponse } from 'node:http'
import { createClient } from '@supabase/supabase-js'

function reply(response: ServerResponse, status: number, body: object) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(body))
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  let body = ''
  for await (const chunk of request) {
    body += chunk.toString()
    if (body.length > 4096) throw new Error('too_large')
  }
  return JSON.parse(body)
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== 'POST') return reply(response, 405, { error: 'Método no permitido' })
  const token = request.headers.authorization?.match(/^Bearer (.+)$/)?.[1]
  if (!token) return reply(response, 401, { error: 'Iniciá sesión para invitar usuarios.' })
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return reply(response, 503, { error: 'Las invitaciones no están configuradas.' })

  let profileId: string
  try {
    const body = await readBody(request) as { profileId?: unknown }
    if (typeof body.profileId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.profileId)) throw new Error('invalid')
    profileId = body.profileId
  } catch {
    return reply(response, 400, { error: 'Elegí un usuario válido.' })
  }

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  try {
    const { data: auth, error: authError } = await db.auth.getUser(token)
    if (authError || !auth.user) return reply(response, 401, { error: 'La sesión venció. Volvé a ingresar.' })
    const { data: actor, error: actorError } = await db.from('profiles')
      .select('id,chain_id,role,is_active').eq('auth_user_id', auth.user.id).maybeSingle()
    if (actorError) throw actorError
    if (!actor?.is_active || actor.role !== 'admin') return reply(response, 403, { error: 'Solo un administrador puede invitar usuarios.' })
    const { data: target, error: targetError } = await db.from('profiles')
      .select('id,chain_id,email,is_active,auth_user_id').eq('id', profileId).maybeSingle()
    if (targetError) throw targetError
    if (!target || target.chain_id !== actor.chain_id || !target.is_active) {
      return reply(response, 404, { error: 'El usuario no está disponible en tu cadena.' })
    }
    if (target.auth_user_id) return reply(response, 409, { error: 'Este usuario ya tiene una cuenta de acceso.' })
    const appUrl = (process.env.PUBLIC_APP_URL ?? 'https://stock-peluquerias.vercel.app').replace(/\/$/, '')
    const { error: inviteError } = await db.auth.admin.inviteUserByEmail(target.email, {
      redirectTo: `${appUrl}/auth/restablecer`,
    })
    if (inviteError) {
      console.error('No se pudo invitar al perfil:', profileId, inviteError.message)
      return reply(response, 502, { error: 'No se pudo enviar la invitación. Podés volver a intentarlo desde Usuarios.' })
    }
    return reply(response, 200, { sent: true })
  } catch (error) {
    console.error('Error al invitar un usuario:', error)
    return reply(response, 500, { error: 'No se pudo procesar la invitación.' })
  }
}
