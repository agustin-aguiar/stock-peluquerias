import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type BranchSummary = { enabled: number; belowMin: number; uninitialized: number }

export function useInventorySummary() {
  return useQuery({
    queryKey: ['inventory', 'summary'],
    queryFn: async (): Promise<Record<string, BranchSummary>> => {
      const { data, error } = await supabase
        .from('inventory_status')
        .select('branch_id, below_min, initialized_at')
        .eq('product_active', true)
        .limit(5000)
      if (error) throw error
      const out: Record<string, BranchSummary> = {}
      for (const r of data) {
        const id = r.branch_id ?? ''
        const s = (out[id] ??= { enabled: 0, belowMin: 0, uninitialized: 0 })
        s.enabled += 1
        if (r.below_min) s.belowMin += 1
        if (!r.initialized_at) s.uninitialized += 1
      }
      return out
    },
  })
}

export function useOpenAlertCount() {
  return useQuery({
    queryKey: ['inventory', 'alerts', 'open'],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase.from('alerts').select('branch_id').eq('status', 'open').limit(5000)
      if (error) throw error
      const out: Record<string, number> = {}
      for (const r of data) out[r.branch_id] = (out[r.branch_id] ?? 0) + 1
      return out
    },
  })
}
