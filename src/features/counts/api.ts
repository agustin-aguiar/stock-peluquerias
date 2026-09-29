import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { InventoryStatus } from '@/types/models'

export type CountRow = {
  id: string; branch_id: string; product_id: string; branch_name: string; product_name: string;
  sku: string; unit: 'unit' | 'ml' | 'g'; observed_qty: number; base_balance: number;
  base_version: number; note: string | null; status: 'pending' | 'approved' | 'rejected'; submitted_at: string
}

export function useCountInventory(branchId: string) {
  return useQuery({
    queryKey: ['counts', 'inventory', branchId], enabled: Boolean(branchId),
    queryFn: async (): Promise<InventoryStatus[]> => {
      const { data, error } = await supabase.from('inventory_status').select('*')
        .eq('branch_id', branchId).eq('product_active', true).not('initialized_at', 'is', null)
        .order('product_name').limit(500)
      if (error) throw error
      return data
    },
  })
}

export function useCounts(status: string) {
  return useQuery({
    queryKey: ['counts', 'list', status],
    queryFn: async (): Promise<CountRow[]> => {
      const { data, error } = await supabase.rpc('list_physical_counts', { p_status: status })
      if (error) throw error
      return data as CountRow[]
    },
  })
}

export type CountAction =
  | { kind: 'submit'; id: string; branchId: string; productId: string; observed: number; note: string | null }
  | { kind: 'approve'; id: string }
  | { kind: 'reject'; id: string; reason: string }

export function useCountAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (action: CountAction) => {
      if (action.kind === 'submit') {
        const { data, error } = await supabase.rpc('submit_physical_count', {
          p_id: action.id, p_branch_id: action.branchId, p_product_id: action.productId,
          p_observed_qty: action.observed, p_note: action.note,
        })
        if (error) throw error
        return data
      }
      if (action.kind === 'approve') {
        const { data, error } = await supabase.rpc('approve_physical_count', { p_count_id: action.id })
        if (error) throw error
        return data
      }
      const { data, error } = await supabase.rpc('reject_physical_count', { p_count_id: action.id, p_reason: action.reason })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['counts'] })
      void qc.invalidateQueries({ queryKey: ['inventory'] })
      void qc.invalidateQueries({ queryKey: ['movements'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
