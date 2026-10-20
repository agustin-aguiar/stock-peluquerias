import { Boxes, ClipboardCheck, ChartNoAxesCombined, CircleHelp, ClipboardList, FileSpreadsheet, History, House, Package, Send, Store, Truck, Users, type LucideIcon } from 'lucide-react'

/** `short` es la etiqueta de la barra inferior del celular, donde el espacio es poco. */
export type NavItem = { to: string; label: string; short?: string; icon: LucideIcon; adminOnly?: boolean }

export const NAV: NavItem[] = [
  { to: '/inicio', label: 'Inicio', icon: House, adminOnly: true },
  { to: '/tablero', label: 'Tablero', icon: ChartNoAxesCombined, adminOnly: true },
  { to: '/inventario', label: 'Inventario', icon: Boxes },
  { to: '/cierre', label: 'Cierre de turno', short: 'Cierre', icon: ClipboardCheck },
  { to: '/solicitudes', label: 'Pedidos de stock', short: 'Pedidos', icon: Send },
  { to: '/transferencias', label: 'Envíos entre locales', short: 'Envíos', icon: Truck },
  { to: '/conteos', label: 'Conteo físico', icon: ClipboardList },
  { to: '/importaciones', label: 'Archivos CSV', icon: FileSpreadsheet, adminOnly: true },
  { to: '/catalogo', label: 'Catálogo', icon: Package, adminOnly: true },
  { to: '/sucursales', label: 'Sucursales', icon: Store, adminOnly: true },
  { to: '/usuarios', label: 'Usuarios', icon: Users, adminOnly: true },
  { to: '/auditoria', label: 'Auditoría', icon: History, adminOnly: true },
  { to: '/ayuda', label: 'Cómo usarlo', icon: CircleHelp },
]
