# Últimos cambios: pedidos de stock y altas de usuarios

**Fecha:** 15 de octubre de 2026  
**Alcance:** cambios de la rama `feat/autoservicio-cadenas`, presentados en el [PR #1](https://github.com/agustin-aguiar/stock-peluquerias/pull/1).  
**Estado:** implementados y verificados en el código; pendientes de prueba de integración en un Supabase aislado, activación de las migraciones y publicación en producción. El sitio de Vercel que usa `main` todavía no incluye estas funciones.

## Resumen funcional

| Área | Comportamiento incorporado |
|---|---|
| Registro de cadena | Una persona crea una cuenta, confirma su correo y crea una cadena propia. Queda como administrador de esa cadena. |
| Alta individual | El administrador crea un usuario desde **Usuarios** y la aplicación envía una invitación para establecer su contraseña. |
| Alta por lote | El administrador elige un local y pega hasta 20 líneas `Nombre completo;correo@ejemplo.com`. La pantalla informa el resultado de cada envío; repetir el lote reutiliza perfiles existentes. |
| Enlace de local | Desde **Sucursales**, el administrador crea y copia un enlace para que los encargados se registren solos. Dura siete días, admite veinte altas y se puede desactivar o renovar. |
| Pedidos de stock | Un local puede pedir un producto aunque aún no haya tenido su primera carga. El administrador puede elegir el origen y reasignar un pedido que ese local rechazó. |
| Alertas | Un producto habilitado, pero sin primera carga, no aparece como agotado ni como stock bajo en el tablero o las alertas. |
| Navegación | Las bandejas de pedidos separan los pendientes de las operaciones recientes para que los pendientes antiguos sigan visibles. |

## Cómo funciona el alta de usuarios

### Administrador de una cadena nueva

1. Abre `/registro`, informa nombre de la cadena, nombre personal, correo y contraseña.
2. Supabase Auth envía la confirmación del correo. La cuenta todavía no tiene un perfil de aplicación.
3. Luego de confirmar, `/sin-perfil` llama a `create_my_chain`. La base comprueba que el correo esté confirmado y que no exista un perfil con ese correo o cuenta Auth. Crea la cadena y el administrador en una transacción.
4. El administrador crea sus sucursales, productos y usuarios desde la aplicación.

El navegador no puede elegir una cadena ajena ni enviarse un rol de administrador para una cadena existente. La función de base fija el rol y crea una cadena nueva.

### Invitación por correo, individual o por lote

1. En **Usuarios**, el administrador crea un perfil, o usa **Invitar varios** y elige una sucursal activa.
2. La base valida la sucursal y el correo. La ruta privada `/api/invite-user` comprueba el token de sesión, que el remitente sea administrador activo y que el perfil de destino pertenezca a su cadena.
3. Supabase Auth envía el correo por el SMTP configurado. El destinatario sigue el enlace y establece su contraseña.
4. Si un envío falla, el perfil permanece visible como **Sin acceso**. El administrador puede reenviarlo desde la fila del usuario o repetir el lote. El lote muestra el resultado de cada persona por separado.

La carga por lote solo crea encargados para una sucursal; los administradores adicionales se invitan individualmente. Se aceptan como máximo veinte personas por envío. Un correo asignado a otro local o rol se informa como conflicto: el lote no cambia ese perfil.

### Enlace temporal por sucursal

1. En **Sucursales**, el administrador pulsa **Enlace de acceso** y crea el enlace. Puede copiarlo, renovarlo o desactivarlo.
2. El encargado abre `/registro?invitacion=...`, crea su cuenta y confirma su correo.
3. En `/sin-perfil`, la función `join_branch_with_link` comprueba el token, vencimiento, cupo, sucursal activa, correo confirmado y ausencia de otro perfil. La base crea el perfil con rol **encargado** y con la sucursal indicada en el enlace; cuenta un uso y registra la acción en auditoría.
4. Renovar el enlace invalida el anterior. Desactivarlo bloquea nuevas altas. Los perfiles ya creados conservan su acceso; para quitarlo hay que desactivar al usuario en **Usuarios**.

El token es un UUID aleatorio. La tabla de enlaces no concede lectura directa al navegador; las consultas y cambios pasan por funciones que comprueban el rol administrador. La aceptación del enlace bloquea su fila durante el alta para impedir que dos registros simultáneos superen el cupo.

## Cambios de datos y componentes

| Pieza | Cambio |
|---|---|
| `0015_requests_alerts.sql` | Ajusta pedidos rechazados, primera recepción, vista de inventario, alertas y tablero. |
| `0016_self_service_chains.sql` | Impone correo único entre cadenas y crea `create_my_chain`; refuerza `create_profile`. |
| `0017_branch_join_links.sql` | Crea `branch_join_links` y las funciones para consultar, emitir, revocar y aceptar enlaces. |
| `api/invite-user.ts` | Envía invitaciones con clave privada desde el servidor después de comprobar identidad, rol y cadena. |
| Interfaz | Añade registro público, preparación de cadena, invitación masiva, enlaces de sucursal y mensajes de error comprensibles. |
| Auditoría | Describe en lenguaje común la creación de cadena, emisión o revocación de enlaces y alta mediante enlace. |

El modelo sigue permitiendo **una cuenta Auth por perfil y un correo en una sola cadena**. La participación de una persona en varias cadenas requeriría un modelo de membresías distinto.

## Verificación y estado de publicación

- `npm test`: **62 pruebas unitarias aprobadas**.
- `npm run lint` y `npm run build`: aprobados.
- GitHub Actions **Calidad**: aprobado para el commit `eb43ee0` del PR.
- Se agregaron pruebas de base para registro de cadenas, pedidos y enlaces, incluidos controles de rol y revocación. **No se ejecutaron** en este entorno: falta `.env.test.local` con un proyecto Supabase aislado. Por eso no se afirma que la migración nueva esté validada contra una base real.
- **Producción:** estas migraciones no se aplicaron y el PR no se integró a `main`. No se debe presentar el alta autoservicio como disponible en el sitio actual.

Para activar la versión, seguir [Preparación del alta autoservicio](lanzamiento-autoservicio-2026-10-15.md): probar en Supabase aislado, revisar correos duplicados antes del índice global, aplicar migraciones en orden, configurar Auth y Redirect URLs, verificar secretos del servidor y recorrer ambas formas de invitación con correos reales. El piloto con personas y la prueba de respaldo y restauración siguen pendientes.
