import type { ReactNode } from 'react'
import { OfflineBanner } from '@/components/ui/OfflineBanner'

export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <OfflineBanner />
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-lg border border-hairline bg-surface p-6">
          <p className="label-caps text-muted">Stock Peluquerías</p>
          <h1 className="mt-1 mb-6 text-2xl font-bold">{title}</h1>
          {children}
        </div>
      </main>
    </div>
  )
}
