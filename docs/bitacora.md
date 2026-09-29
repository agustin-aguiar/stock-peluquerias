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

## Mejora de usabilidad de Inventario — 2026-09-29

- **Pedido:** cargar materias primas en locales desde Inventario sin pasar por Catálogo y luego por la ficha de producto.
- **Implementado:** botón «Asignar stock» general y por producto/sucursal, con cantidad o envases y vista previa del saldo. La RPC `assign_stock` habilita el producto cuando falta y registra saldo inicial o ingreso dentro de una sola transacción; conserva clave de reintento y auditoría.
- **Validación:** `tests/db/assignStock.test.ts` comprueba primera carga, ingreso posterior, reintento, permisos, rechazo sin cambios parciales y dos cargas simultáneas. La primera corrida detectó un tipo enum sin cast; se corrigió en la migración `0011_fix_assign_stock_type.sql` y las cuatro pruebas pasaron.
- **Respaldo:** la CLI de Supabase no pudo generar un dump en este equipo porque no hay Docker ni Podman. Las migraciones nuevas solo agregan/reemplazan la función y no cambian datos existentes. La prueba de respaldo y restauración de C7 sigue pendiente.
- **Preparación C8:** se redactó `docs/demo-10-minutos.md` con un recorrido de ambos roles basado en funciones verificadas. El ensayo real y las capturas finales siguen pendientes.
- **Carga inicial:** las pantallas se separaron por ruta. El archivo JS principal de la compilación con configuración real bajó de 768,53 kB a 259,63 kB; las secciones se descargan al abrirlas. Se comprobó en navegador local que `/inventario` redirige al acceso sin sesión y que acceso/recuperación cargan correctamente. Es una mejora de descarga, no una medición de RNF-03 con 20 sesiones.

## Correo diario de stock bajo — 2026-09-29

- **Pedido:** aprovechar la cuenta gratuita de Brevo para avisar por correo a los administradores cuando haya productos bajo mínimo.
- **Implementado:** función privada de Vercel que agrupa saldos bajos por cadena y envía un resumen diario a administradores activos con cuenta vinculada y correo real. Registro privado por destinatario y fecha local para evitar repeticiones, reserva atómica para ejecuciones simultáneas y clave de idempotencia de Brevo para reintentos próximos.
- **Seguridad:** `CRON_SECRET` protege la ruta; la API key de Brevo y la clave `service_role` solo se leen en el servidor. Los perfiles demo `@example.com` no reciben mensajes.
- **Base de datos:** migraciones `0012_daily_low_stock_emails.sql` y `0013_daily_mail_invoker.sql` aplicadas al proyecto Supabase vinculado. La segunda hace que la reserva use permisos propios de `service_role`, compatibles con la clave secreta nueva. No se recreó el seed.
- **Validación:** 49 pruebas unitarias, TypeScript, ESLint y build correctos. La prueba de integración de la nueva reserva y la recepción real quedan pendientes de una ejecución con credenciales autorizadas y las variables privadas cargadas en Vercel.
- **Incidente de despliegue:** la primera versión de la función devolvió 500 porque Vercel no resolvió un módulo local importado sin extensión al iniciar la función. Se incorporó esa lógica al archivo de la función y se repitieron TypeScript, ESLint y las 49 pruebas unitarias antes del nuevo despliegue.
- **Destinatario de la demo:** se añadió una opción de destinatario explícito limitado por `LOW_STOCK_CHAIN_ID`. El usuario autorizó un correo propio para esa cadena; su dirección se configura solo en Vercel. Se evita duplicar el envío cuando coincide con un administrador. Las seis variables necesarias quedaron cargadas en Production. Se añadieron dos pruebas unitarias (51 en total).
- **Prueba de producción:** la ruta protegida procesó 12 productos bajo mínimo y Brevo aceptó un envío (`sent: 1`, `failed: 0`). Queda por comprobar la entrega final en el buzón o en los registros de Brevo. El registro diario evita repetir el correo para el mismo destinatario y fecha local.
