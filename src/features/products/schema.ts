import { z } from 'zod'

const optionalText = (max: number) =>
  z.string().trim().max(max, `Máximo ${max} caracteres.`).transform((v) => (v === '' ? null : v))

export const productSchema = z.object({
  sku: z.string().trim().regex(/^[A-Za-z0-9._-]{1,40}$/, 'Letras, números, punto, guion o guion bajo (máximo 40).'),
  name: z.string().trim().min(1, 'El nombre es obligatorio.').max(160, 'Máximo 160 caracteres.'),
  unit: z.enum(['unit', 'ml', 'g'], { message: 'Elegí una unidad.' }),
  brand: optionalText(80),
  category: optionalText(80),
  variant: optionalText(80),
  presentation: optionalText(80),
  presentation_qty: z.number().positive('Debe ser mayor que cero.').nullable(),
  max_movement_qty: z.number().positive('Debe ser mayor que cero.'),
  is_active: z.boolean(),
})

export type ProductInput = z.infer<typeof productSchema>
