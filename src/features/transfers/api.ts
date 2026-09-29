import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

type TransferRow = Database['public']['Tables']['transfers']['Row']
export type TransferView = TransferRow & {
  product: { name: string; sku: string; unit: 'unit' | 'ml' | 'g' } | null
  origin: { name: string; code: string } | null
  destination: { name: string; code: string } | null
}
export type TransferAction =
  | { kind: 'create'; id: string; productId: string; fromBranchId: string; toBranchId: string; qty: number; shippingRef: string | null }
  | { kind: 'cancel'; transferId: string }
  | { kind: 'dispatch' | 'receive'; key: string; transferId: string }
  | { kind: 'dispute'; transferId: string; note: string }
  | { kind: 'resolve'; key: string; transferId: string; received: number; returned: number; lost: number; note: string }

export function useTransfers(status: string) {
  return useQuery({
    queryKey: ['transfers', status],
    queryFn: async (): Promise<TransferView[]> => {
      let q = supabase.from('transfers').select('*, product:products(name, sku, unit), origin:branches!transfers_from_branch_id_fkey(name, code), destination:branches!transfers_to_branch_id_fkey(name, code)')
        .order('created_at', { ascending: false }).limit(200)
      if (status !== 'all') q = q.eq('status', status as TransferRow['status'])
      const { data, error } = await q
      if (error) throw error
      return data as TransferView[]
    },
  })
}

export function useTransferAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (action: TransferAction) => {
      if (action.kind === 'create') {
        const { data, error } = await supabase.rpc('create_transfer', {
          p_id: action.id, p_product_id: action.productId, p_from_branch_id: action.fromBranchId,
          p_to_branch_id: action.toBranchId, p_qty: action.qty, p_shipping_ref: action.shippingRef,
        })
        if (error) throw error
        return data
      }
      if (action.kind === 'cancel') {
        const { data, error } = await supabase.rpc('cancel_transfer', { p_transfer_id: action.transferId })
        if (error) throw error
        return data
      }
      if (action.kind === 'dispute') {
        const { data, error } = await supabase.rpc('report_transfer_difference', { p_transfer_id: action.transferId, p_note: action.note })
        if (error) throw error
        return data
      }
      if (action.kind === 'dispatch' || action.kind === 'receive') {
        const rpc = action.kind === 'dispatch' ? 'dispatch_transfer' : 'receive_transfer'
        const { data, error } = await supabase.rpc(rpc, { p_key: action.key, p_transfer_id: action.transferId })
        if (error) throw error
        return data
      }
      if (action.kind !== 'resolve') throw new Error('Acción de transferencia inválida')
      const { data, error } = await supabase.rpc('resolve_transfer', {
        p_key: action.key, p_transfer_id: action.transferId,
        p_qty_received: action.received, p_qty_returned: action.returned,
        p_qty_lost: action.lost, p_note: action.note,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['transfers'] })
      void qc.invalidateQueries({ queryKey: ['inventory'] })
      void qc.invalidateQueries({ queryKey: ['movements'] })
    },
  })
}
