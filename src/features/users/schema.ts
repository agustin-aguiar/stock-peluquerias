import { z } from 'zod'

export const profileSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email('El email no es válido.')),
    full_name: z.string().trim().min(1, 'El nombre es obligatorio.').max(120, 'Máximo 120 caracteres.'),
    role: z.enum(['admin', 'operator'], { message: 'Elegí un rol.' }),
    branch_id: z
      .string()
      .transform((v) => (v.trim() === '' ? null : v))
      .nullable(),
  })
  .transform((v) => ({ ...v, branch_id: v.role === 'admin' ? null : v.branch_id }))
  .refine((v) => v.role !== 'operator' || Boolean(v.branch_id), {
    message: 'Un operador necesita una sucursal.',
    path: ['branch_id'],
  })

export type ProfileInput = z.infer<typeof profileSchema>
