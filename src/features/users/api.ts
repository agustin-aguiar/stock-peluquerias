import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Profile, UserRole } from '@/types/models'

export const profileKeys = { all: ['profiles'] as const }

export function useProfiles() {
  return useQuery({
    queryKey: profileKeys.all,
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase.from('profiles').select('*').order('full_name')
      if (error) throw error
      return data
    },
  })
}

export function useCreateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { email: string; full_name: string; role: UserRole; branch_id: string | null }) => {
      const { data, error } = await supabase.rpc('create_profile', {
        p_email: input.email,
        p_full_name: input.full_name,
        p_role: input.role,
        p_branch_id: input.branch_id ?? undefined,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: profileKeys.all }),
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      full_name: string
      role: UserRole
      branch_id: string | null
      is_active: boolean
    }) => {
      const { data, error } = await supabase.rpc('update_profile', {
        p_id: input.id,
        p_full_name: input.full_name,
        p_role: input.role,
        p_branch_id: input.branch_id ?? undefined,
        p_is_active: input.is_active,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: profileKeys.all })
      void qc.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}
