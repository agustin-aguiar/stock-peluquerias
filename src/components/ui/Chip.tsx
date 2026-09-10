import type { ReactNode } from 'react'

type Tone = 'amber' | 'indigo' | 'carmine' | 'sage' | 'neutral'

const tones: Record<Tone, string> = {
  amber: 'bg-amber-bg text-amber-fg',
  indigo: 'bg-indigo-bg text-indigo-fg',
  carmine: 'bg-carmine-bg text-carmine-fg',
  sage: 'bg-sage-bg text-sage-fg',
  neutral: 'border border-hairline bg-canvas text-muted',
}

export function Chip({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`label-caps inline-flex items-center rounded-full px-2.5 py-1 ${tones[tone]}`}>
      {children}
    </span>
  )
}
