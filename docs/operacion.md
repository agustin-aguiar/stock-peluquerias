# Operación

## 1. Proyecto Supabase

1. Crear proyecto en https://supabase.com/dashboard (región São Paulo, plan Free). Guardar la contraseña de la base.
2. Authentication → Sign In / Providers → Email → apagar "Allow new users to sign up".
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

## 5. Cuentas de acceso

Las cuentas se crean desde el dashboard, nunca por registro público:

1. En la app, el administrador crea el perfil (`/usuarios`) con email, rol y sucursal. Para el primer administrador, el perfil ya viene en el seed (`admin@pelu.com`).
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

```bash
npm test          # unitarias
npm run test:db   # integración: crea y borra una cadena de prueba en el proyecto enlazado
```

Las pruebas de integración crean usuarios Auth temporales (`*@example.com`) y los borran al terminar. Si una corrida se corta, borrar a mano en Authentication → Users los que empiecen con `admin-`, `opa-`, `opb-`, `opc-`.

## 7. Despliegue en Vercel

1. `vercel login` (una vez).
2. En el dashboard de Vercel → proyecto → Settings → Environment Variables: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` para Preview y Production.
3. `vercel --yes` publica una vista previa; `vercel --prod --yes` publica producción.
4. Agregar la URL resultante a Redirect URLs de Supabase (sección 1).

`vercel.json` reescribe todas las rutas a `index.html` (SPA).

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
