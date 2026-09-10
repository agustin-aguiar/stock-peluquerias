import { Link } from 'react-router'
import { PageHeader } from '@/components/ui/PageHeader'

export function NotFoundPage() {
  return (
    <>
      <PageHeader eyebrow="404" title="La página no existe" />
      <Link to="/" className="text-sm underline">
        Ir al inicio
      </Link>
    </>
  )
}
