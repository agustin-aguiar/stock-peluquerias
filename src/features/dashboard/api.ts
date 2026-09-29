import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type BranchMetric = { branch_id: string; branch_name: string; below_min: number; zero_balance: number; open_transfers: number }
export type UsageMetric = {
  product_id: string; product_name: string; sku: string; unit: 'unit' | 'ml' | 'g';
  branch_id: string; branch_name: string; consumption: number | null; shrinkage: number | null
}
export type DashboardSnapshot = { branches: BranchMetric[]; usage: UsageMetric[] }

export function useDashboardSnapshot(from: string, to: string) {
  return useQuery({
    queryKey: ['dashboard', from, to],
    enabled: Boolean(from && to && from <= to),
    queryFn: async (): Promise<DashboardSnapshot> => {
      const end = new Date(`${to}T00:00:00`)
      end.setDate(end.getDate() + 1)
      const { data, error } = await supabase.rpc('dashboard_snapshot', {
        p_from: new Date(`${from}T00:00:00`).toISOString(), p_to: end.toISOString(),
      })
      if (error) throw error
      return data as DashboardSnapshot
    },
  })
}
