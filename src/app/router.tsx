import { createBrowserRouter } from 'react-router'
import { RequireAuth, RequireProfile, RequireRole } from './guards'
import { AppShell } from './layout/AppShell'
import { LoginPage } from '@/features/auth/LoginPage'
import { RecuperarPage } from '@/features/auth/RecuperarPage'
import { RestablecerPage } from '@/features/auth/RestablecerPage'
import { SinPerfilPage } from '@/features/auth/SinPerfilPage'
import { SucursalesPage } from '@/features/branches/SucursalesPage'
import { HomeRedirect } from '@/features/home/HomeRedirect'
import { InicioAdminPage } from '@/features/home/InicioAdminPage'
import { InventarioPage } from '@/features/inventory/InventarioPage'
import { ProductoDetallePage } from '@/features/inventory/ProductoDetallePage'
import { CatalogoPage } from '@/features/products/CatalogoPage'
import { ProductoFormPage } from '@/features/products/ProductoFormPage'
import { UsuariosPage } from '@/features/users/UsuariosPage'
import { TransferenciasPage } from '@/features/transfers/TransferenciasPage'
import { TableroPage } from '@/features/dashboard/TableroPage'
import { ConteosPage } from '@/features/counts/ConteosPage'
import { ImportacionesPage } from '@/features/imports/ImportacionesPage'
import { AuditoriaPage } from '@/features/audit/AuditoriaPage'
import { ForbiddenPage } from '@/pages/ForbiddenPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/auth/recuperar', element: <RecuperarPage /> },
  { path: '/auth/restablecer', element: <RestablecerPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/sin-perfil', element: <SinPerfilPage /> },
      {
        element: <RequireProfile />,
        children: [
          {
            element: <AppShell />,
            children: [
              { index: true, element: <HomeRedirect /> },
              { path: 'inventario', element: <InventarioPage /> },
              { path: 'inventario/:productId', element: <ProductoDetallePage /> },
              { path: 'transferencias', element: <TransferenciasPage /> },
              { path: 'conteos', element: <ConteosPage /> },
              {
                element: <RequireRole role="admin" />,
                children: [
                  { path: 'inicio', element: <InicioAdminPage /> },
                  { path: 'tablero', element: <TableroPage /> },
                  { path: 'importaciones', element: <ImportacionesPage /> },
                  { path: 'catalogo', element: <CatalogoPage /> },
                  { path: 'catalogo/nuevo', element: <ProductoFormPage /> },
                  { path: 'catalogo/:productId', element: <ProductoFormPage /> },
                  { path: 'sucursales', element: <SucursalesPage /> },
                  { path: 'usuarios', element: <UsuariosPage /> },
                  { path: 'auditoria', element: <AuditoriaPage /> },
                ],
              },
              { path: '403', element: <ForbiddenPage /> },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
])
