# SP1 — Fundación y catálogo: diseño

**Proyecto:** Stock Peluquerías (IET, ORT Uruguay, 2026)  
**Sub-proyecto:** 1 de 4. Cubre Construcción 1 y 2 del plan (`docs/referencia/plan-v1.md`, §16.5 y §16.6).  
**Fecha:** 10 de septiembre de 2026  
**Estado:** aprobado en conversación; pendiente de revisión escrita.

## 1. Objetivo

Dejar operativa la base sobre la que se construyen movimientos (SP2), transferencias (SP3) y alertas/tablero/P1 (SP4):

- Proyecto web desplegable, repositorio y ambientes documentados.
- Esquema PostgreSQL completo del alcance P0 (todas las tablas), aunque la lógica de movimientos y transferencias llegue en SP2/SP3.
- Autenticación, dos perfiles (administrador de cadena, operador de sucursal), restricción por sucursal, desactivación de acceso.
- CRUD de sucursales, catálogo, usuarios y mínimos; inventario por local; saldo inicial trazable.

**Demo de cierre:** mismo producto con saldos distintos en dos sucursales; dos cuentas con menús distintos; acceso indebido rechazado desde el servidor.

**Requerimientos cubiertos:** RF-01, RF-02, RF-03, RF-04, RF-05 completos; RF-06 solo en su variante de saldo inicial; RF-11 solo el recálculo de alerta al habilitar producto o cambiar mínimo. **Casos de prueba cubiertos:** CP-01, 02, 03, 04, 05, 07 (validación de escala), 21, 23, 31, 33.

## 2. Decisiones de partida

| Decisión | Elección | Motivo |
|---|---|---|
| Fase | Saltar a Construcción; preparación 1-3 del plan se documenta como hecha en la medida en que el plan ya la cubre | El usuario tiene plan y mockups; quiere producto |
| Backend | Supabase cloud, proyecto gratuito | Sin Docker en la máquina; coherente con el plan |
| Frontend | Vite 6 + React 19 + TypeScript strict + Tailwind v4 | Coherente con plan §11.2 y con mockups Stitch |
| Escrituras | Toda escritura vía RPC PostgreSQL `SECURITY DEFINER`; lecturas vía RLS | Un solo lugar de validación y auditoría; mismo patrón para SP2/SP3 |
| Nombre | Stock Peluquerías | Nombre de trabajo del plan; los mockups dicen "Stock Salon", se ignora |
| Alcance visual | Solo lo que el plan pide | Escáner de códigos, fotos de evidencia, "SLA" y "capacidad pañol" de los mockups quedan fuera (P2 o inexistentes) |

## 3. Estructura del repositorio

Carpeta: `C:\Users\aguia\OneDrive\Escritorio\peluqueria`, rama `main`.

```
peluqueria/
  index.html · package.json · vite.config.ts · tsconfig*.json · vercel.json
  .env.example                 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
  src/
    main.tsx · App.tsx · index.css (tokens @theme)
    app/                       router.tsx, providers.tsx, guards.tsx, layout/
    features/
      auth/                    LoginPage, RecuperarPage, RestablecerPage, useSession, useProfile
      branches/                SucursalesPage, api.ts
      products/                CatalogoPage, ProductoFormPage, api.ts
      users/                   UsuariosPage, api.ts
      inventory/               InventarioPage, ProductoDetallePage, SaldoInicialDialog, api.ts
      home/                    InicioAdminPage
    components/ui/             Button, Input, Select, Chip, BranchPill, DataTable/CardList, Dialog, Toast, EmptyState, ErrorState
    lib/                       supabase.ts · quantity.ts · errors.ts · format.ts
    types/                     database.ts (generado)
  supabase/
    config.toml
    migrations/
      0001_schema.sql          tipos, tablas, índices, constraints, trigger auth
      0002_helpers_rls.sql     current_profile() y compañía, RLS, vistas, revokes
      0003_rpc.sql             funciones de escritura y recalc_alert
    seed.sql                   cadena demo
  tests/
    unit/                      quantity.test.ts, errors.test.ts, schemas.test.ts
    db/                        setup.ts, auth.test.ts, catalog.test.ts, inventory.test.ts
  docs/
    superpowers/specs/         este documento y los siguientes
    referencia/                plan-v1.md, stitch/ (DESIGN.md, code.html, screen.png)
    decisiones/                ADR-001-arquitectura.md
    bitacora.md · operacion.md
  README.md
```

Dependencias runtime: `react`, `react-dom`, `react-router`, `@tanstack/react-query`, `@supabase/supabase-js`, `zod`, `lucide-react`. Dev: `vite`, `typescript`, `tailwindcss`, `@tailwindcss/vite`, `vitest`, `supabase` (CLI vía npx), `eslint`, `prettier`.

Migraciones se aplican con `npx supabase login` y `npx supabase link --project-ref <ref>` (una vez, por el usuario; el link guarda la contraseña de la base en el almacén de credenciales del sistema) y luego `npx supabase db push`. El seed se aplica con `npx supabase db push --include-seed` y las consultas de verificación con `npx supabase db query --linked`. Alternativa documentada: pegar cada archivo en el SQL Editor en orden. Tipos: `npx supabase gen types typescript --linked > src/types/database.ts`.

## 4. Modelo físico

Esquema `public`. Cantidades `numeric(14,2)`. Fechas `timestamptz` en UTC. Identificadores `uuid` con `gen_random_uuid()`. Emails como `text` normalizados con `lower()` en índices y búsquedas (sin extensión `citext`, para no depender del `search_path`). Toda FK a `chains` es `on delete cascade` (permite recrear la cadena demo); el resto de FK son `no action` (comprobación al final de la sentencia, compatible con la cascada).

### 4.1 Tipos

```
user_role        enum ('admin', 'operator')
unit_kind        enum ('unit', 'ml', 'g')
operation_type   enum ('initial', 'purchase', 'consumption', 'sale', 'shrinkage',
                       'adjustment', 'reversal', 'dispatch', 'receipt', 'resolution')
transfer_status  enum ('draft', 'dispatched', 'received', 'disputed', 'resolved', 'cancelled')
alert_status     enum ('open', 'resolved')
```

Los valores del enum son identificadores en inglés; la interfaz muestra etiquetas en español (`initial` → "Saldo inicial", `shrinkage` → "Merma", etc.).

### 4.2 Tablas

| Tabla | Columnas | Restricciones |
|---|---|---|
| `chains` | id, name, timezone (text, default `America/Montevideo`), created_at | — |
| `branches` | id, chain_id, code, name, is_active (default true), created_at | unique (chain_id, code); code `^[A-Z0-9]{2,8}$` |
| `profiles` | id, chain_id, auth_user_id (uuid null, unique, FK `auth.users` on delete set null), email (text), full_name, role, branch_id (null), is_active (default true), created_at | índice único (chain_id, lower(email)); check `(role='operator' and branch_id is not null) or (role='admin' and branch_id is null)`; FK branch_id → branches |
| `products` | id, chain_id, sku, name, brand (null), category (null), variant (null), unit, presentation (text null, ej. "Envase 1 L"), presentation_qty (numeric null, contenido por envase en unidad base), max_movement_qty (numeric, default 100000), is_active, created_at | índice único (chain_id, lower(sku)); sku `^[A-Za-z0-9._-]{1,40}$`; presentation_qty > 0 si no es null; max_movement_qty > 0 |
| `inventory` | id, chain_id, branch_id, product_id, balance (default 0), min_qty (default 0), version (bigint default 1), initialized_at (timestamptz null), updated_at | unique (branch_id, product_id); balance ≥ 0; min_qty ≥ 0. `initialized_at` marca que se registró el saldo inicial, incluso si fue 0 |
| `operations` | id, chain_id, type, actor_profile_id, idempotency_key (uuid), request_hash (text), reason (null), reference (null), result (jsonb), created_at | unique (chain_id, idempotency_key) |
| `movements` | id, chain_id, operation_id, product_id, branch_id (null), transfer_id (null), qty_delta (≠ 0), unit, reverses_movement_id (null, unique), created_at | check `branch_id is not null or transfer_id is not null`: fila con `branch_id` null es tránsito y debe llevar `transfer_id`; una fila de sucursal puede llevar `transfer_id` como referencia; índices (chain_id, product_id, created_at), (branch_id, created_at), (transfer_id) |
| `transfers` | id, chain_id, product_id, from_branch_id, to_branch_id, qty (> 0), status (default draft), shipping_ref (null), created_by, created_at, dispatched_by/at, received_by/at, dispute_note, disputed_by/at, resolved_qty_received, resolved_qty_returned, resolved_qty_lost, resolution_note, resolved_by/at | check from ≠ to; índices por status y por sucursal |
| `alerts` | id, chain_id, branch_id, product_id, status, opened_at, resolved_at | unique parcial (branch_id, product_id) where status = 'open' |
| `audit_events` | id, chain_id, actor_profile_id, action (text), entity_type (text), entity_id (uuid), old_values (jsonb), new_values (jsonb), created_at | índice (chain_id, created_at) |

Toda FK a `branches`, `products`, `profiles` lleva además comprobación de cadena en las RPC; el `chain_id` redundante en cada tabla permite RLS sin joins.

### 4.3 Semántica de saldo

`inventory.balance` es el **saldo utilizable**. El tránsito no vive en `inventory`: se reconstruye como `sum(qty_delta)` de `movements` con `transfer_id` y `branch_id null`. El historial es inmutable; correcciones son movimientos compensatorios (SP2).

### 4.4 Trigger de vinculación de cuentas

`auth.users` → `after insert` ejecuta `public.handle_new_auth_user()`: busca `profiles` con `email = new.email` y `auth_user_id is null`, y asigna `auth_user_id = new.id`. Si no hay perfil, la cuenta queda sin perfil y `current_profile()` devuelve null (la app muestra "cuenta sin perfil asignado, contactá al administrador").

## 5. Autenticación y autorización

### 5.1 Auth

- Supabase Auth, email + contraseña. Registro público deshabilitado en el dashboard (Authentication → Providers → Email → "Allow new users to sign up" apagado). Documentado en `docs/operacion.md`.
- Recuperación de contraseña: `supabase.auth.resetPasswordForEmail(email, { redirectTo: <origen>/auth/restablecer })`. La ruta `/auth/restablecer` toma la sesión de recuperación y llama `updateUser({ password })`.
- Alta de cuentas: el administrador pre-registra el perfil en `/usuarios` (email, nombre, rol, sucursal). La cuenta de Auth se crea desde Dashboard → Authentication → Users → "Add user" (con "Auto Confirm"). El trigger vincula por email. La invitación automática por Edge Function queda como mejora P1 (SP4).
- Bootstrap del primer administrador: `seed.sql` crea la cadena y el perfil admin con email fijo (`admin@pelu.com`). El usuario crea esa cuenta en el dashboard. Procedimiento en `docs/operacion.md`.

### 5.2 Helpers SQL

Todas `STABLE`, `SECURITY DEFINER`, `SET search_path = public, pg_temp`, ejecutables por `authenticated`:

- `current_profile() returns profiles` — fila con `auth_user_id = auth.uid()` **y** `is_active = true`; null en otro caso.
- `current_chain_id() returns uuid`, `current_branch_id() returns uuid`, `is_admin() returns boolean` derivadas de la anterior.

Usuario desactivado ⇒ `current_profile()` null ⇒ todas las políticas y RPC rechazan, aunque el JWT siga vigente (CP-04).

### 5.3 RLS

RLS habilitada (`ENABLE ROW LEVEL SECURITY`, sin `FORCE`) en todas las tablas. Sin `FORCE` para que las funciones `SECURITY DEFINER` propiedad de `postgres` y el seed puedan escribir: no existen políticas de escritura, y la seguridad de esas funciones reside en sus comprobaciones explícitas de perfil, rol y cadena. Solo políticas `SELECT` para `authenticated`. `REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM authenticated, anon`. `anon` no tiene `SELECT` en ninguna tabla.

| Tabla | Política SELECT |
|---|---|
| chains | `id = current_chain_id()` |
| branches, products | `chain_id = current_chain_id()` |
| profiles | admin: `chain_id = current_chain_id()`; operador: `id = current_profile().id` |
| inventory, operations, movements, alerts | admin: cadena; operador: cadena **y** `branch_id = current_branch_id()` (en `movements`, las filas de tránsito solo las ve el admin en SP1; SP3 revisa) |
| transfers | admin: cadena; operador: `from_branch_id = current_branch_id() or to_branch_id = current_branch_id()` |
| audit_events | admin: cadena; operador: ninguna |

Vista `inventory_status` con `security_invoker = true` (hereda la RLS de `inventory`, `products` y `branches`): une las tres tablas y expone `below_min = (balance <= min_qty)`, `sku`, `product_name`, `unit`, `product_active`, `branch_code`, `branch_name`, `branch_active`. Es la fuente de las pantallas de inventario y disponibilidad, y permite filtrar "bajo mínimo" y buscar por SKU/nombre en el servidor.

Vista `profiles_public (id, chain_id, full_name, role, branch_id)` **sin** `security_invoker` (se ejecuta como su dueño `postgres`) definida como `select ... from profiles where chain_id = current_chain_id()`. Es la única vista privilegiada de SP1: expone solo id y nombre de perfiles de la propia cadena, nunca email, y devuelve cero filas si `current_profile()` es null. Sirve para mostrar "registrado por" en SP2. Tiene prueba propia en 8.2.

### 5.4 RPC

Todas: `SECURITY DEFINER`, `SET search_path = public, pg_temp`, `REVOKE EXECUTE FROM public, anon`, `GRANT EXECUTE TO authenticated`. Primera línea: `perform assert_admin()` o `assert_active()`. Cada RPC escribe una fila en `audit_events` dentro de la misma transacción.

| RPC | Entrada | Rol | Validaciones | Salida |
|---|---|---|---|---|
| `create_branch(p_code, p_name)` | text, text | admin | código con patrón y único en cadena | fila `branches` |
| `update_branch(p_id, p_name, p_is_active)` | uuid, text, bool | admin | pertenece a cadena; al desactivar: sin `inventory.balance > 0`, sin tránsito, sin transferencias en estado draft/dispatched/disputed; sin operadores activos asignados | fila |
| `upsert_product(p_id, p_sku, p_name, p_brand, p_category, p_variant, p_unit, p_presentation, p_presentation_qty, p_max_movement_qty, p_is_active)` | uuid null + campos | admin | SKU único (case-insensitive); si `p_id` existe y hay `movements` del producto, `unit` debe coincidir (`unit_locked`); al desactivar: sin saldo en ningún local, sin tránsito, sin transferencias abiertas (`has_stock`) | fila |
| `enable_product_in_branch(p_product_id, p_branch_id, p_min_qty)` | uuid, uuid, numeric | admin | ambos activos y de la cadena; sin fila previa (`already_enabled`); min ≥ 0 y escala válida | fila `inventory`; llama `recalc_alert` |
| `set_min_qty(p_branch_id, p_product_id, p_min_qty)` | uuid, uuid, numeric | admin | fila existe; min ≥ 0; escala válida para la unidad | fila `inventory`; llama `recalc_alert` |
| `create_profile(p_email, p_full_name, p_role, p_branch_id)` | citext, text, role, uuid null | admin | email único en cadena; operador ⇒ sucursal activa de la cadena; admin ⇒ branch null | fila `profiles` |
| `update_profile(p_id, p_full_name, p_role, p_branch_id, p_is_active)` | uuid, text, role, uuid null, bool | admin | misma cadena; no puede desactivarse a sí mismo; si el resultado deja cero admins activos en la cadena ⇒ `last_admin` | fila |
| `set_initial_balance(p_key, p_branch_id, p_product_id, p_qty, p_reference)` | uuid, uuid, uuid, numeric, text null | admin | ver 5.5 | `{operation_id, movement_id, balance}` |
| `recalc_alert(p_branch_id, p_product_id)` | uuid, uuid | interna (`REVOKE EXECUTE FROM authenticated`) | si `balance ≤ min_qty` y no hay alerta abierta ⇒ abre; si `balance > min_qty` y hay abierta ⇒ resuelve | void |

Validación de escala (`assert_quantity_scale(p_qty, p_unit)`): `unit` ⇒ `p_qty = trunc(p_qty)`; `ml`/`g` ⇒ `scale(p_qty) ≤ 2`. Error `invalid_quantity`.

### 5.5 `set_initial_balance` en detalle

1. `assert_admin()`.
2. Calcular `request_hash = md5(branch||product||qty||coalesce(reference,''))`.
3. Buscar `operations` con `(chain_id, idempotency_key)`. Si existe con igual hash ⇒ devolver `result` guardado, sin escribir. Si existe con hash distinto ⇒ `idempotency_conflict`.
4. Validar producto activo, sucursal activa, `p_qty ≥ 0`, escala, `p_qty ≤ max_movement_qty`.
5. `SELECT ... FOR UPDATE` sobre la fila `inventory`; si no existe ⇒ `not_enabled`.
6. Si `inventory.initialized_at` no es null, o existe cualquier `movements` para (branch, product) ⇒ `already_initialized`.
7. Insertar `operations (type='initial')`. Si `p_qty > 0`, insertar `movements (qty_delta = p_qty)`; si `p_qty = 0`, no se inserta movimiento (la restricción `qty_delta ≠ 0` se mantiene). Actualizar `inventory.balance = p_qty, initialized_at = now(), version = version + 1`.
8. `recalc_alert`. Insertar `audit_events`. Guardar `result` en `operations`. Devolver.

Un `p_qty = 0` es válido (registra que el producto se contó y estaba vacío), queda trazado por la operación y `initialized_at`, y deja una alerta abierta porque `0 ≤ min_qty`.

### 5.6 Convención de errores

`RAISE EXCEPTION USING MESSAGE = '<código>', DETAIL = '<texto en español>', ERRCODE = 'P0001'`. Códigos de SP1:

`not_authenticated`, `inactive_user`, `no_profile`, `permission_denied`, `not_found`, `duplicate_code`, `duplicate_sku`, `duplicate_email`, `invalid_code`, `invalid_sku`, `invalid_name`, `invalid_email`, `invalid_role`, `invalid_unit`, `invalid_quantity`, `invalid_key`, `unit_locked`, `has_stock`, `has_open_transfers`, `has_active_users`, `already_enabled`, `not_enabled`, `already_initialized`, `idempotency_conflict`, `last_admin`, `self_deactivation`, `branch_required`, `branch_inactive`, `product_inactive`.

`src/lib/errors.ts` mapea código → mensaje es-UY; código desconocido ⇒ "Ocurrió un error inesperado. El cambio no se guardó."

## 6. Frontend

### 6.1 Rutas y guardas

| Ruta | Acceso | Contenido |
|---|---|---|
| `/login` | público | email, contraseña, enlace a recuperar; errores del servidor visibles |
| `/auth/recuperar` | público | pide email; confirma envío sin revelar si existe |
| `/auth/restablecer` | sesión de recuperación | nueva contraseña ×2 |
| `/` | autenticado | redirige: admin → `/inicio`; operador → `/inventario`; sin perfil → `/sin-perfil` |
| `/inicio` | admin | tarjetas por sucursal (productos habilitados, alertas abiertas), accesos rápidos a catálogo, sucursales, usuarios |
| `/inventario` | ambos | operador: su sucursal fija. Admin: selector de sucursal + modo "Comparar locales" (una columna por sucursal). Columnas: producto, SKU, unidad, saldo, mínimo, estado (chip "Bajo mínimo" / "OK" / "Sin saldo inicial" cuando `initialized_at` es null). Búsqueda por nombre/SKU, filtro "solo bajo mínimo". Paginación 50 |
| `/inventario/:productId` | ambos | ficha, saldos por sucursal visibles según rol, mínimo, botón "Saldo inicial" (admin, si no inicializado), sección Historial con estado vacío "Disponible en la próxima versión" |
| `/catalogo` | admin | tabla con búsqueda; activos/inactivos |
| `/catalogo/nuevo`, `/catalogo/:id` | admin | formulario producto; unidad bloqueada si `unit_locked`; sección "Disponibilidad por sucursal" para habilitar y fijar mínimo |
| `/sucursales` | admin | lista + alta/edición inline en diálogo; desactivación con confirmación |
| `/usuarios` | admin | lista, alta/edición en diálogo; estado "Sin cuenta" cuando `auth_user_id` es null, con instrucción para crearla |
| `/sin-perfil` | autenticado | mensaje + cerrar sesión |
| `/403`, `*` | — | estados explícitos |

Guardas (`RequireAuth`, `RequireRole`) son ayuda visual. El servidor decide.

### 6.2 Layout

- Header persistente: logo/nombre, **pill de sucursal** (champagne) con nombre del local activo; admin puede cambiar; operador lo ve fijo. Menú de usuario con nombre, rol y "Cerrar sesión".
- Desktop ≥ 1024 px: rail lateral 16 rem. Móvil: bottom nav (Inicio/Inventario/Catálogo/Más según rol).
- Banner "Sin conexión" con `navigator.onLine` + eventos; botones de confirmación deshabilitados mientras dure.
- Sesión vencida: supabase-js emite `SIGNED_OUT` cuando el refresh token deja de ser válido; si no fue un cierre explícito, se marca en `sessionStorage` y `/login` muestra "Tu sesión venció. Volvé a ingresar."

### 6.3 Datos y estado

- `supabase.ts`: cliente único con `persistSession: true`.
- `useSession()` (onAuthStateChange) y `useProfile()` (query `profiles` propia; `staleTime` 60 s; refetch en foco).
- TanStack Query: claves `['branches']`, `['products', filtros]`, `['inventory', branchId | 'all', filtros]`, `['profiles']`. Mutaciones llaman `supabase.rpc(...)` e invalidan claves afectadas. Botón deshabilitado durante `isPending`; éxito solo tras respuesta.
- Formularios: `zod` + `react-hook-form` no se incorpora en SP1; formularios controlados simples con validación zod al enviar.

### 6.4 Cantidades

`src/lib/quantity.ts`:

- `parseQuantity(input: string, unit): Result<number>` acepta `1.974,50`, `1974,50`, `1974.50`; rechaza vacío, negativo, más de dos decimales, decimales en `unit`.
- `formatQuantity(value, unit)`: `Intl.NumberFormat('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })` para ml/g; entero para `unit`. Siempre seguido de la unidad ("1.974,50 ml", "6 u").
- `packagesToBase(packages, presentationQty)` para el diálogo de saldo inicial: muestra "2 envases × 1.000,00 ml = 2.000,00 ml" antes de confirmar.
- Idempotencia: `crypto.randomUUID()` generado al abrir el diálogo, reutilizado en reintentos.

### 6.5 Design system

`src/index.css` con `@theme` de Tailwind v4 usando `docs/referencia/stitch/DESIGN.md`:

- Superficies: `--color-canvas #FBFBF9`, `--color-surface #FFFFFF`, `--color-hairline #E7E5E4`.
- Primario `#1C1917` (hover `#292524`), champagne `#C59B27`, esmeralda `#047857`.
- Estados: bajo mínimo ámbar `#FEF3C7/#B45309`; tránsito índigo `#EEF2FF/#4338CA`; merma carmín `#FEE2E2/#B91C1C`; óptimo salvia `#D1FAE5/#047857`.
- Tipografía Plus Jakarta Sans (Google Fonts); `font-variant-numeric: tabular-nums` en cantidades; `label-caps` para cabeceras y chips.
- Radios 6–8 px en controles; `rounded-full` solo en chips y pill de sucursal.
- Foco: anillo 2 px champagne con offset 2 px. Contraste AA mínimo.

Componentes UI de SP1: `Button` (primary/secondary/danger), `Input`, `Select`, `Chip`, `BranchPill`, `DataTable` (tabla en desktop, cards en < 768 px), `Dialog`, `Toast`, `EmptyState`, `ErrorState`, `LoadingState`, `OfflineBanner`.

## 7. Manejo de errores

| Situación | Comportamiento |
|---|---|
| Error RPC con código conocido | Mensaje es-UY junto al formulario; datos del formulario se conservan |
| Error RPC desconocido / red | "No se pudo guardar. Verificá la conexión y reintentá." La clave de idempotencia se conserva para reintentar sin duplicar |
| 401 / JWT vencido | Redirección a `/login?expirada=1` con aviso |
| Sin conexión | Banner + confirmaciones deshabilitadas |
| Perfil inexistente o inactivo | `/sin-perfil` con mensaje y cierre de sesión |
| Ruta sin permiso | `/403` |

## 8. Pruebas

### 8.1 Unitarias (vitest, `npm test`)

- `quantity.test.ts`: parseo con coma/punto, rechazo de escala, `packagesToBase`, formateo es-UY.
- `errors.test.ts`: mapa de códigos y fallback.
- `schemas.test.ts`: zod de producto, sucursal, usuario, saldo inicial.

### 8.2 Integración con base (vitest, `npm run test:db`)

Configuración separada (`vitest.db.config.ts`) para que `npm test` nunca toque la base. Requiere `.env.test.local` con `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (ignorado por git); si falta, la suite falla al inicio con un mensaje claro. `setup.ts` crea una cadena `test-<uuid>`, tres usuarios Auth (admin, operador A en sucursal A, operador B en sucursal B) con la API admin, y borra todo al terminar.

| Caso | Prueba |
|---|---|
| CP-01 | cliente `anon` no lee `inventory` ni ejecuta `create_branch` |
| CP-02 | operador A no ve `inventory` de B; `set_min_qty` sobre B ⇒ `permission_denied` |
| CP-03 | operador intenta `update_profile` sobre sí mismo ⇒ `permission_denied` |
| CP-04 | admin desactiva a operador A; con su sesión vigente, `select inventory` devuelve 0 filas y RPC ⇒ `inactive_user` |
| CP-05 | SKU duplicado ⇒ `duplicate_sku`; `set_initial_balance` con −1 ⇒ `invalid_quantity`; unidad inválida rechazada por el enum |
| CP-07 | producto en `unit` con saldo inicial 0,5 ⇒ `invalid_quantity` |
| CP-21 | saldo inicial persiste tras nuevo login |
| CP-23 | tercera sucursal creada por RPC opera con inventario y operador propios |
| CP-31 | `set_min_qty`, `update_profile`, `upsert_product` dejan `audit_events` |
| CP-33 | producto con saldo > 0 no se desactiva (`has_stock`); con saldo 0 sí y conserva filas |
| Idempotencia | dos llamadas a `set_initial_balance` con la misma clave ⇒ un movimiento; misma clave con otra cantidad ⇒ `idempotency_conflict`; segunda inicialización con otra clave ⇒ `already_initialized`; inicialización con 0 deja `initialized_at` y ningún movimiento |
| profiles_public | operador ve id y nombre de todos los perfiles de su cadena, sin columna email; usuario inactivo obtiene cero filas |
| Último admin | desactivar al único admin ⇒ `last_admin` |

### 8.3 Fuera de SP1

Recorridos de navegador (Playwright), carga (RNF-03) y restauración (CP-28) quedan para SP4 y Construcción 7.

## 9. Datos de demostración (`supabase/seed.sql`)

- Cadena "Cadena Demo", zona `America/Montevideo`.
- Sucursales: Centro (`CEN`), Pocitos (`POC`).
- Perfiles: `admin@pelu.com` (admin), `centro@pelu.com` (operador CEN), `pocitos@pelu.com` (operador POC). Las cuentas Auth se crean a mano; contraseñas no viven en el repositorio.
- ~50 SKU: tinturas por tono (unit), oxidantes 10/20/30/40 vol (ml, envase 1.000), shampoo y acondicionador profesional (ml, envase 1.000), polvo decolorante (g, envase 500), ampollas y tratamientos (unit), guantes y descartables (unit), productos de venta cerrada (unit).
- Todos habilitados en ambas sucursales con mínimos razonables. Saldos iniciales insertados directamente en `operations`/`movements`/`inventory` por el seed (rol `postgres`), con `type='initial'`, `initialized_at = now()` y actor = perfil admin. Alertas abiertas donde corresponda.
- Valores determinísticos del guion (plan §23.2): shampoo profesional en Centro 2.000,00 ml, mínimo 1.980,00; shampoo venta 250 ml en Centro 10 u y Pocitos 2 u, mínimo 5 u.
- El seed es idempotente: borra y recrea la cadena demo si ya existe (cascada desde `chains`). Al final vuelve a vincular `profiles.auth_user_id` con `auth.users` por email, para que las cuentas creadas a mano sigan funcionando tras un re-seed.

## 10. Documentación entregable de SP1

- `README.md`: qué es, requisitos, instalación, variables, comandos, cómo correr pruebas.
- `docs/operacion.md`: crear proyecto Supabase, aplicar migraciones, deshabilitar registro público, crear cuentas para los perfiles del seed, generar tipos, deploy en Vercel, respaldo manual (`npx supabase db dump`).
- `docs/decisiones/ADR-001-arquitectura.md`: RPC-escribe/RLS-lee, Supabase cloud, Vite; alternativas y consecuencias.
- `docs/bitacora.md`: plantilla del plan §24.1 con la primera entrada (esta semana).

## 11. Fuera de alcance de SP1

Movimientos de ingreso/consumo/venta/merma, ajuste y reversión (SP2). Transferencias (SP3). Alertas más allá del recálculo por mínimo/habilitación, tablero, conteo físico, CSV, correo, Edge Functions de invitación, pruebas E2E (SP4). Lotes, códigos de barras, recetas, costeo (P2, fuera del semestre).

## 12. Secuencia sugerida de implementación

1. Scaffold Vite + Tailwind + tokens + lint/test config; commit.
2. `0001_schema.sql` + `seed.sql` mínimo; aplicar; generar tipos.
3. `0002_helpers_rls.sql`; pruebas DB de lectura (CP-01, 02, 04).
4. `0003_rpc.sql`; pruebas DB de escritura (resto de la matriz).
5. Auth UI + layout + guardas + `/sin-perfil`.
6. Sucursales, usuarios.
7. Catálogo + habilitación + mínimos.
8. Inventario, detalle, saldo inicial con conversión.
9. Seed completo (~50 SKU), README, operacion.md, ADR, bitácora; deploy preview en Vercel.
