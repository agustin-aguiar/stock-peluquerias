import { Link } from 'react-router'
import { PageHeader } from '@/components/ui/PageHeader'

export function ForbiddenPage() {
  return (
    <>
      <PageHeader eyebrow="403" title="No tenés permiso para ver esta pantalla" />
      <Link to="/" className="text-sm underline">
        Ir al inicio
      </Link>
    </>
  )
}
