# Stock Peluquerías

Control de stock para una cadena de peluquerías con varias sucursales. Proyecto académico (IET, ORT Uruguay, 2026).
Aplicación web (React + Vite) sobre Supabase (PostgreSQL, Auth, RLS). Las escrituras pasan solo por funciones PostgreSQL que validan rol, sucursal y cantidades y registran auditoría.

Estado: SP1–SP3 implementados; SP4 incluye tablero, conteos físicos y CSV. Inventario permite asignar stock directamente a una sucursal: habilita el producto y registra saldo inicial o ingreso en una sola operación. C7 comenzó con una prueba de tercera sucursal, una vista de auditoría y navegación móvil mejorada. El resumen diario de stock bajo usa Brevo y admite un destinatario explícito por cadena; consultar `docs/operacion.md` para configuración y comprobación de entrega. Las invitaciones por email desde la app siguen pendientes. Ver `docs/referencia/plan-v1.md` y `docs/bitacora.md`.

Para ensayar la entrega: `docs/demo-10-minutos.md`.

- Repositorio: https://github.com/agustin-aguiar/stock-peluquerias
- Aplicación publicada: https://stock-peluquerias.vercel.app (cada push a `main` despliega automáticamente)

## Requisitos

- Node.js 22.12 o superior (probado con 24).
- Cuenta de Supabase con un proyecto creado y la CLI enlazada (`docs/operacion.md`).

## Instalación

```bash
npm install
cp .env.example .env.local        # completar con URL y anon key del proyecto
```

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en http://localhost:5173 |
| `npm run build` | Typecheck + build de producción en `dist/` |
| `npm test` | Pruebas unitarias (sin red) |
| `npm run test:db` | Pruebas de integración contra Supabase (`.env.test.local`) |
| `npm run db:push` | Aplica migraciones pendientes al proyecto enlazado |
| `npm run db:seed` | Aplica migraciones + `supabase/seed.sql` (cadena demo) |
| `npm run db:types` | Regenera `src/types/database.ts` |
| `npm run lint` / `npm run format` | ESLint / Prettier |

## Estructura

- `src/features/*`: una carpeta por área (auth, branches, users, products, inventory, transfers, counts, dashboard, imports, home).
- `src/components/ui`: primitivas del design system.
- `src/lib`: cliente Supabase, cantidades, errores, validación.
- `supabase/migrations`: esquema, RLS y RPC en orden. `supabase/seed.sql`: datos demo.
- `tests/unit`, `tests/db`: pruebas.
- `docs/`: spec, plan, operación, decisiones, bitácora, material de referencia.

## Usuarios demo

Perfiles del seed: `admin@example.com` (administrador), `centro@example.com` y `pocitos@example.com` (operadores). Las contraseñas se definen al crear las cuentas en Supabase (ver `docs/operacion.md`); no viven en el repositorio.
