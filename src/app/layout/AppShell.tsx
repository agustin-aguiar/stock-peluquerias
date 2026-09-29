import { useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import { LogOut, Menu } from 'lucide-react'
import { OfflineBanner } from '@/components/ui/OfflineBanner'
import { Dialog } from '@/components/ui/Dialog'
import { useCurrentProfile } from '@/app/guards'
import { signOut } from '@/features/auth/session'
import { ActiveBranchProvider } from '@/features/branches/activeBranch'
import { ROLE_LABEL } from '@/types/models'
import { BranchPill } from './BranchPill'
import { NAV, type NavItem } from './nav'

function SideLink({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-control px-3 py-2 text-sm font-semibold ${isActive ? 'bg-ink text-white' : 'text-ink hover:bg-canvas'}`
      }
    >
      <Icon size={18} aria-hidden /> {item.label}
    </NavLink>
  )
}

function BottomLink({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${isActive ? 'text-ink' : 'text-muted'}`
      }
    >
      <Icon size={20} aria-hidden />
      {item.label}
    </NavLink>
  )
}

export function AppShell() {
  const profile = useCurrentProfile()
  const [moreOpen, setMoreOpen] = useState(false)
  const items = NAV.filter((i) => !i.adminOnly || profile.role === 'admin')
  const primaryPaths = profile.role === 'admin'
    ? ['/inicio', '/inventario', '/transferencias']
    : ['/inventario', '/transferencias', '/conteos']
  const primaryItems = items.filter((i) => primaryPaths.includes(i.to))
  const moreItems = items.filter((i) => !primaryPaths.includes(i.to))
  return (
    <ActiveBranchProvider>
      <div className="min-h-dvh md:grid md:grid-cols-[16rem_1fr]">
        <aside className="hidden border-r border-hairline bg-surface p-4 md:flex md:flex-col md:gap-1">
          <p className="label-caps mb-3 px-3 text-muted">Stock Peluquerías</p>
          {items.map((i) => (
            <SideLink key={i.to} item={i} />
          ))}
        </aside>
        <div className="flex min-h-dvh flex-col">
          <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-hairline bg-surface/95 px-4 py-3 backdrop-blur">
            <span className="font-bold md:hidden">Stock</span>
            <BranchPill />
            <div className="ml-auto flex items-center gap-3 text-sm">
              <span className="hidden sm:block">
                <span className="font-semibold">{profile.full_name}</span>{' '}
                <span className="text-muted">· {ROLE_LABEL[profile.role]}</span>
              </span>
              <button
                type="button"
                onClick={() => void signOut()}
                className="inline-flex items-center gap-1 rounded-control border border-hairline px-2 py-1 text-sm hover:bg-canvas"
              >
                <LogOut size={16} aria-hidden /> Salir
              </button>
            </div>
          </header>
          <OfflineBanner />
          <main className="mx-auto w-full max-w-7xl flex-1 p-4 pb-24 md:p-6 md:pb-6">
            <Outlet />
          </main>
          <nav
            aria-label="Navegación principal"
            className="fixed inset-x-0 bottom-0 z-10 flex border-t border-hairline bg-surface md:hidden"
          >
            {primaryItems.map((i) => (
              <BottomLink key={i.to} item={i} />
            ))}
            {moreItems.length > 0 && <button type="button" onClick={() => setMoreOpen(true)}
              aria-label="Más secciones" className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold text-muted">
              <Menu size={20} aria-hidden />Más
            </button>}
          </nav>
          <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title="Más secciones">
            <nav aria-label="Más secciones" className="grid grid-cols-2 gap-2">
              {moreItems.map((item) => <NavLink key={item.to} to={item.to} onClick={() => setMoreOpen(false)}
                className="flex min-h-12 items-center gap-2 rounded-control border border-hairline px-3 text-sm font-semibold hover:bg-canvas">
                <item.icon size={18} aria-hidden />{item.label}
              </NavLink>)}
            </nav>
          </Dialog>
        </div>
      </div>
    </ActiveBranchProvider>
  )
}
