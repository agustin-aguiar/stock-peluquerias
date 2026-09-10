import { useId, type SelectHTMLAttributes } from 'react'

type Option = { value: string; label: string }
type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  options: Option[]
  placeholder?: string
  error?: string
}

export function Select({ label, options, placeholder, error, id, className = '', ...rest }: Props) {
  const autoId = useId()
  const selectId = id ?? autoId
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={selectId} className="text-sm font-semibold">
        {label}
      </label>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${selectId}-err` : undefined}
        className={`h-10 rounded-control border bg-surface px-3 text-sm ${error ? 'border-carmine-fg' : 'border-hairline'} ${className}`}
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${selectId}-err`} role="alert" className="text-xs text-carmine-fg">
          {error}
        </p>
      )}
    </div>
  )
}
