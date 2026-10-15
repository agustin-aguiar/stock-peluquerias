import { profileSchema } from './schema'

export type BulkInviteRow = { full_name: string; email: string }

export function parseBulkInvites(text: string): BulkInviteRow[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (lines.length === 0) throw new Error('Ingresá al menos una persona.')
  if (lines.length > 20) throw new Error('Podés invitar hasta 20 personas por vez.')
  const seen = new Set<string>()
  return lines.map((line, index) => {
    const parts = line.split(';')
    if (parts.length !== 2) throw new Error(`Línea ${index + 1}: usá Nombre completo;correo@ejemplo.com`)
    const parsed = profileSchema.safeParse({ full_name: parts[0], email: parts[1], role: 'operator', branch_id: 'pending' })
    if (!parsed.success) throw new Error(`Línea ${index + 1}: revisá el nombre y el correo.`)
    const row = { full_name: parsed.data.full_name, email: parsed.data.email }
    if (seen.has(row.email)) throw new Error(`El correo ${row.email} está repetido en la lista.`)
    seen.add(row.email)
    return row
  })
}
