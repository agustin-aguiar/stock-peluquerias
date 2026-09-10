import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Branch } from '@/types/models'

export const branchKeys = { all: ['branches'] as const }

export function useBranches() {
  return useQuery({
    queryKey: branchKeys.all,
    staleTime: 60_000,
    queryFn: async (): Promise<Branch[]> => {
      const { data, error } = await supabase.from('branches').select('*').order('name')
      if (error) throw error
      return data
    },
  })
}
