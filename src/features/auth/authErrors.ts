/** Traduce errores de Supabase Auth a mensajes para el usuario. */
export function authMessage(err: { message?: string } | null | undefined): string {
  const m = err?.message ?? ''
  if (/invalid login credentials/i.test(m)) return 'Email o contraseña incorrectos.'
  if (/email not confirmed/i.test(m)) return 'La cuenta todavía no está confirmada.'
  if (/rate limit|too many/i.test(m)) return 'Demasiados intentos. Esperá un momento y reintentá.'
  if (/password should be at least|weak password/i.test(m)) return 'La contraseña debe tener al menos 6 caracteres.'
  if (/same password|different from the old/i.test(m)) return 'La nueva contraseña debe ser distinta a la anterior.'
  if (/failed to fetch|network/i.test(m)) return 'No se pudo conectar. Verificá la conexión.'
  return 'No se pudo completar la operación. Reintentá.'
}
