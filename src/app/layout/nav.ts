import { Boxes, ChartNoAxesCombined, ClipboardList, FileSpreadsheet, House, Package, Store, Truck, Users, type LucideIcon } from 'lucide-react'

export type NavItem = { to: string; label: string; icon: LucideIcon; adminOnly?: boolean }

export const NAV: NavItem[] = [
  { to: '/inicio', label: 'Inicio', icon: House, adminOnly: true },
  { to: '/tablero', label: 'Tablero', icon: ChartNoAxesCombined, adminOnly: true },
  { to: '/inventario', label: 'Inventario', icon: Boxes },
  { to: '/transferencias', label: 'Transferencias', icon: Truck },
  { to: '/conteos', label: 'Conteos', icon: ClipboardList },
  { to: '/importaciones', label: 'Importar/Exportar', icon: FileSpreadsheet, adminOnly: true },
  { to: '/catalogo', label: 'Catálogo', icon: Package, adminOnly: true },
  { to: '/sucursales', label: 'Sucursales', icon: Store, adminOnly: true },
  { to: '/usuarios', label: 'Usuarios', icon: Users, adminOnly: true },
]
