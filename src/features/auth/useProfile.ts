import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/models'
import { useSession } from './session'

export const profileKey = (userId: string | undefined) => ['profile', userId] as const

/** Perfil del usuario autenticado. `null` si no tiene perfil o está inactivo (RLS lo oculta). */
export function useProfile() {
  const { session } = useSession()
  const userId = session?.user.id
  return useQuery({
    queryKey: profileKey(userId),
    enabled: Boolean(userId),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('auth_user_id', userId!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}
