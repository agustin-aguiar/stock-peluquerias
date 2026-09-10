import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCallback, useState, type ReactNode } from 'react'
import { ToastProvider } from '@/components/ui/Toast'
import { SessionProvider } from '@/features/auth/session'

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }),
  )
  const onSignedOut = useCallback(() => client.clear(), [client])
  return (
    <QueryClientProvider client={client}>
      <SessionProvider onSignedOut={onSignedOut}>
        <ToastProvider>{children}</ToastProvider>
      </SessionProvider>
    </QueryClientProvider>
  )
}
