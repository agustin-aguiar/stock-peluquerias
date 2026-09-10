import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const styles: Record<Variant, string> = {
  primary: 'bg-ink text-white hover:bg-ink-hover disabled:bg-ink/40',
  secondary: 'border border-hairline bg-surface text-ink hover:bg-canvas disabled:text-muted',
  danger: 'bg-carmine-fg text-white hover:opacity-90 disabled:opacity-50',
  ghost: 'text-ink hover:bg-canvas disabled:text-muted',
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }

export function Button({ variant = 'primary', className = '', type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-control px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...rest}
    />
  )
}
