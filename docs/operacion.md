# Operación

## 1. Proyecto Supabase

1. Crear proyecto en https://supabase.com/dashboard (región São Paulo, plan Free). Guardar la contraseña de la base.
2. Authentication → Sign In / Providers → Email → apagar "Allow new users to sign up".
   El archivo `supabase/config.toml` también fija `enable_signup = false`; después de cualquier `supabase config push` o recreación del proyecto, volver a verificar el interruptor en el dashboard: el trigger que vincula cuentas por email depende de que el registro público esté cerrado.
3. Authentication → URL Configuration → agregar a "Redirect URLs" cada origen de la app seguido de `/auth/restablecer` (por ejemplo `http://localhost:5173/auth/restablecer` y la URL de Vercel). Sin esto, la recuperación de contraseña no vuelve a la app.

## 2. Enlazar la CLI (una vez por máquina)

```bash
npx supabase login
npx supabase link --project-ref <ref>
```

La contraseña de la base se guarda en el almacén de credenciales del sistema.

## 3. Variables de entorno

- `.env.local`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (Project Settings → API Keys).
- `.env.test.local`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. La clave `service_role` salta RLS: solo para pruebas, nunca en el navegador ni en el repositorio.

## 4. Migraciones y seed

```bash
npm run db:push     # solo migraciones
npm run db:seed     # migraciones + seed (recrea "Cadena Demo")
npm run db:types    # regenerar tipos tras cambiar el esquema
```

Alternativa sin CLI: pegar cada archivo de `supabase/migrations/` en orden en SQL Editor, luego `supabase/seed.sql`.

Regla: una migración aplicada no se edita; los cambios van en una nueva.

Regla: Toda migración que cree una tabla nueva debe repetir `revoke all on <tabla> from anon, authenticated; grant select on <tabla> to authenticated;` y sus políticas RLS: los permisos por defecto de Supabase exponen las tablas nuevas.

## 5. Cuentas de acceso

Las cuentas se crean desde el dashboard, nunca por registro público:

1. En la app, el administrador crea el perfil (`/usuarios`) con email, rol y sucursal. Para el primer administrador, el perfil ya viene en el seed (`admin@example.com`).
2. Dashboard → Authentication → Users → Add user → Create new user: mismo email, contraseña, "Auto Confirm User" activado.
3. El trigger `on_auth_user_created` vincula la cuenta con el perfil. En `/usuarios` desaparece el chip "Sin cuenta".

Si el chip persiste: verificar que el email coincida (sin distinguir mayúsculas) y correr `npm run db:seed` solo si es la cadena demo (el seed re-vincula al final). Para otros perfiles, ejecutar en SQL Editor:

```sql
update public.profiles p set auth_user_id = u.id
  from auth.users u
 where p.auth_user_id is null and lower(u.email) = lower(p.email)
   and not exists (select 1 from public.profiles q where q.auth_user_id = u.id);
```

Desactivar un usuario (`/usuarios` → editar → "Usuario activo" apagado) bloquea todas sus lecturas y escrituras de inmediato, aunque tenga sesión abierta.

## 6. Pruebas

Para SP2, aplicar primero la migración `0006_rpc_movements.sql` al proyecto de prueba. La interfaz llama las RPC `register_movement` y `reverse_movement`; sin esa migración, los formularios mostrarán un error. Usar credenciales de prueba vigentes en `.env.test.local` y ejecutar la batería de integración antes de publicar.

SP3 requiere `0007_rpc_transfers.sql`. El tablero y los conteos requieren `0008_dashboard_counts.sql`; la importación CSV requiere `0009_csv_batches.sql`. La carga directa de stock desde Inventario requiere `0010_rpc_assign_stock.sql` y `0011_fix_assign_stock_type.sql`. El correo diario requiere `0012_daily_low_stock_emails.sql` y `0013_daily_mail_invoker.sql`. Aplicar migraciones en orden antes de desplegar el frontend. No ejecutar `db:seed` sobre la cadena demo existente salvo que se quiera recrearla.

En Inventario, el administrador puede pulsar «Asignar stock», elegir sucursal y producto, y cargar cantidad o envases. Si el producto no estaba habilitado, la operación lo habilita y registra el saldo inicial; si ya tenía saldo, registra un ingreso. Cada envío usa una clave de reintento para evitar duplicados.

El resumen diario por correo usa Brevo y está implementado en `/api/daily-low-stock`; no afirmar que entrega correos hasta configurar las variables privadas y comprobar recepción real. Las invitaciones desde `/usuarios` todavía no están implementadas; configurar SMTP en Supabase solo habilita los correos de Auth (recuperación e invitaciones emitidas desde Supabase).

```bash
npm test          # unitarias
npm run test:db   # integración: crea y borra una cadena de prueba en el proyecto enlazado
```

Las pruebas de integración crean usuarios Auth temporales (`*@example.com`) y los borran al terminar. Si una corrida se corta, borrar a mano en Authentication → Users los que empiecen con `admin-`, `opa-`, `opb-`, `opc-`.

`tests/db/pilot.test.ts` comprueba con una cadena temporal que una tercera sucursal mantiene permisos y saldos separados, permite una transferencia y conserva auditoría de cambios. Esto no sustituye el piloto con personas ni la restauración en otro entorno.

El administrador puede revisar los eventos de cambio en `/auditoria`, con filtros por área y fecha. Los operadores no tienen acceso a esa pantalla ni a los eventos por RLS.

## 7. Despliegue en Vercel

Proyecto actual: `agustin-aguiars-projects/stock-peluquerias`. URL pública: https://stock-peluquerias.vercel.app

1. `vercel login` (una vez).
2. Enlazar la carpeta al proyecto (crea `.vercel/`, ignorado por git):
   ```bash
   vercel link --yes --scope agustin-aguiars-projects --project stock-peluquerias
   ```
3. Variables públicas del frontend: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Para Production se cargan por CLI leyendo el valor desde `.env.local`:
   ```bash
   grep '^VITE_SUPABASE_URL=' .env.local | cut -d= -f2- | tr -d '\r\n' | vercel env add VITE_SUPABASE_URL production
   grep '^VITE_SUPABASE_ANON_KEY=' .env.local | cut -d= -f2- | tr -d '\r\n' | vercel env add VITE_SUPABASE_ANON_KEY production
   ```
   Para Preview la CLI pide elegir rama de forma interactiva; cargarlas desde el dashboard (Settings → Environment Variables → Preview) si se van a usar despliegues de vista previa.
4. `vercel --yes` publica (con la CLI 51 el destino es Production; `vercel --prod --yes` es equivalente). La URL de cada despliegue (`stock-peluquerias-<hash>-<equipo>.vercel.app`) está protegida por Vercel Authentication y redirige a un login de Vercel: para la demo usar la URL pública del proyecto.
5. Agregar `https://stock-peluquerias.vercel.app/auth/restablecer` a Redirect URLs de Supabase (sección 1).

`vercel.json` reescribe todas las rutas a `index.html` (SPA); verificado con `/inventario` respondiendo 200.

### Resumen diario de stock bajo por correo

La función de Vercel se ejecuta una vez al día, a las 11:00 UTC (aproximadamente 08:00 en Montevideo; en Hobby puede dispararse en cualquier minuto de esa hora). Envía un resumen por cadena a cada administrador **activo, con cuenta Auth vinculada y correo real**. Solo incluye productos y sucursales activos con saldo inicial registrado y saldo menor o igual al mínimo. Si no hay faltantes, no envía nada. Los perfiles `@example.com` de la demo se excluyen.

En **Vercel → proyecto → Settings → Environment Variables**, cargar para **Production**:

| Nombre | Valor | Uso |
|---|---|---|
| `BREVO_API_KEY` | API key normal de Brevo (no SMTP ni MCP) | Envío transaccional |
| `BREVO_SENDER_EMAIL` | Dirección verificada como remitente en Brevo | Campo «De» |
| `SUPABASE_SECRET_KEY` | Clave secreta (`sb_secret_...`) del proyecto Supabase usado por la app, en Settings → API Keys | Leer todos los locales y registrar envíos |
| `CRON_SECRET` | Cadena aleatoria de al menos 16 caracteres | Vercel la envía en Authorization al cron |

La función usa `VITE_SUPABASE_URL` ya cargada; alternativamente acepta `SUPABASE_URL`. También admite la clave heredada `SUPABASE_SERVICE_ROLE_KEY` si el proyecto aún no tiene una clave secreta nueva. **Ninguna clave privada debe empezar con `VITE_`**, entrar al repositorio ni estar disponible en el navegador. Tras cambiar variables, volver a desplegar Production para que la función las reciba. Mantener `CRON_SECRET` y `SUPABASE_SECRET_KEY` solo en Production. La clave secreta salta RLS, por eso el endpoint comprueba `CRON_SECRET` antes de crear el cliente de Supabase y nunca imprime ni devuelve secretos.

La migración `0012` crea un registro privado por cadena, fecha local y destinatario para evitar correos repetidos. Reintentos fallidos pueden ejecutarse otra vez; Brevo recibe además una clave de idempotencia con vigencia de 30 minutos. Consultar **Vercel → Cron Jobs / Logs**, **Brevo → Transactional → Logs** y la tabla `daily_low_stock_emails` para comprobar el resultado.

Para una prueba real, crear un perfil administrador con un email propio en `/usuarios`, luego una cuenta Auth con el mismo email en Supabase → Authentication → Users. Verificar que el perfil ya no muestre «Sin cuenta». Comprobar que existe al menos un saldo inicial bajo mínimo. Ejecutar la ruta con `Authorization: Bearer <CRON_SECRET>` desde una herramienta privada o esperar al cron; nunca colocar el secreto en una URL ni compartirlo por chat. La respuesta `sent: 1` significa aceptación de Brevo, no entrega final: confirmar el evento `Delivered` en Brevo y la recepción en el buzón.

### Integración con GitHub

Repositorio: https://github.com/agustin-aguiar/stock-peluquerias (público, rama por defecto `main`), conectado al proyecto de Vercel (Settings → Git). Consecuencias:

- Cada `git push origin main` genera un despliegue de Production sin correr `vercel` a mano.
- Cada pull request genera una vista previa; para que compile necesita las variables `VITE_*` en el entorno Preview (cargarlas desde el dashboard, paso 3).
- La app de GitHub de Vercel debe tener acceso al repo (GitHub → Settings → Applications → Vercel → Repository access); si aparece "couldn't be found", falta ese permiso.
- Para publicar sin pasar por GitHub sigue valiendo `vercel --yes` desde la carpeta enlazada.

Primer push desde Windows: si `git push` responde "Invalid username or token", borrar la credencial guardada con `git credential-manager github logout` y repetir el push; Git Credential Manager abre el navegador para autorizar.

## 8. Respaldo y restauración

Respaldo lógico del esquema y datos del proyecto enlazado:

```bash
mkdir -p backups
npx supabase db dump --linked -f backups/$(date +%Y%m%d-%H%M)-schema.sql
npx supabase db dump --linked --data-only -f backups/$(date +%Y%m%d-%H%M)-data.sql
```

Guardar las copias fuera del repositorio (carpeta `backups/` está ignorada por git). Restauración en un proyecto limpio: aplicar `-schema.sql` y luego `-data.sql` desde SQL Editor, recrear cuentas Auth y re-vincular por email (sección 5). La prueba completa de restauración (CP-28) está prevista en Construcción 7.

## 9. Procedimiento de publicación

1. `npm test && npm run test:db && npm run build` en verde.
2. Respaldo (sección 8) si hay migraciones.
3. `npm run db:push`.
4. `vercel --yes`, probar acceso, inventario y una escritura con la cuenta demo.
5. Registrar versión, fecha y resultado en `docs/bitacora.md`.
