import { describe, expect, it } from 'vitest'
import { groupByProduct } from '@/features/inventory/group'
import type { InventoryStatus } from '@/types/models'

function row(p: Partial<InventoryStatus>): InventoryStatus {
  return {
    id: 'i', chain_id: 'c', branch_id: 'b', product_id: 'p', balance: 0, min_qty: 0, version: 1,
    initialized_at: null, updated_at: null, below_min: true, sku: 'S', product_name: 'N', unit: 'ml',
    product_active: true, brand: null, category: null, branch_code: 'B', branch_name: 'B', branch_active: true,
    ...p,
  } as InventoryStatus
}

describe('groupByProduct', () => {
  it('agrupa filas por producto y las indexa por sucursal, ordenadas por nombre', () => {
    const rows = [
      row({ product_id: 'p2', product_name: 'Zeta', branch_id: 'b1', balance: 5 }),
      row({ product_id: 'p1', product_name: 'Alfa', branch_id: 'b1', balance: 1 }),
      row({ product_id: 'p1', product_name: 'Alfa', branch_id: 'b2', balance: 2 }),
    ]
    const g = groupByProduct(rows)
    expect(g.map((x) => x.productId)).toEqual(['p1', 'p2'])
    expect(g[0]!.byBranch.b1?.balance).toBe(1)
    expect(g[0]!.byBranch.b2?.balance).toBe(2)
    expect(g[1]!.byBranch.b2).toBeUndefined()
  })
})
