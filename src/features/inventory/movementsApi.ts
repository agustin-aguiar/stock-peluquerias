import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

export type MovementType = 'purchase' | 'consumption' | 'sale' | 'shrinkage' | 'adjustment'
export type MovementResult = {
  operation_id: string
  movement_id: string
  balance: number
  branch_id: string
  product_id: string
}
export type MovementRecord = {
  id: string
  branch_id: string | null
  qty_delta: number
  unit: 'unit' | 'ml' | 'g'
  created_at: string
  reverses_movement_id: string | null
  operation: {
    id: string
    type: Database['public']['Enums']['operation_type']
    reason: string | null
    reference: string | null
    actor_profile_id: string
  }
}

export type HistoryFilters = { productId: string; branchId: string | 'all'; type: string; from: string; to: string; page: number }
export const HISTORY_PAGE_SIZE = 30

export function useMovementHistory(filters: HistoryFilters) {
  return useQuery({
    queryKey: ['movements', 'history', filters],
    queryFn: async (): Promise<{ rows: MovementRecord[]; count: number }> => {
      let q = supabase.from('movements')
        .select('id, branch_id, qty_delta, unit, created_at, reverses_movement_id, operation:operations!inner(id, type, reason, reference, actor_profile_id)', { count: 'exact' })
        .eq('product_id', filters.productId)
        .order('created_at', { ascending: false })
        .range(filters.page * HISTORY_PAGE_SIZE, (filters.page + 1) * HISTORY_PAGE_SIZE - 1)
      if (filters.branchId !== 'all') q = q.eq('branch_id', filters.branchId)
      if (filters.type) q = q.eq('operation.type', filters.type as Database['public']['Enums']['operation_type'])
      if (filters.from) q = q.gte('created_at', new Date(`${filters.from}T00:00:00`).toISOString())
      if (filters.to) {
        const nextDay = new Date(`${filters.to}T00:00:00`)
        nextDay.setDate(nextDay.getDate() + 1)
        q = q.lt('created_at', nextDay.toISOString())
      }
      const { data, count, error } = await q
      if (error) throw error
      return { rows: data as MovementRecord[], count: count ?? 0 }
    },
  })
}

export function useRegisterMovement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      key: string; type: MovementType; branchId: string; productId: string;
      qty: number; reason: string | null; reference: string | null
    }): Promise<MovementResult> => {
      const { data, error } = await supabase.rpc('register_movement', {
        p_key: input.key, p_type: input.type, p_branch_id: input.branchId,
        p_product_id: input.productId, p_qty: input.qty,
        p_reason: input.reason, p_reference: input.reference,
      })
      if (error) throw error
      return data as unknown as MovementResult
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventory'] })
      void qc.invalidateQueries({ queryKey: ['movements'] })
      void qc.invalidateQueries({ queryKey: ['home'] })
    },
  })
}

export function useReverseMovement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { key: string; movementId: string; reason: string }): Promise<MovementResult> => {
      const { data, error } = await supabase.rpc('reverse_movement', {
        p_key: input.key, p_movement_id: input.movementId, p_reason: input.reason,
      })
      if (error) throw error
      return data as unknown as MovementResult
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventory'] })
      void qc.invalidateQueries({ queryKey: ['movements'] })
      void qc.invalidateQueries({ queryKey: ['home'] })
    },
  })
}
