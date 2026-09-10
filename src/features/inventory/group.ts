import type { InventoryStatus, UnitKind } from '@/types/models'

export type ProductGroup = {
  productId: string
  sku: string
  name: string
  unit: UnitKind
  byBranch: Record<string, InventoryStatus>
}

/** Una fila por producto con sus saldos por sucursal (para "Comparar locales"). */
export function groupByProduct(rows: InventoryStatus[]): ProductGroup[] {
  const map = new Map<string, ProductGroup>()
  for (const r of rows) {
    const id = r.product_id ?? ''
    let g = map.get(id)
    if (!g) {
      g = { productId: id, sku: r.sku ?? '', name: r.product_name ?? '', unit: (r.unit ?? 'unit') as UnitKind, byBranch: {} }
      map.set(id, g)
    }
    if (r.branch_id) g.byBranch[r.branch_id] = r
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
}
