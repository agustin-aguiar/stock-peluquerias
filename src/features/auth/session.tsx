import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type SessionState = {
  status: 'loading' | 'signed_out' | 'signed_in'
  session: Session | null
}

const SessionContext = createContext<SessionState>({ status: 'loading', session: null })

export const SESSION_EXPIRED_FLAG = 'stock:sesion_vencida'
const LOGOUT_FLAG = 'stock:logout'

function safeStorage(fn: (s: Storage) => void) {
  try {
    fn(window.sessionStorage)
  } catch {
    /* sin storage (modo privado, etc.) */
  }
}

export function SessionProvider({ onSignedOut, children }: { onSignedOut?: () => void; children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading', session: null })

  useEffect(() => {
    let previous: SessionState['status'] = 'loading'
    void supabase.auth.getSession().then(({ data }) => {
      previous = data.session ? 'signed_in' : 'signed_out'
      setState({ status: previous, session: data.session })
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' && previous === 'signed_in') {
        safeStorage((s) => {
          if (!s.getItem(LOGOUT_FLAG)) s.setItem(SESSION_EXPIRED_FLAG, '1')
          s.removeItem(LOGOUT_FLAG)
        })
        onSignedOut?.()
      }
      previous = session ? 'signed_in' : 'signed_out'
      setState({ status: previous, session })
    })
    return () => sub.subscription.unsubscribe()
  }, [onSignedOut])

  return <SessionContext value={state}>{children}</SessionContext>
}

export function useSession(): SessionState {
  return useContext(SessionContext)
}

/** Cierre de sesión explícito: no se muestra "sesión vencida". */
export async function signOut() {
  safeStorage((s) => s.setItem(LOGOUT_FLAG, '1'))
  await supabase.auth.signOut()
}
