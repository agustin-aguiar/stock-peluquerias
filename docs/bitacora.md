# Bitácora

Plantilla por semana (plan §24.1). Una entrada por semana de trabajo.

## Semana 4 (Construcción 1–2) — 2026-09-10 a 2026-09-24

- **Objetivo acordado:** SP1 completo: esquema, auth y permisos, catálogo, sucursales, usuarios, inventario y saldo inicial.
- **Tareas realizadas:** 16 tareas del plan en la rama `sp1-fundacion` (scaffold → migraciones 0001–0005 → UI por feature → seed y docs), cada una con revisión de spec y calidad; 6 rondas de corrección.
- **Evidencia:** `npm test` (39), `npm run test:db` (44: CP-01, 02, 03, 04, 05, 07, 21, 23, 31, 33 e idempotencia, corrido dos veces sin fallos), publicación en https://stock-peluquerias.vercel.app.
- **Problema encontrado:** (1) el seed completo fallaba: en `UNION ALL` y `CASE` los literales de uuid se resuelven como `text`; (2) `supabase db push --include-seed` no vuelve a ejecutar el seed si no hay migraciones nuevas; (3) las cuentas demo se crearon en un dominio real (`pelu.com`), lo que habilitaba recuperación de contraseña hacia un buzón ajeno; (4) dos carreras concurrentes devolvían `unique_violation` crudo en vez del código de error; (5) los enteros ≥ 1.000 formateados con punto de miles no se volvían a parsear.
- **Alternativas ensayadas:** Supabase local con Docker (descartado: sin Docker en el equipo) vs. proyecto cloud enlazado por CLI; `db push --include-seed` vs. `db query -f seed.sql` (elegido, siempre ejecuta); editar la migración ya aplicada vs. migración 0005 con `create or replace` (elegido).
- **Decisión tomada:** ADR-001; `db:seed` = push + `db query -f`; migración 0005 mapea `unique_violation` a `already_enabled`/`idempotency_conflict`; cuentas demo en `@example.com`; `enable_signup = false` también en `supabase/config.toml`; `formatForInput` para sembrar formularios.
- **Validación:** conciliación saldo vs. movimientos = 0 diferencias sobre la cadena demo (50 SKU, 100 filas, 11 alertas abiertas); revisión final del branch sin hallazgos críticos; pendientes menores registrados para SP2.
- **Tiempo real:** (completar horas-persona)
- **Próximo paso:** SP2 movimientos (ingreso, consumo, venta, merma, ajuste, reversión) con concurrencia e idempotencia.
