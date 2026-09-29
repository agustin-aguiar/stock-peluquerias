import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
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

export function useAuditEvents(type: string, from: string, to: string, page: number) {
  return useQuery({
    queryKey: ['audit', type, from, to, page],
    enabled: !from || !to || from <= to,
    queryFn: async (): Promise<{ rows: AuditEvent[]; count: number; actors: Record<string, string> }> => {
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
      const [events, profiles] = await Promise.all([
        query,
        supabase.from('profiles').select('id, full_name'),
      ])
      if (events.error) throw events.error
      if (profiles.error) throw profiles.error
      return {
        rows: events.data as AuditEvent[],
        count: events.count ?? 0,
        actors: Object.fromEntries((profiles.data ?? []).map((p) => [p.id, p.full_name])),
      }
    },
  })
}
