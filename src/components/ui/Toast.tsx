import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type Kind = 'success' | 'error' | 'info'
type Toast = { id: number; kind: Kind; text: string }
type Ctx = { push: (t: { kind: Kind; text: string }) => void }

const ToastContext = createContext<Ctx | null>(null)

const tone: Record<Kind, string> = {
  success: 'bg-sage-bg text-sage-fg',
  error: 'bg-carmine-bg text-carmine-fg',
  info: 'bg-indigo-bg text-indigo-fg',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const push = useCallback((t: { kind: Kind; text: string }) => {
    const id = Date.now() + Math.random()
    setItems((prev) => [...prev, { ...t, id }])
    window.setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), 5000)
  }, [])
  return (
    <ToastContext value={{ push }}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="fixed right-4 bottom-20 z-50 flex flex-col gap-2 md:bottom-4"
      >
        {items.map((i) => (
          <div key={i.id} className={`rounded-control px-4 py-3 text-sm font-semibold shadow-lg ${tone[i.kind]}`}>
            {i.text}
          </div>
        ))}
      </div>
    </ToastContext>
  )
}

export function useToast(): Ctx {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider')
  return ctx
}
