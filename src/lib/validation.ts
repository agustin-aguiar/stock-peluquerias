import type { ZodError } from 'zod'

export type FieldErrors = Record<string, string>

/** Primer mensaje de error por campo (clave `_` para errores sin campo). */
export function fieldErrors(error: ZodError): FieldErrors {
  const out: FieldErrors = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '_')
    if (!(key in out)) out[key] = issue.message
  }
  return out
}
