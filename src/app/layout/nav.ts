import { Boxes, House, Package, Store, Users, type LucideIcon } from 'lucide-react'

export type NavItem = { to: string; label: string; icon: LucideIcon; adminOnly?: boolean }

export const NAV: NavItem[] = [
  { to: '/inicio', label: 'Inicio', icon: House, adminOnly: true },
  { to: '/inventario', label: 'Inventario', icon: Boxes },
  { to: '/catalogo', label: 'Catálogo', icon: Package, adminOnly: true },
  { to: '/sucursales', label: 'Sucursales', icon: Store, adminOnly: true },
  { to: '/usuarios', label: 'Usuarios', icon: Users, adminOnly: true },
]
