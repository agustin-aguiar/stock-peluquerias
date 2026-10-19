import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useCurrentProfile } from '@/app/guards'
import type { Database } from '@/types/database'

export type StockRequest = Database['public']['Tables']['stock_requests']['Row']

export function useStockRequests() {
  const profile = useCurrentProfile()
  return useQuery({
    queryKey: ['stock-requests', profile.id],
    queryFn: async (): Promise<StockRequest[]> => {
      // RLS ya limita las filas a lo que cada perfil puede ver. Se traen todos
      // los pedidos abiertos y el historial reciente.
      const [open, recent] = await Promise.all([
        supabase.from('stock_requests').select('*')
          .in('status', ['pending_admin', 'pending_source', 'declined'])
          .order('requested_at', { ascending: false }),
        supabase.from('stock_requests').select('*')
          .order('requested_at', { ascending: false }).limit(100),
      ])
      if (open.error) throw open.error
      if (recent.error) throw recent.error
      return [...new Map([...open.data, ...recent.data].map((row) => [row.id, row])).values()]
    },
    retry: false,
    refetchInterval: (query) => query.state.status === 'error' ? false : 30_000,
  })
}

export function useRequestTransferStatuses(transferIds: string[]) {
  return useQuery({
    queryKey: ['stock-request-transfers', transferIds],
    queryFn: async (): Promise<{ id: string; status: string }[]> => {
      if (!transferIds.length) return []
      const { data, error } = await supabase.from('transfers').select('id, status').in('id', transferIds)
      if (error) throw error
      return data
    },
    refetchInterval: 30_000,
  })
}

type Action =
  | { kind: 'request'; id: string; productId: string; qty: number; note: string | null }
  | { kind: 'review'; id: string; sourceBranchId: string | null; reason: string | null }
  | { kind: 'decide'; id: string; accept: boolean; reason: string | null }

export function useStockRequestAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (action: Action) => {
      if (action.kind === 'request') {
        const { data, error } = await supabase.rpc('request_stock', {
          p_id: action.id, p_product_id: action.productId, p_qty: action.qty, p_note: action.note,
        })
        if (error) throw error
        return data
      }
      if (action.kind === 'review') {
        const { data, error } = await supabase.rpc('review_stock_request', {
          p_request_id: action.id, p_source_branch_id: action.sourceBranchId, p_reason: action.reason,
        })
        if (error) throw error
        return data
      }
      const { data, error } = await supabase.rpc('decide_stock_request', {
        p_request_id: action.id, p_accept: action.accept, p_reason: action.reason,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['stock-requests'] })
      void qc.invalidateQueries({ queryKey: ['inventory'] })
      void qc.invalidateQueries({ queryKey: ['transfers'] })
      void qc.invalidateQueries({ queryKey: ['stock-request-transfers'] })
      void qc.invalidateQueries({ queryKey: ['home'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
