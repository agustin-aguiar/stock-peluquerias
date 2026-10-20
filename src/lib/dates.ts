/** "19 oct, 23:52" en el año en curso; "19 oct 2025, 23:52" en otros años. */
export function formatDateTime(iso: string, now = new Date()): string {
  const date = new Date(iso)
  return date.toLocaleString('es-UY', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  }).replace('.', '')
}

/** "19 oct" en el año en curso; "19 oct 2025" en otros años. */
export function formatDate(iso: string, now = new Date()): string {
  const date = new Date(iso)
  return date.toLocaleDateString('es-UY', {
    day: 'numeric', month: 'short',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  }).replace('.', '')
}
