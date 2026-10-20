import { Chip } from '@/components/ui/Chip'
import type { InventoryStatus } from '@/types/models'

/** En listas solo se marca lo que necesita atención; `showOk` muestra también el estado normal. */
export function StatusChip({ row, showOk = false }: { row: InventoryStatus; showOk?: boolean }) {
  if (!row.initialized_at) return <Chip tone="amber">Falta primera carga</Chip>
  if (row.below_min && Number(row.balance ?? 0) === 0) return <Chip tone="carmine">Agotado</Chip>
  if (row.below_min) return <Chip tone="amber">Queda poco</Chip>
  return showOk ? <Chip tone="sage">Disponible</Chip> : null
}
