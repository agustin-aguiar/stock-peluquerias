import type { ReactNode } from 'react'
import { CircleAlert } from 'lucide-react'
import { Button } from './Button'

export function LoadingState({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 p-6 text-sm text-muted">
      <span className="size-4 animate-spin rounded-full border-2 border-hairline border-t-ink" aria-hidden />
      {label}
    </div>
  )
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-hairline bg-surface p-8 text-center">
      <p className="font-semibold">{title}</p>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-carmine-fg/30 bg-carmine-bg p-4 text-sm text-carmine-fg">
      <p className="flex items-center gap-2 font-semibold">
        <CircleAlert size={16} aria-hidden /> {message}
      </p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  )
}
