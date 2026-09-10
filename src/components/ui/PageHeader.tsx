import type { ReactNode } from 'react'

type Props = { eyebrow?: string; title: string; description?: string; actions?: ReactNode }

export function PageHeader({ eyebrow, title, description, actions }: Props) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="label-caps text-muted">{eyebrow}</p>}
        <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
