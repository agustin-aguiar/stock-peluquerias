import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

export function useCreateBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { code: string; name: string }): Promise<Branch> => {
      const { data, error } = await supabase.rpc('create_branch', { p_code: input.code, p_name: input.name })
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: branchKeys.all }),
  })
}

export function useUpdateBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; name: string; is_active: boolean }): Promise<Branch> => {
      const { data, error } = await supabase.rpc('update_branch', {
        p_id: input.id,
        p_name: input.name,
        p_is_active: input.is_active,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: branchKeys.all }),
  })
}
