import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { UnitKind } from '@/lib/quantity'
import type { Json } from '@/types/database'

export const AUDIT_PAGE_SIZE = 30

export type AuditEvent = {
  id: string
  actor_profile_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  old_values: Json | null
  new_values: Json | null
  created_at: string
}

export type AuditLookups = {
  actors: Record<string, string>
  branches: Record<string, string>
  products: Record<string, { name: string; sku: string; unit: UnitKind }>
  transfers: Record<string, { product_id: string; from_branch_id: string; to_branch_id: string; qty: number }>
}

export function useAuditEvents(type: string, from: string, to: string, page: number) {
  return useQuery({
    queryKey: ['audit', type, from, to, page],
    enabled: !from || !to || from <= to,
    queryFn: async (): Promise<{ rows: AuditEvent[]; count: number; lookups: AuditLookups }> => {
      let query = supabase.from('audit_events')
        .select('id, actor_profile_id, action, entity_type, entity_id, old_values, new_values, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(page * AUDIT_PAGE_SIZE, (page + 1) * AUDIT_PAGE_SIZE - 1)
      if (type) query = query.eq('entity_type', type)
      if (from) query = query.gte('created_at', new Date(`${from}T00:00:00`).toISOString())
      if (to) {
        const end = new Date(`${to}T00:00:00`)
        end.setDate(end.getDate() + 1)
        query = query.lt('created_at', end.toISOString())
      }
      const [events, profiles, branches, products] = await Promise.all([
        query,
        supabase.from('profiles').select('id, full_name'),
        supabase.from('branches').select('id, name'),
        supabase.from('products').select('id, name, sku, unit'),
      ])
      if (events.error) throw events.error
      if (profiles.error) throw profiles.error
      if (branches.error) throw branches.error
      if (products.error) throw products.error
      const rows = (events.data ?? []) as AuditEvent[]
      const transferIds = rows.filter((event) => event.entity_type === 'transfer' && event.entity_id)
        .map((event) => event.entity_id as string)
      const transfers = transferIds.length
        ? await supabase.from('transfers').select('id, product_id, from_branch_id, to_branch_id, qty').in('id', transferIds)
        : { data: [], error: null }
      if (transfers.error) throw transfers.error
      return {
        rows,
        count: events.count ?? 0,
        lookups: {
          actors: Object.fromEntries((profiles.data ?? []).map((p) => [p.id, p.full_name])),
          branches: Object.fromEntries((branches.data ?? []).map((branch) => [branch.id, branch.name])),
          products: Object.fromEntries((products.data ?? []).map((product) => [product.id, product])),
          transfers: Object.fromEntries((transfers.data ?? []).map((transfer) => [transfer.id, transfer])),
        },
      }
    },
  })
}
