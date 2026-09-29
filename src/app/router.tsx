import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter } from 'react-router'
import { RequireAuth, RequireProfile, RequireRole } from './guards'
import { AppShell } from './layout/AppShell'
import { LoadingState } from '@/components/ui/States'

const LoginPage = lazy(() => import('@/features/auth/LoginPage').then((m) => ({ default: m.LoginPage })))
const RecuperarPage = lazy(() => import('@/features/auth/RecuperarPage').then((m) => ({ default: m.RecuperarPage })))
const RestablecerPage = lazy(() => import('@/features/auth/RestablecerPage').then((m) => ({ default: m.RestablecerPage })))
const SinPerfilPage = lazy(() => import('@/features/auth/SinPerfilPage').then((m) => ({ default: m.SinPerfilPage })))
const SucursalesPage = lazy(() => import('@/features/branches/SucursalesPage').then((m) => ({ default: m.SucursalesPage })))
const HomeRedirect = lazy(() => import('@/features/home/HomeRedirect').then((m) => ({ default: m.HomeRedirect })))
const InicioAdminPage = lazy(() => import('@/features/home/InicioAdminPage').then((m) => ({ default: m.InicioAdminPage })))
const InventarioPage = lazy(() => import('@/features/inventory/InventarioPage').then((m) => ({ default: m.InventarioPage })))
const ProductoDetallePage = lazy(() => import('@/features/inventory/ProductoDetallePage').then((m) => ({ default: m.ProductoDetallePage })))
const CatalogoPage = lazy(() => import('@/features/products/CatalogoPage').then((m) => ({ default: m.CatalogoPage })))
const ProductoFormPage = lazy(() => import('@/features/products/ProductoFormPage').then((m) => ({ default: m.ProductoFormPage })))
const UsuariosPage = lazy(() => import('@/features/users/UsuariosPage').then((m) => ({ default: m.UsuariosPage })))
const TransferenciasPage = lazy(() => import('@/features/transfers/TransferenciasPage').then((m) => ({ default: m.TransferenciasPage })))
const TableroPage = lazy(() => import('@/features/dashboard/TableroPage').then((m) => ({ default: m.TableroPage })))
const ConteosPage = lazy(() => import('@/features/counts/ConteosPage').then((m) => ({ default: m.ConteosPage })))
const ImportacionesPage = lazy(() => import('@/features/imports/ImportacionesPage').then((m) => ({ default: m.ImportacionesPage })))
const AuditoriaPage = lazy(() => import('@/features/audit/AuditoriaPage').then((m) => ({ default: m.AuditoriaPage })))
const ForbiddenPage = lazy(() => import('@/pages/ForbiddenPage').then((m) => ({ default: m.ForbiddenPage })))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })))

function page(content: ReactNode) {
  return <Suspense fallback={<LoadingState />}>{content}</Suspense>
}

export const router = createBrowserRouter([
  { path: '/login', element: page(<LoginPage />) },
  { path: '/auth/recuperar', element: page(<RecuperarPage />) },
  { path: '/auth/restablecer', element: page(<RestablecerPage />) },
  {
    element: <RequireAuth />,
    children: [
      { path: '/sin-perfil', element: page(<SinPerfilPage />) },
      {
        element: <RequireProfile />,
        children: [
          {
            element: <AppShell />,
            children: [
              { index: true, element: page(<HomeRedirect />) },
              { path: 'inventario', element: page(<InventarioPage />) },
              { path: 'inventario/:productId', element: page(<ProductoDetallePage />) },
              { path: 'transferencias', element: page(<TransferenciasPage />) },
              { path: 'conteos', element: page(<ConteosPage />) },
              {
                element: <RequireRole role="admin" />,
                children: [
                  { path: 'inicio', element: page(<InicioAdminPage />) },
                  { path: 'tablero', element: page(<TableroPage />) },
                  { path: 'importaciones', element: page(<ImportacionesPage />) },
                  { path: 'catalogo', element: page(<CatalogoPage />) },
                  { path: 'catalogo/nuevo', element: page(<ProductoFormPage />) },
                  { path: 'catalogo/:productId', element: page(<ProductoFormPage />) },
                  { path: 'sucursales', element: page(<SucursalesPage />) },
                  { path: 'usuarios', element: page(<UsuariosPage />) },
                  { path: 'auditoria', element: page(<AuditoriaPage />) },
                ],
              },
              { path: '403', element: page(<ForbiddenPage />) },
              { path: '*', element: page(<NotFoundPage />) },
            ],
          },
        ],
      },
    ],
  },
])
