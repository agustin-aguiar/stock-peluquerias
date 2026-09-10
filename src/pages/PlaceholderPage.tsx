import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/States'

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState title="Disponible en la próxima versión" />
    </>
  )
}
