# ADR-001: Supabase cloud, escrituras solo por RPC, SPA con Vite

**Fecha:** 2026-09-10 · **Estado:** aceptada · **Responsable:** equipo

## Contexto

El plan (§11) propone React + Vite, Supabase (PostgreSQL, Auth, RLS) y Vercel. Hay que decidir dónde vive la lógica de negocio y cómo se ejecuta el backend en desarrollo sin Docker en las máquinas del equipo.

## Decisión

1. **Supabase cloud (proyecto gratuito)** para desarrollo y demo; migraciones versionadas en `supabase/migrations` aplicadas con la CLI enlazada.
2. **Toda escritura pasa por funciones PostgreSQL `SECURITY DEFINER`** que validan sesión, rol, cadena, sucursal y cantidades, y registran auditoría en la misma transacción. No hay políticas RLS de escritura y se revocan `INSERT/UPDATE/DELETE` a `anon` y `authenticated`.
3. **Lecturas bajo RLS** por cadena y sucursal, con vistas `inventory_status` (security invoker) y `profiles_public` (única vista privilegiada, sin email).
4. **SPA React 19 + Vite + Tailwind**, sin SSR ni Edge Functions.

## Alternativas descartadas

- RLS para CRUD y RPC solo para inventario: dos patrones conviviendo y auditoría por triggers.
- Edge Functions como capa API: más despliegue y latencia; contradice "lógica cerca de los datos".
- Supabase local con Docker: reproducible pero requiere instalación que el equipo no tiene.

## Consecuencias

- Más SQL al inicio; a cambio, un solo punto de validación reutilizable por movimientos (SP2) y transferencias (SP3).
- Las pruebas críticas (permisos, idempotencia) se ejecutan contra la base real con una cadena temporal.
- Cambiar de proveedor implica portar RPC, RLS y Auth (plan §21.3).
