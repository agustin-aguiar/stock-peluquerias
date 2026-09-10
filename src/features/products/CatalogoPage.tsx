import { useState } from 'react'
import { Link } from 'react-router'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { messageFor } from '@/lib/errors'
import { UNIT_LABEL } from '@/lib/quantity'
import { useProducts } from './api'

export function CatalogoPage() {
  const [search, setSearch] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const products = useProducts({ search, includeInactive })

  return (
    <>
      <PageHeader
        eyebrow="Catálogo"
        title="Productos"
        description="Catálogo compartido por toda la cadena."
        actions={
          <Link to="/catalogo/nuevo">
            <Button>
              <Plus size={16} aria-hidden /> Nuevo producto
            </Button>
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div className="relative w-full max-w-sm">
          <Input label="Buscar" placeholder="Nombre o SKU" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          <Search size={16} className="pointer-events-none absolute bottom-3 left-3 text-muted" aria-hidden />
        </div>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
          Mostrar inactivos
        </label>
      </div>
      {products.isPending && <LoadingState />}
      {products.isError && <ErrorState message={messageFor(products.error)} onRetry={() => void products.refetch()} />}
      {products.data && products.data.length === 0 && (
        <EmptyState title={search ? 'Sin resultados' : 'Todavía no hay productos'} description={search ? 'Probá con otro nombre o SKU.' : undefined} />
      )}
      {products.data && products.data.length > 0 && (
        <>
          <table className="hidden w-full border-collapse text-sm md:table">
            <thead>
              <tr className="label-caps text-left text-muted">
                <th className="py-2 pr-4">SKU</th>
                <th className="py-2 pr-4">Producto</th>
                <th className="py-2 pr-4">Marca / categoría</th>
                <th className="py-2 pr-4">Unidad</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.data.map((p) => (
                <tr key={p.id} className="border-t border-hairline hover:bg-canvas">
                  <td className="py-3 pr-4 font-semibold tnum">{p.sku}</td>
                  <td className="py-3 pr-4">
                    {p.name}
                    {p.variant && <span className="text-muted"> · {p.variant}</span>}
                  </td>
                  <td className="py-3 pr-4 text-muted">{[p.brand, p.category].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="py-3 pr-4">{UNIT_LABEL[p.unit]}</td>
                  <td className="py-3 pr-4">
                    <Chip tone={p.is_active ? 'sage' : 'neutral'}>{p.is_active ? 'Activo' : 'Inactivo'}</Chip>
                  </td>
                  <td className="py-3 text-right">
                    <Link to={`/catalogo/${p.id}`} className="text-sm underline">
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="flex flex-col gap-3 md:hidden">
            {products.data.map((p) => (
              <li key={p.id} className="rounded-lg border border-hairline bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="label-caps text-muted tnum">{p.sku}</p>
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-sm text-muted">{[p.brand, p.category].filter(Boolean).join(' · ') || '—'} · {UNIT_LABEL[p.unit]}</p>
                  </div>
                  <Chip tone={p.is_active ? 'sage' : 'neutral'}>{p.is_active ? 'Activo' : 'Inactivo'}</Chip>
                </div>
                <Link to={`/catalogo/${p.id}`} className="mt-3 inline-block text-sm underline">
                  Editar
                </Link>
              </li>
            ))}
          </ul>
          {products.data.length === 500 && <p className="mt-3 text-xs text-muted">Se muestran los primeros 500. Refiná la búsqueda.</p>}
        </>
      )}
    </>
  )
}
