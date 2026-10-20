type Stat = { label: string; value: number; tone?: 'amber' | 'carmine' }

const toneClass = { amber: 'text-amber-fg', carmine: 'text-carmine-fg' }

/** Fila de cifras con etiqueta corta arriba. Se usa en las tarjetas de cada local. */
export function Stats({ items }: { items: Stat[] }) {
  return (
    <dl className="grid grid-cols-3 gap-3 border-t border-hairline pt-3 tnum">
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-xs text-muted">{item.label}</dt>
          <dd className={`text-2xl font-bold leading-tight ${item.value > 0 && item.tone ? toneClass[item.tone] : ''}`}>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
