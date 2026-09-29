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

## Semana 6 (Construcción 3) — 2026-09-29

- **Objetivo:** SP2 movimientos operativos e integridad del saldo.
- **Implementado en el checkout:** migración `0006_rpc_movements.sql` para ingreso, consumo, venta, merma, ajuste y reversión; bloqueo transaccional de inventario y clave de idempotencia; control de permisos, cantidad, saldo y motivo; auditoría y alertas. La ficha de producto permite registrar movimientos y consultar historial filtrado por sucursal, tipo y fecha. El administrador puede solicitar una reversión completa.
- **Pruebas agregadas:** `tests/db/movements.test.ts` cubre CP-02, 06–11, 18, 19 y 22, incluyendo retiros concurrentes, reintentos y consulta del resultado por clave.
- **Validación local:** TypeScript, ESLint, build de Vite y 39 pruebas unitarias correctas. Las pruebas de base no se ejecutaron: falta `.env.test.local` y este equipo no tiene Docker. La migración aún no está aplicada a Supabase ni el código publicado.
- **Próximo paso:** aplicar la migración en un proyecto de prueba, ejecutar `npm run test:db`, corregir cualquier diferencia observada y realizar el recorrido de aceptación con ambos roles antes de publicar.

## Semanas 7–9 (Construcción 4–6, avance) — 2026-09-29

- **SP3:** transferencias de un SKU con borrador, cancelación, despacho, tránsito, recepción, reporte y resolución de diferencias. Las RPC bloquean filas y conservan las cantidades; la interfaz muestra solo las acciones permitidas por rol y estado.
- **SP4 implementado:** tablero por período sin sumar unidades incompatibles, conteos físicos con aprobación por versión, importación atómica de catálogo y saldos iniciales (hasta 500 filas), vista previa CSV y exportación protegida contra fórmulas.
- **SP4 pendiente:** resumen diario por correo (Resend, cron, destinatario y pruebas de entrega), invitaciones por email y pruebas de navegador/piloto. No hay configuración de correo para afirmar que estas funciones funcionan.
- **Validación:** 44 pruebas unitarias y 59 pruebas de integración aprobadas en Supabase; TypeScript, ESLint y build correctos. Tras las pruebas quedaron 1 cadena, 52 productos, 3 usuarios Auth y 0 diferencias entre saldos y movimientos.
- **Entorno:** el proyecto Supabase usado por Vercel estaba pausado; se reactivó y se aplicaron migraciones 0006–0009 sin recrear la cadena demo.
- **Próximo paso:** publicar el frontend, verificar el despliegue y realizar un recorrido manual con ambos roles. Luego cerrar correo, invitaciones y las pruebas del piloto.

## Semana 10 (Construcción 7, avance) — 2026-09-29

- **Objetivo:** comenzar las pruebas de extensibilidad y trazabilidad del piloto.
- **Implementado:** vista de auditoría para administradores con filtros y detalle del cambio; navegación móvil con accesos principales y menú «Más» para que las secciones no compitan por el ancho de 360 px.
- **Pruebas:** `tests/db/pilot.test.ts` comprueba CP-23 en una tercera sucursal temporal: operador propio, aislamiento de lectura y escritura, saldos y recepción de transferencia. También comprueba CP-31 para cambios de mínimos, producto y perfil, y que el operador no lea auditoría.
- **Validación:** 44 pruebas unitarias, 2 nuevas pruebas de integración, TypeScript, ESLint y build aprobados. La prueba de navegador con ambas cuentas queda pendiente; se verificó que la app local abre el login.
- **Pendiente de C7:** piloto guiado con personas, medición con 20 sesiones y unos 5.000 movimientos, respaldo y restauración en ambiente separado, recorrido de teclado/celular autenticado. El correo de SP4 permanece pendiente por decisión del usuario.
