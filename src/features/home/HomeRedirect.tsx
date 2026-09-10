import { Navigate } from 'react-router'
import { useCurrentProfile } from '@/app/guards'

export function HomeRedirect() {
  const p = useCurrentProfile()
  return <Navigate to={p.role === 'admin' ? '/inicio' : '/inventario'} replace />
}
