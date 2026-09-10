# Bitácora

Plantilla por semana (plan §24.1). Una entrada por semana de trabajo.

## Semana 4 (Construcción 1–2) — 2026-09-10 a 2026-09-24

- **Objetivo acordado:** SP1 completo: esquema, auth y permisos, catálogo, sucursales, usuarios, inventario y saldo inicial.
- **Tareas realizadas:** ver commits en `main` (scaffold → migraciones 0001–0004 → UI por feature → seed y docs).
- **Evidencia:** `npm test`, `npm run test:db` (CP-01, 02, 03, 04, 05, 07, 21, 23, 31, 33 e idempotencia), vista previa en Vercel.
- **Problema encontrado:** (completar)
- **Alternativas ensayadas:** (completar)
- **Decisión tomada:** ADR-001.
- **Validación:** conciliación saldo vs. movimientos = 0 diferencias sobre la cadena demo.
- **Tiempo real:** (completar horas-persona)
- **Próximo paso:** SP2 movimientos (ingreso, consumo, venta, merma, ajuste, reversión) con concurrencia e idempotencia.
