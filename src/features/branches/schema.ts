import { z } from 'zod'

export const branchSchema = z.object({
  code: z.string().trim().regex(/^[A-Z0-9]{2,8}$/, 'Entre 2 y 8 letras mayúsculas o números.'),
  name: z.string().trim().min(1, 'El nombre es obligatorio.').max(120, 'Máximo 120 caracteres.'),
})

export type BranchInput = z.infer<typeof branchSchema>
