import { Chip } from '@/components/ui/Chip'
import type { InventoryStatus } from '@/types/models'

export function StatusChip({ row }: { row: InventoryStatus }) {
  if (!row.initialized_at) return <Chip tone="amber">Sin saldo inicial</Chip>
  if (row.below_min) return <Chip tone="amber">Bajo mínimo</Chip>
  return <Chip tone="sage">OK</Chip>
}
