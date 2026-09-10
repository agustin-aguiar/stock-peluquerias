import { createContext, useContext } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { useSession } from '@/features/auth/session'
import { useProfile } from '@/features/auth/useProfile'
import { messageFor } from '@/lib/errors'
import type { Profile, UserRole } from '@/types/models'

export function RequireAuth() {
  const { status } = useSession()
  const location = useLocation()
  if (status === 'loading') return <LoadingState label="Verificando sesión…" />
  if (status === 'signed_out') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return <Outlet />
}

const ProfileContext = createContext<Profile | null>(null)

export function RequireProfile() {
  const q = useProfile()
  if (q.isPending) return <LoadingState label="Cargando perfil…" />
  if (q.isError) return <ErrorState message={messageFor(q.error)} onRetry={() => void q.refetch()} />
  if (!q.data) return <Navigate to="/sin-perfil" replace />
  return (
    <ProfileContext value={q.data}>
      <Outlet />
    </ProfileContext>
  )
}

/** Perfil activo garantizado (solo dentro de RequireProfile). */
export function useCurrentProfile(): Profile {
  const p = useContext(ProfileContext)
  if (!p) throw new Error('useCurrentProfile debe usarse dentro de RequireProfile')
  return p
}

/** Ayuda visual: el servidor es quien realmente autoriza. */
export function RequireRole({ role }: { role: UserRole }) {
  const p = useCurrentProfile()
  if (p.role !== role) return <Navigate to="/403" replace />
  return <Outlet />
}
