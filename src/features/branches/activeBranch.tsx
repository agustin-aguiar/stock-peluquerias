import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { useCurrentProfile } from '@/app/guards'

export type ActiveBranchId = string | 'all'
type Ctx = { branchId: ActiveBranchId; setBranchId: (id: ActiveBranchId) => void; canChange: boolean }

const ActiveBranchContext = createContext<Ctx | null>(null)
const STORAGE_KEY = 'stock:sucursal-activa'

function readStored(): ActiveBranchId {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? 'all'
  } catch {
    return 'all'
  }
}

/** Operador: fija a su sucursal. Admin: elige una o "all" (comparar), recordado en localStorage. */
export function ActiveBranchProvider({ children }: { children: ReactNode }) {
  const profile = useCurrentProfile()
  const [stored, setStored] = useState<ActiveBranchId>(readStored)
  const setBranchId = useCallback((id: ActiveBranchId) => {
    setStored(id)
    try {
      window.localStorage.setItem(STORAGE_KEY, id)
    } catch {
      /* sin storage */
    }
  }, [])
  const isOperator = profile.role === 'operator'
  const value: Ctx = {
    branchId: isOperator ? (profile.branch_id as string) : stored,
    setBranchId,
    canChange: !isOperator,
  }
  return <ActiveBranchContext value={value}>{children}</ActiveBranchContext>
}

export function useActiveBranch(): Ctx {
  const ctx = useContext(ActiveBranchContext)
  if (!ctx) throw new Error('useActiveBranch debe usarse dentro de ActiveBranchProvider')
  return ctx
}
