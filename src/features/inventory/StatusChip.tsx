import { Chip } from '@/components/ui/Chip'
import type { InventoryStatus } from '@/types/models'

export function StatusChip({ row }: { row: InventoryStatus }) {
  if (!row.initialized_at) return <Chip tone="amber">Falta primera carga</Chip>
  if (row.below_min) return <Chip tone="amber">Queda poco</Chip>
  return <Chip tone="sage">Disponible</Chip>
}
