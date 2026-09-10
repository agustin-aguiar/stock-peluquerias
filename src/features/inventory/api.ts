import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sanitizeSearch } from '@/features/products/api'
import { supabase } from '@/lib/supabase'
import type { InventoryStatus } from '@/types/models'

export const PAGE_SIZE = 50
export const COMPARE_LIMIT = 500

export type InventoryFilters = {
  branchId: string | 'all'
  search: string
  onlyBelowMin: boolean
  page: number
}

export const inventoryKeys = {
  list: (f: InventoryFilters) => ['inventory', 'list', f] as const,
}

export function useInventory(filters: InventoryFilters) {
  return useQuery({
    queryKey: inventoryKeys.list(filters),
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<{ rows: InventoryStatus[]; count: number }> => {
      let q = supabase
        .from('inventory_status')
        .select('*', { count: 'exact' })
        .eq('product_active', true)
        .order('product_name')
        .order('branch_code')
      if (filters.branchId !== 'all') q = q.eq('branch_id', filters.branchId)
      if (filters.onlyBelowMin) q = q.eq('below_min', true)
      const s = sanitizeSearch(filters.search)
      if (s) q = q.or(`sku.ilike.%${s}%,product_name.ilike.%${s}%`)
      q =
        filters.branchId === 'all'
          ? q.limit(COMPARE_LIMIT)
          : q.range(filters.page * PAGE_SIZE, (filters.page + 1) * PAGE_SIZE - 1)
      const { data, count, error } = await q
      if (error) throw error
      return { rows: data, count: count ?? 0 }
    },
  })
}

export type InitialBalanceResult = {
  operation_id: string
  movement_id: string | null
  balance: number
  branch_id: string
  product_id: string
}

export function useSetInitialBalance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      key: string
      branchId: string
      productId: string
      qty: number
      reference: string | null
    }): Promise<InitialBalanceResult> => {
      const { data, error } = await supabase.rpc('set_initial_balance', {
        p_key: input.key,
        p_branch_id: input.branchId,
        p_product_id: input.productId,
        p_qty: input.qty,
        p_reference: input.reference ?? undefined,
      })
      if (error) throw error
      return data as unknown as InitialBalanceResult
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['inventory'] }),
  })
}
