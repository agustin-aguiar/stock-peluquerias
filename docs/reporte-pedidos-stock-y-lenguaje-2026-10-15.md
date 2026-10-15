# Reporte de desarrollo: pedidos de stock y lenguaje de la plataforma

**Fecha:** 15 de octubre de 2026

**Proyecto:** Stock Peluquerías

**Alcance:** solicitudes de stock entre locales, revisión del lenguaje de la interfaz y guía de uso.

## Recorrido implementado en el código

1. El encargado de un local elige un producto, la cantidad necesaria y, si quiere, agrega un comentario. El pedido aparece para el administrador en **Pedidos de stock**. El menú muestra cuántos pedidos esperan su respuesta y se actualiza cada 30 segundos.
2. El administrador ve la cantidad disponible del producto en los demás locales y elige cuál podría enviarlo. Los locales sin cantidad suficiente no se pueden seleccionar. También puede rechazar el pedido con un motivo.
3. El encargado del local elegido ve el pedido y puede aceptar el envío o explicar por qué no puede hacerlo. Al aceptar se vuelve a verificar el stock disponible: se descuenta en ese momento, se crea el traslado y la cantidad queda en camino.
4. El local que pidió el producto confirma la llegada en **Envíos entre locales**. Solo en ese momento se suma a su stock. Si llegó una cantidad diferente, se usa el proceso de diferencias ya existente.

No se envía un correo por cada pedido: la notificación es dentro de la plataforma. El envío de correos de stock bajo que ya existía sigue siendo independiente.

## Reglas y trazabilidad

- Solo un encargado puede pedir stock para su propio local. El administrador elige el origen; solo el encargado del origen puede aceptar o rechazar el envío.
- El pedido y el traslado se vinculan mediante `stock_requests.transfer_id`. La salida del origen, los dos movimientos contables y el cambio de estado se guardan juntos en una transacción.
- Un reintento del mismo pedido con el mismo identificador devuelve el pedido existente. Dos aceptaciones concurrentes no pueden descontar dos veces porque se bloquea la fila del pedido antes de revisar el estado.
- Se vuelven a verificar los locales, el producto, la primera carga del destino y la cantidad disponible al aceptar. Si falta stock, se devuelve un error y no se descuenta nada.
- La lectura de pedidos respeta la cadena y los roles: el administrador ve los de su cadena, y cada encargado ve los de su local o aquellos que se le asignaron para enviar. Las escrituras se hacen únicamente mediante funciones con validación de permisos. Cada paso deja un evento de auditoría explicado en lenguaje común.

## Cambios de lenguaje

Se revisaron las pantallas de inventario, productos, movimientos, traslados, conteos, tablero, importación, usuarios y auditoría. Por ejemplo, **saldo** aparece como **disponible**, **bajo mínimo** como **queda poco**, **merma** como **pérdida o producto dañado**, y **SKU** se explica como **código del producto**. Se añadieron explicaciones de qué ocurre antes de confirmar un envío, una recepción o un conteo. La nueva sección **Cómo usarlo** reúne el recorrido principal y un glosario breve.

Los términos técnicos se conservan donde son parte de los archivos CSV, de la base de datos o del código, para mantener la compatibilidad de las integraciones.

## Verificación

- `npm test`: 56 pruebas unitarias aprobadas.
- `npm run build`: compilación de TypeScript y construcción de la web aprobadas.
- `npm run lint`: sin errores.
- Se agregó una prueba de integración para el recorrido pedido → revisión → aceptación → recepción, permisos y rechazo. **No se ejecutó**, porque este entorno no tiene `.env.test.local` ni una base de pruebas configurada.
- En Supabase de producción se realizó un recorrido completo de pedido, asignación, despacho y recepción dentro de una transacción con `ROLLBACK`. La prueba confirmó que el origen se descuenta al enviar y el destino se suma al recibir. Se verificó que no quedó ningún pedido de prueba guardado.

## Estado de activación

La migración `supabase/migrations/0014_stock_requests.sql` **se aplicó al proyecto Supabase de producción** después de recibir la autorización explícita. Se comprobó que existen la tabla y las tres funciones, que RLS está activado y que la versión `0014 stock_requests` figura en el historial de migraciones. También se notificó a la API para actualizar su esquema. La interfaz muestra **Pedidos de stock** cuando confirma que la tabla es accesible.

**Pendiente de validación adicional:** ejecutar las pruebas automatizadas de base contra un proyecto de pruebas configurado y realizar una aceptación manual con los tres perfiles. La función está activada en la base; el código web llega a producción mediante el despliegue automático de Vercel desde `main`.
