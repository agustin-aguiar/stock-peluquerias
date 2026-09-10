# SP1 — Fundación y catálogo: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar operativa la base del sistema Stock Peluquerías: proyecto web desplegable, esquema PostgreSQL P0 completo en Supabase, autenticación con dos perfiles y restricción por sucursal, CRUD de sucursales/catálogo/usuarios/mínimos, inventario por local y saldo inicial trazable.

**Architecture:** SPA React (Vite) que lee tablas y vistas bajo RLS con supabase-js y escribe únicamente a través de funciones PostgreSQL `SECURITY DEFINER` que validan perfil, rol y cadena y registran auditoría en la misma transacción. Sin backend propio ni Edge Functions.

**Tech Stack:** Vite 8, React 19.3, TypeScript 5.9, Tailwind 4.3, React Router 8 (data mode), TanStack Query 5, supabase-js 2, zod 4, lucide-react 1, Vitest 5, Supabase CLI 2.117 (vía `npx`), Vercel.

**Spec:** `docs/superpowers/specs/2026-09-10-sp1-fundacion-catalogo-design.md`. Ante duda, el spec manda.

## Global Constraints

- Carpeta del proyecto: `C:\Users\aguia\OneDrive\Escritorio\peluqueria`, rama `main`. Todos los comandos se ejecutan desde ahí.
- Node ≥ 22.12 (instalado: 24.19). No hay Docker: nunca usar `supabase start`, `db reset` ni `--local`. Todo va contra el proyecto Supabase enlazado (`--linked`).
- Versiones fijadas en `package.json` de la Tarea 1. `typescript` queda en `~5.9.3` (no 7.x).
- Nombre visible de la app: **Stock Peluquerías**. Interfaz en español rioplatense (voseo: "Ingresá", "Verificá").
- Cantidades: `numeric(14,2)` en base; en UI se muestran con punto de miles y coma decimal ("1.974,50 ml", "6 u"). Unidades: `unit` → "u", `ml`, `g`. Nunca se redondea un dato inválido.
- Enum values en inglés (`admin`, `operator`, `unit`, `ml`, `g`, `initial`…); etiquetas en español solo en UI.
- Escrituras solo por RPC. Ninguna política RLS de INSERT/UPDATE/DELETE. `REVOKE` explícito para `anon` y `authenticated`.
- Errores RPC: `MESSAGE` = código máquina (snake_case), `DETAIL` = texto humano, `ERRCODE = 'P0001'`.
- Fuera de alcance: movimientos de consumo/ingreso/ajuste (SP2), transferencias (SP3), tablero/conteo/CSV/correo/Edge Functions/E2E (SP4). No agregar "por si acaso".
- Secretos nunca en el repositorio: `.env.local` y `.env.test.local` están en `.gitignore`. El agente no escribe claves; el usuario las pega.
- Cada commit termina con la línea `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Mensajes en español, formato `tipo: descripción` (`feat`, `fix`, `test`, `docs`, `chore`, `db`).
- Antes de marcar una tarea terminada: `npm run typecheck` y `npm test` en verde; para tareas de base, además `npm run test:db` en verde.

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `package.json`, `vite.config.ts`, `vitest.db.config.ts`, `tsconfig.json`, `eslint.config.js`, `.prettierrc`, `index.html`, `vercel.json`, `.env.example`, `.env.test.example` | Tooling y configuración |
| `src/index.css` | Tokens `@theme` del design system y utilidades (`tnum`, `label-caps`) |
| `src/main.tsx`, `src/App.tsx` | Arranque: providers + router |
| `src/vite-env.d.ts` | Tipos de `import.meta.env` |
| `src/lib/quantity.ts` | Parseo y formato de cantidades es-UY, conversión envases → unidad base |
| `src/lib/errors.ts` | Mapa código RPC → mensaje; extracción de código desde errores supabase-js |
| `src/lib/supabase.ts` | Cliente único tipado |
| `src/lib/validation.ts` | Helpers zod: primer mensaje, mensajes por campo |
| `src/types/database.ts` | Generado por `supabase gen types` (no editar a mano) |
| `src/types/models.ts` | Alias de tipos de filas, vistas y enums |
| `src/components/ui/*.tsx` | Button, Input, Select, Chip, Dialog, Toast, OfflineBanner, PageHeader, estados (Loading/Empty/Error) |
| `src/features/auth/*` | SessionProvider, useProfile, páginas Login/Recuperar/Restablecer/SinPerfil, mapa de errores Auth |
| `src/app/guards.tsx` | RequireAuth, RequireProfile (+ProfileContext), RequireRole |
| `src/app/router.tsx`, `src/app/providers.tsx` | Árbol de rutas y providers |
| `src/app/layout/AppShell.tsx`, `nav.ts`, `BranchPill.tsx` | Header, rail lateral, bottom nav, pill de sucursal |
| `src/features/branches/activeBranch.tsx`, `api.ts`, `schema.ts`, `SucursalesPage.tsx`, `BranchDialog.tsx` | Sucursales y sucursal activa |
| `src/features/users/api.ts`, `schema.ts`, `UsuariosPage.tsx`, `ProfileDialog.tsx` | Usuarios |
| `src/features/products/api.ts`, `schema.ts`, `CatalogoPage.tsx`, `ProductoFormPage.tsx`, `AvailabilitySection.tsx` | Catálogo y habilitación por sucursal |
| `src/features/inventory/api.ts`, `InventarioPage.tsx`, `ProductoDetallePage.tsx`, `SaldoInicialDialog.tsx` | Inventario, detalle y saldo inicial |
| `src/features/home/api.ts`, `InicioAdminPage.tsx`, `HomeRedirect.tsx` | Inicio |
| `src/pages/ForbiddenPage.tsx`, `NotFoundPage.tsx` | Estados 403/404 |
| `supabase/config.toml`, `migrations/0001_schema.sql`, `0002_helpers_rls.sql`, `0003_rpc_catalog.sql`, `0004_rpc_inventory.sql`, `seed.sql` | Base de datos |
| `tests/unit/*.test.ts` | Unitarias puras |
| `tests/db/env.ts`, `harness.ts`, `auth.test.ts`, `catalog.test.ts`, `inventory.test.ts` | Integración contra Supabase |
| `README.md`, `docs/operacion.md`, `docs/decisiones/ADR-001-arquitectura.md`, `docs/bitacora.md` | Documentación |

---

### Task 0: Prerrequisitos manuales del usuario (bloqueante)

Estas acciones las hace **el usuario**, no el agente, porque implican crear cuentas y manejar contraseñas/claves. El agente verifica y se detiene si faltan.

- [ ] **Paso 1: Crear proyecto Supabase**

En https://supabase.com/dashboard: New project → nombre `stock-peluquerias-dev`, región `South America (São Paulo)`, plan Free. Guardar la contraseña de la base en un gestor de contraseñas (se pide una sola vez al enlazar).

- [ ] **Paso 2: Deshabilitar registro público**

Dashboard → Authentication → Sign In / Providers → Email → apagar **"Allow new users to sign up"** → Save. Dejar "Confirm email" como esté (las cuentas se crean confirmadas desde el dashboard).

- [ ] **Paso 3: Enlazar la CLI (en la terminal del usuario, dentro de la carpeta del proyecto)**

```bash
npx supabase@2.117.0 login
```

```bash
npx supabase@2.117.0 link --project-ref <ref-del-proyecto>
```

El `<ref>` está en Project Settings → General (20 letras minúsculas). Al pedir "database password", ingresarla: la CLI la guarda en el almacén de credenciales de Windows y `db push`/`db query` no la vuelven a pedir.

- [ ] **Paso 4: Crear `.env.local` y `.env.test.local` en la raíz del proyecto (no se commitean)**

Los valores están en Project Settings → API Keys (`anon` / `publishable` y `service_role` / `secret`) y Project Settings → General (URL).

`.env.local`:

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

`.env.test.local`:

```
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
```

- [ ] **Paso 5 (agente): verificar prerrequisitos antes de cualquier tarea de base**

Run: `ls supabase/.temp/project-ref .env.local .env.test.local 2>&1`
Expected: los tres existen. Si falta `supabase/.temp/project-ref`, el proyecto no está enlazado: detenerse y pedir al usuario que complete el Paso 3. (La carpeta `supabase/` aparece recién en la Tarea 4; si la Tarea 4 corre antes del link, `db push` fallará con "Cannot find project ref": mismo tratamiento.)

---

### Task 1: Scaffold del proyecto, tokens y prueba de humo

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.db.config.ts`, `eslint.config.js`, `.prettierrc`, `index.html`, `vercel.json`, `.env.example`, `.env.test.example`, `src/index.css`, `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`, `tests/unit/smoke.test.ts`
- Modify: `.gitignore` (agregar excepción `!.env.test.example`)

**Interfaces:**
- Produces: alias `@/` → `src/`; script `npm test` (unit), `npm run test:db` (integración), `npm run typecheck`, `npm run build`, `npm run db:push`, `npm run db:seed`, `npm run db:types`. Tokens de color `canvas`, `surface`, `hairline`, `ink`, `ink-hover`, `muted`, `champagne`, `emerald`, `amber-bg/fg`, `indigo-bg/fg`, `carmine-bg/fg`, `sage-bg/fg`; utilidades `tnum` y `label-caps`.

- [ ] **Paso 1: Escribir `package.json`**

```json
{
  "name": "stock-peluquerias",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": ">=22.12" },
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "format": "prettier --write .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:db": "vitest run --config vitest.db.config.ts",
    "db:push": "supabase db push --yes",
    "db:seed": "supabase db push --yes --include-seed",
    "db:types": "supabase gen types --lang typescript --linked --schema public > src/types/database.ts"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.116.0",
    "@tanstack/react-query": "^5.102.8",
    "lucide-react": "^1.44.0",
    "react": "^19.3.0",
    "react-dom": "^19.3.0",
    "react-router": "^8.3.1",
    "zod": "^4.6.1"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@tailwindcss/vite": "^4.3.3",
    "@types/node": "^22.20.2",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "@vitejs/plugin-react": "^6.1.1",
    "dotenv": "^17.4.2",
    "eslint": "^10.10.0",
    "globals": "^17.12.0",
    "prettier": "^3.9.6",
    "supabase": "^2.117.0",
    "tailwindcss": "^4.3.3",
    "typescript": "~5.9.3",
    "typescript-eslint": "^8.70.0",
    "vite": "^8.3.0",
    "vitest": "^5.0.0"
  }
}
```

- [ ] **Paso 2: Instalar**

Run: `npm install`
Expected: termina sin `ERESOLVE`. Si un rango no resuelve, ajustar solo ese paquete a la versión que npm sugiera y anotarlo en el commit.

- [ ] **Paso 3: Escribir `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "types": ["vite/client", "node"],
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src", "tests", "vite.config.ts", "vitest.db.config.ts"]
}
```

- [ ] **Paso 4: Escribir `vite.config.ts` y `vitest.db.config.ts`**

`vite.config.ts`:

```ts
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
})
```

`vitest.db.config.ts`:

```ts
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['tests/db/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/db/env.ts'],
    testTimeout: 30_000,
    hookTimeout: 90_000,
    fileParallelism: false,
  },
})
```

- [ ] **Paso 5: Escribir `eslint.config.js` y `.prettierrc`**

`eslint.config.js`:

```js
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'src/types/database.ts', 'docs'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.browser, ...globals.node } },
  },
)
```

`.prettierrc`:

```json
{ "semi": false, "singleQuote": true, "printWidth": 100, "trailingComma": "all" }
```

- [ ] **Paso 6: Escribir `index.html`, `vercel.json`, `.env.example`, `.env.test.example` y ajustar `.gitignore`**

`index.html`:

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light" />
    <title>Stock Peluquerías</title>
  </head>
  <body class="bg-canvas text-ink font-sans antialiased">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`vercel.json`:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

`.env.example`:

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

`.env.test.example`:

```
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
```

En `.gitignore`, debajo de `!.env.example` agregar la línea `!.env.test.example`.

- [ ] **Paso 7: Escribir `src/index.css` con los tokens**

```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap');
@import 'tailwindcss';

@theme {
  --font-sans: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;

  --color-canvas: #fbfbf9;
  --color-surface: #ffffff;
  --color-hairline: #e7e5e4;
  --color-ink: #1c1917;
  --color-ink-hover: #292524;
  --color-muted: #78716c;
  --color-champagne: #c59b27;
  --color-emerald: #047857;

  --color-amber-bg: #fef3c7;
  --color-amber-fg: #b45309;
  --color-indigo-bg: #eef2ff;
  --color-indigo-fg: #4338ca;
  --color-carmine-bg: #fee2e2;
  --color-carmine-fg: #b91c1c;
  --color-sage-bg: #d1fae5;
  --color-sage-fg: #047857;

  --radius-control: 0.375rem;
}

@utility tnum {
  font-variant-numeric: tabular-nums;
}

@utility label-caps {
  font-size: 0.6875rem;
  font-weight: 700;
  line-height: 1rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

@layer base {
  :focus-visible {
    outline: 2px solid var(--color-champagne);
    outline-offset: 2px;
  }
}
```

- [ ] **Paso 8: Escribir `src/vite-env.d.ts`, `src/main.tsx` y `src/App.tsx` provisorio**

`src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

`src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

`src/App.tsx` (provisorio, se reemplaza en la Tarea 10):

```tsx
export function App() {
  return (
    <main className="mx-auto max-w-5xl p-8">
      <p className="label-caps text-muted">Stock Peluquerías</p>
      <h1 className="mt-2 text-3xl font-bold">Scaffold listo</h1>
      <p className="mt-2 tnum">1.974,50 ml</p>
    </main>
  )
}
```

- [ ] **Paso 9: Prueba de humo unitaria**

`tests/unit/smoke.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

describe('smoke', () => {
  it('vitest corre', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Paso 10: Verificar**

Run: `npm test`
Expected: `1 passed`.

Run: `npm run typecheck`
Expected: sin errores.

Run: `npm run build`
Expected: `dist/` generado, sin errores. (`npm run test:db` todavía no tiene archivos: no ejecutar.)

- [ ] **Paso 11: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + Tailwind con tokens del design system

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 2: `src/lib/quantity.ts` (TDD)

**Files:**
- Create: `src/lib/quantity.ts`
- Test: `tests/unit/quantity.test.ts`

**Interfaces:**
- Produces:
  - `type UnitKind = 'unit' | 'ml' | 'g'`
  - `UNIT_LABEL: Record<UnitKind, string>` → `{ unit: 'u', ml: 'ml', g: 'g' }`
  - `UNIT_NAME: Record<UnitKind, string>` → `{ unit: 'Unidad', ml: 'Mililitros', g: 'Gramos' }`
  - `parseQuantity(input: string, unit: UnitKind): { ok: true; value: number } | { ok: false; error: string }`
  - `formatNumber(value: number, unit: UnitKind): string` → `"1.974,50"` / `"6"`
  - `formatQuantity(value: number, unit: UnitKind): string` → `"1.974,50 ml"` / `"6 u"`
  - `packagesToBase(packages: number, presentationQty: number): number`

- [ ] **Paso 1: Escribir el test que falla**

`tests/unit/quantity.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { formatNumber, formatQuantity, packagesToBase, parseQuantity } from '@/lib/quantity'

describe('parseQuantity', () => {
  it('acepta coma decimal y punto de miles', () => {
    expect(parseQuantity('1.974,50', 'ml')).toEqual({ ok: true, value: 1974.5 })
    expect(parseQuantity('1974,5', 'ml')).toEqual({ ok: true, value: 1974.5 })
  })
  it('acepta punto decimal cuando no hay coma', () => {
    expect(parseQuantity('1974.50', 'g')).toEqual({ ok: true, value: 1974.5 })
    expect(parseQuantity(' 25 ', 'unit')).toEqual({ ok: true, value: 25 })
  })
  it('rechaza vacío, negativo y texto', () => {
    expect(parseQuantity('', 'ml').ok).toBe(false)
    expect(parseQuantity('-5', 'ml').ok).toBe(false)
    expect(parseQuantity('abc', 'ml').ok).toBe(false)
    expect(parseQuantity('1,2,3', 'ml').ok).toBe(false)
  })
  it('rechaza más de dos decimales sin redondear', () => {
    const r = parseQuantity('25,555', 'ml')
    expect(r).toEqual({ ok: false, error: 'Se admiten hasta dos decimales.' })
  })
  it('rechaza decimales en productos por unidad', () => {
    const r = parseQuantity('0,5', 'unit')
    expect(r).toEqual({ ok: false, error: 'Los productos por unidad solo admiten cantidades enteras.' })
  })
  it('acepta cero', () => {
    expect(parseQuantity('0', 'unit')).toEqual({ ok: true, value: 0 })
    expect(parseQuantity('0,00', 'ml')).toEqual({ ok: true, value: 0 })
  })
})

describe('formatNumber / formatQuantity', () => {
  it('ml y g con dos decimales, punto de miles y coma decimal', () => {
    expect(formatNumber(1974.5, 'ml')).toBe('1.974,50')
    expect(formatNumber(0, 'g')).toBe('0,00')
    expect(formatNumber(1234567.8, 'ml')).toBe('1.234.567,80')
    expect(formatQuantity(1974.5, 'ml')).toBe('1.974,50 ml')
  })
  it('unidades sin decimales', () => {
    expect(formatNumber(6, 'unit')).toBe('6')
    expect(formatNumber(1200, 'unit')).toBe('1.200')
    expect(formatQuantity(6, 'unit')).toBe('6 u')
  })
  it('conserva el signo', () => {
    expect(formatQuantity(-25.5, 'ml')).toBe('-25,50 ml')
  })
})

describe('packagesToBase', () => {
  it('2 envases de 1.000 ml son 2.000 ml', () => {
    expect(packagesToBase(2, 1000)).toBe(2000)
  })
  it('evita error de coma flotante', () => {
    expect(packagesToBase(3, 0.1)).toBe(0.3)
  })
})
```

- [ ] **Paso 2: Correr y verificar que falla**

Run: `npm test -- tests/unit/quantity.test.ts`
Expected: FAIL, `Failed to resolve import "@/lib/quantity"`.

- [ ] **Paso 3: Implementar `src/lib/quantity.ts`**

```ts
export type UnitKind = 'unit' | 'ml' | 'g'

export const UNIT_LABEL: Record<UnitKind, string> = { unit: 'u', ml: 'ml', g: 'g' }
export const UNIT_NAME: Record<UnitKind, string> = { unit: 'Unidad', ml: 'Mililitros', g: 'Gramos' }

export type ParseResult = { ok: true; value: number } | { ok: false; error: string }

/**
 * Convierte texto ingresado por el usuario a número.
 * Acepta "1.974,50", "1974,50", "1974.50" y "25". No redondea: si hay más
 * decimales que los admitidos, devuelve error.
 */
export function parseQuantity(input: string, unit: UnitKind): ParseResult {
  const raw = input.trim()
  if (raw === '') return { ok: false, error: 'Ingresá una cantidad.' }

  // Con coma: la coma es decimal y los puntos son separadores de miles.
  // Sin coma: el punto (si hay) es decimal.
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return { ok: false, error: 'La cantidad debe ser un número positivo.' }
  }
  const decimals = normalized.split('.')[1]?.length ?? 0
  if (unit === 'unit' && decimals > 0) {
    return { ok: false, error: 'Los productos por unidad solo admiten cantidades enteras.' }
  }
  if (decimals > 2) return { ok: false, error: 'Se admiten hasta dos decimales.' }

  const value = Number(normalized)
  if (!Number.isFinite(value)) return { ok: false, error: 'La cantidad no es válida.' }
  return { ok: true, value }
}

/** "1.974,50" para ml/g; "1.200" para unidades. Sin sufijo de unidad. */
export function formatNumber(value: number, unit: UnitKind): string {
  const decimals = unit === 'unit' ? 0 : 2
  const fixed = Math.abs(value).toFixed(decimals)
  const [intPart, fracPart] = fixed.split('.')
  const grouped = (intPart ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const sign = value < 0 ? '-' : ''
  return fracPart ? `${sign}${grouped},${fracPart}` : `${sign}${grouped}`
}

/** "1.974,50 ml" / "6 u". Siempre cantidad y unidad juntas. */
export function formatQuantity(value: number, unit: UnitKind): string {
  return `${formatNumber(value, unit)} ${UNIT_LABEL[unit]}`
}

/** Envases × contenido por envase, redondeado a 2 decimales. */
export function packagesToBase(packages: number, presentationQty: number): number {
  return Math.round(packages * presentationQty * 100) / 100
}
```

- [ ] **Paso 4: Correr y verificar que pasa**

Run: `npm test -- tests/unit/quantity.test.ts`
Expected: todos PASS.

- [ ] **Paso 5: Commit**

```bash
git add src/lib/quantity.ts tests/unit/quantity.test.ts
git commit -m "feat: parseo y formato de cantidades es-UY con conversión de envases

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: `src/lib/errors.ts` (TDD)

**Files:**
- Create: `src/lib/errors.ts`
- Test: `tests/unit/errors.test.ts`

**Interfaces:**
- Produces:
  - `RPC_MESSAGES: Record<string, string>` (código → mensaje es-UY)
  - `GENERIC_ERROR`, `NETWORK_ERROR` (strings)
  - `rpcErrorCode(err: unknown): string | null`
  - `messageFor(err: unknown): string`

- [ ] **Paso 1: Escribir el test que falla**

`tests/unit/errors.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { GENERIC_ERROR, NETWORK_ERROR, RPC_MESSAGES, messageFor, rpcErrorCode } from '@/lib/errors'

describe('rpcErrorCode', () => {
  it('extrae el código de un PostgrestError P0001', () => {
    const err = { code: 'P0001', message: 'duplicate_sku', details: 'Ya existe.', hint: null }
    expect(rpcErrorCode(err)).toBe('duplicate_sku')
  })
  it('extrae el código de un Error nativo con mensaje snake_case', () => {
    expect(rpcErrorCode(new Error('permission_denied'))).toBe('permission_denied')
  })
  it('devuelve null si el mensaje no es un código', () => {
    expect(rpcErrorCode(new Error('relation "x" does not exist'))).toBeNull()
    expect(rpcErrorCode(null)).toBeNull()
    expect(rpcErrorCode('texto')).toBeNull()
  })
})

describe('messageFor', () => {
  it('mapea códigos conocidos', () => {
    expect(messageFor({ code: 'P0001', message: 'last_admin' })).toBe(RPC_MESSAGES.last_admin)
  })
  it('usa el DETAIL del servidor si el código es desconocido pero hay detalle', () => {
    expect(messageFor({ code: 'P0001', message: 'algo_nuevo', details: 'Texto del servidor.' })).toBe(
      'Texto del servidor.',
    )
  })
  it('detecta errores de red', () => {
    expect(messageFor(new TypeError('Failed to fetch'))).toBe(NETWORK_ERROR)
    expect(messageFor({ message: 'TypeError: Failed to fetch' })).toBe(NETWORK_ERROR)
  })
  it('cae al genérico', () => {
    expect(messageFor(new Error('boom'))).toBe(GENERIC_ERROR)
    expect(messageFor(undefined)).toBe(GENERIC_ERROR)
  })
  it('todos los códigos del spec tienen mensaje', () => {
    const spec = [
      'not_authenticated', 'inactive_user', 'no_profile', 'permission_denied', 'not_found',
      'duplicate_code', 'duplicate_sku', 'duplicate_email', 'invalid_code', 'invalid_sku',
      'invalid_name', 'invalid_email', 'invalid_role', 'invalid_unit', 'invalid_quantity',
      'invalid_key', 'unit_locked', 'has_stock', 'has_open_transfers', 'has_active_users',
      'already_enabled', 'not_enabled', 'already_initialized', 'idempotency_conflict',
      'last_admin', 'self_deactivation', 'branch_required', 'branch_inactive', 'product_inactive',
    ]
    for (const code of spec) expect(RPC_MESSAGES[code], code).toBeTruthy()
  })
})
```

- [ ] **Paso 2: Correr y verificar que falla**

Run: `npm test -- tests/unit/errors.test.ts`
Expected: FAIL, import no resuelto.

- [ ] **Paso 3: Implementar `src/lib/errors.ts`**

```ts
export const RPC_MESSAGES: Record<string, string> = {
  not_authenticated: 'Iniciá sesión para continuar.',
  inactive_user: 'Tu usuario fue desactivado. Contactá al administrador.',
  no_profile: 'Tu cuenta no tiene un perfil asignado. Contactá al administrador.',
  permission_denied: 'No tenés permiso para esta acción.',
  not_found: 'El registro no existe o no pertenece a tu cadena.',
  duplicate_code: 'Ya existe una sucursal con ese código.',
  duplicate_sku: 'Ya existe un producto con ese SKU.',
  duplicate_email: 'Ya existe un usuario con ese email.',
  invalid_code: 'El código debe tener entre 2 y 8 letras mayúsculas o números.',
  invalid_sku: 'El SKU admite letras, números, punto, guion y guion bajo (máximo 40).',
  invalid_name: 'El nombre es obligatorio.',
  invalid_email: 'El email no es válido.',
  invalid_role: 'El rol no es válido.',
  invalid_unit: 'La unidad no es válida.',
  invalid_quantity: 'La cantidad no es válida para esta unidad.',
  invalid_key: 'Falta el identificador de la operación. Cerrá y volvé a abrir el formulario.',
  unit_locked: 'La unidad no se puede cambiar: el producto ya tiene saldo o movimientos.',
  has_stock: 'No se puede desactivar mientras haya saldo.',
  has_open_transfers: 'No se puede desactivar con transferencias abiertas.',
  has_active_users: 'La sucursal tiene usuarios activos asignados.',
  already_enabled: 'El producto ya está habilitado en esa sucursal.',
  not_enabled: 'El producto no está habilitado en esa sucursal.',
  already_initialized: 'El saldo inicial ya fue registrado. Usá un ingreso o un ajuste.',
  idempotency_conflict: 'Esta operación ya se envió con otros datos. Cerrá y volvé a abrir el formulario.',
  last_admin: 'No se puede desactivar ni degradar al último administrador activo.',
  self_deactivation: 'No podés desactivar tu propio usuario.',
  branch_required: 'Un operador necesita una sucursal asignada.',
  branch_inactive: 'La sucursal no existe o está inactiva.',
  product_inactive: 'El producto está inactivo.',
}

export const GENERIC_ERROR = 'Ocurrió un error inesperado. El cambio no se guardó.'
export const NETWORK_ERROR = 'No se pudo conectar. Verificá la conexión y reintentá.'

const CODE_RE = /^[a-z][a-z0-9_]*$/

type ErrorLike = { message?: unknown; details?: unknown; code?: unknown }

function asErrorLike(err: unknown): ErrorLike | null {
  if (err && typeof err === 'object') return err as ErrorLike
  return null
}

/** Devuelve el código máquina (MESSAGE del RAISE) si el error viene de una RPC. */
export function rpcErrorCode(err: unknown): string | null {
  const e = asErrorLike(err)
  if (!e || typeof e.message !== 'string') return null
  const msg = e.message.trim()
  return CODE_RE.test(msg) ? msg : null
}

function isNetworkError(err: unknown): boolean {
  const e = asErrorLike(err)
  const msg = typeof e?.message === 'string' ? e.message : ''
  return /failed to fetch|networkerror|network request failed|load failed/i.test(msg)
}

/** Mensaje en español para mostrar al usuario. Nunca expone texto técnico. */
export function messageFor(err: unknown): string {
  const code = rpcErrorCode(err)
  if (code && RPC_MESSAGES[code]) return RPC_MESSAGES[code]
  const e = asErrorLike(err)
  if (code && typeof e?.details === 'string' && e.details.trim()) return e.details.trim()
  if (isNetworkError(err)) return NETWORK_ERROR
  return GENERIC_ERROR
}
```

- [ ] **Paso 4: Correr y verificar que pasa**

Run: `npm test`
Expected: todos PASS (smoke, quantity, errors).

- [ ] **Paso 5: Commit**

```bash
git add src/lib/errors.ts tests/unit/errors.test.ts
git commit -m "feat: mapa de errores RPC a mensajes en español

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 4: Migración `0001_schema.sql`, seed mínimo y cuentas demo

**Files:**
- Create: `supabase/config.toml` (vía `supabase init`), `supabase/migrations/0001_schema.sql`, `supabase/seed.sql` (versión mínima; se completa en la Tarea 16)

**Interfaces:**
- Produces: tipos `user_role`, `unit_kind`, `operation_type`, `transfer_status`, `alert_status`; tablas `chains`, `branches`, `profiles`, `products`, `inventory`, `operations`, `transfers`, `movements`, `alerts`, `audit_events`; trigger `on_auth_user_created` → `public.handle_new_auth_user()`. IDs fijos del seed: cadena `11111111-1111-4111-8111-111111111111`, Centro `22222222-2222-4222-8222-222222222201`, Pocitos `22222222-2222-4222-8222-222222222202`, admin `33333333-3333-4333-8333-333333333301`, operador Centro `…302`, operador Pocitos `…303`. Emails demo: `admin@pelu.com`, `centro@pelu.com`, `pocitos@pelu.com`.

- [ ] **Paso 1: Verificar prerrequisitos (Tarea 0, Paso 5)**

Run: `ls .env.local .env.test.local`
Expected: existen. Si no, detenerse.

- [ ] **Paso 2: Inicializar carpeta `supabase/`**

Run: `npx supabase init`
Expected: crea `supabase/config.toml`. Si pregunta por VS Code/Deno responder `n` (o aceptar: el resultado es irrelevante). Verificar que `supabase/config.toml` contenga la sección `[db.seed]` con `enabled = true` y `sql_paths = ["./seed.sql"]`; si no está, agregarla al final:

```toml
[db.seed]
enabled = true
sql_paths = ["./seed.sql"]
```

- [ ] **Paso 3: Escribir `supabase/migrations/0001_schema.sql`**

```sql
-- 0001_schema.sql — esquema P0 completo (SP1). Escrituras solo por RPC (ver 0002/0003/0004).

create type public.user_role as enum ('admin', 'operator');
create type public.unit_kind as enum ('unit', 'ml', 'g');
create type public.operation_type as enum (
  'initial', 'purchase', 'consumption', 'sale', 'shrinkage',
  'adjustment', 'reversal', 'dispatch', 'receipt', 'resolution'
);
create type public.transfer_status as enum (
  'draft', 'dispatched', 'received', 'disputed', 'resolved', 'cancelled'
);
create type public.alert_status as enum ('open', 'resolved');

create table public.chains (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  timezone text not null default 'America/Montevideo',
  created_at timestamptz not null default now()
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references public.chains (id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9]{2,8}$'),
  name text not null check (length(trim(name)) between 1 and 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (chain_id, code)
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references public.chains (id) on delete cascade,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  email text not null check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  role public.user_role not null,
  branch_id uuid references public.branches (id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint profiles_role_branch check (
    (role = 'operator' and branch_id is not null) or (role = 'admin' and branch_id is null)
  )
);
create unique index profiles_chain_email_key on public.profiles (chain_id, lower(email));
create index profiles_branch_idx on public.profiles (branch_id);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references public.chains (id) on delete cascade,
  sku text not null check (sku ~ '^[A-Za-z0-9._-]{1,40}$'),
  name text not null check (length(trim(name)) between 1 and 160),
  brand text,
  category text,
  variant text,
  unit public.unit_kind not null,
  presentation text,
  presentation_qty numeric(14,2) check (presentation_qty is null or presentation_qty > 0),
  max_movement_qty numeric(14,2) not null default 100000 check (max_movement_qty > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index products_chain_sku_key on public.products (chain_id, lower(sku));
create index products_chain_name_idx on public.products (chain_id, name);

create table public.inventory (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references public.chains (id) on delete cascade,
  branch_id uuid not null references public.branches (id),
  product_id uuid not null references public.products (id),
  balance numeric(14,2) not null default 0 check (balance >= 0),
  min_qty numeric(14,2) not null default 0 check (min_qty >= 0),
  version bigint not null default 1,
  initialized_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (branch_id, product_id)
);
create index inventory_chain_branch_idx on public.inventory (chain_id, branch_id);
create index inventory_product_idx on public.inventory (product_id);

create table public.operations (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references public.chains (id) on delete cascade,
  type public.operation_type not null,
  actor_profile_id uuid not null references public.profiles (id),
  idempotency_key uuid not null,
  request_hash text not null,
  reason text,
  reference text,
  result jsonb,
  created_at timestamptz not null default now(),
  unique (chain_id, idempotency_key)
);

create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references public.chains (id) on delete cascade,
  product_id uuid not null references public.products (id),
  from_branch_id uuid not null references public.branches (id),
  to_branch_id uuid not null references public.branches (id),
  qty numeric(14,2) not null check (qty > 0),
  status public.transfer_status not null default 'draft',
  shipping_ref text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  dispatched_by uuid references public.profiles (id),
  dispatched_at timestamptz,
  received_by uuid references public.profiles (id),
  received_at timestamptz,
  dispute_note text,
  disputed_by uuid references public.profiles (id),
  disputed_at timestamptz,
  resolved_qty_received numeric(14,2) check (resolved_qty_received is null or resolved_qty_received >= 0),
  resolved_qty_returned numeric(14,2) check (resolved_qty_returned is null or resolved_qty_returned >= 0),
  resolved_qty_lost numeric(14,2) check (resolved_qty_lost is null or resolved_qty_lost >= 0),
  resolution_note text,
  resolved_by uuid references public.profiles (id),
  resolved_at timestamptz,
  constraint transfers_distinct_branches check (from_branch_id <> to_branch_id)
);
create index transfers_chain_status_idx on public.transfers (chain_id, status);
create index transfers_from_idx on public.transfers (from_branch_id);
create index transfers_to_idx on public.transfers (to_branch_id);

create table public.movements (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references public.chains (id) on delete cascade,
  operation_id uuid not null references public.operations (id),
  product_id uuid not null references public.products (id),
  branch_id uuid references public.branches (id),
  transfer_id uuid references public.transfers (id),
  qty_delta numeric(14,2) not null check (qty_delta <> 0),
  unit public.unit_kind not null,
  reverses_movement_id uuid unique references public.movements (id),
  created_at timestamptz not null default now(),
  -- branch_id null = ubicación lógica "tránsito", que exige transfer_id
  constraint movements_location check (branch_id is not null or transfer_id is not null)
);
create index movements_chain_product_idx on public.movements (chain_id, product_id, created_at desc);
create index movements_branch_idx on public.movements (branch_id, created_at desc);
create index movements_transfer_idx on public.movements (transfer_id) where transfer_id is not null;
create index movements_operation_idx on public.movements (operation_id);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references public.chains (id) on delete cascade,
  branch_id uuid not null references public.branches (id),
  product_id uuid not null references public.products (id),
  status public.alert_status not null default 'open',
  opened_at timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index alerts_one_open_idx on public.alerts (branch_id, product_id) where status = 'open';
create index alerts_chain_status_idx on public.alerts (chain_id, status);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references public.chains (id) on delete cascade,
  actor_profile_id uuid references public.profiles (id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_chain_created_idx on public.audit_events (chain_id, created_at desc);

-- Vincula una cuenta Auth recién creada con el perfil pre-registrado por email.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.profiles
     set auth_user_id = new.id
   where id = (
     select p.id from public.profiles p
      where p.auth_user_id is null and lower(p.email) = lower(new.email)
      order by p.created_at
      limit 1
   );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();
```

- [ ] **Paso 4: Escribir `supabase/seed.sql` (versión mínima)**

```sql
-- seed.sql — cadena demo reproducible. Idempotente: borra y recrea "Cadena Demo".
-- Las cuentas Auth se crean a mano (docs/operacion.md); al final se re-vinculan por email.

delete from public.chains where name = 'Cadena Demo';

insert into public.chains (id, name, timezone)
values ('11111111-1111-4111-8111-111111111111', 'Cadena Demo', 'America/Montevideo');

insert into public.branches (id, chain_id, code, name) values
  ('22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111111', 'CEN', 'Sucursal Centro'),
  ('22222222-2222-4222-8222-222222222202', '11111111-1111-4111-8111-111111111111', 'POC', 'Sucursal Pocitos');

insert into public.profiles (id, chain_id, email, full_name, role, branch_id) values
  ('33333333-3333-4333-8333-333333333301', '11111111-1111-4111-8111-111111111111', 'admin@pelu.com',   'Valeria Méndez', 'admin',    null),
  ('33333333-3333-4333-8333-333333333302', '11111111-1111-4111-8111-111111111111', 'centro@pelu.com',  'Sofía Varela',   'operator', '22222222-2222-4222-8222-222222222201'),
  ('33333333-3333-4333-8333-333333333303', '11111111-1111-4111-8111-111111111111', 'pocitos@pelu.com', 'Esteban Rossi',  'operator', '22222222-2222-4222-8222-222222222202');

-- Re-vincular cuentas Auth existentes (tras un re-seed los perfiles se recrean).
update public.profiles p
   set auth_user_id = u.id
  from auth.users u
 where p.chain_id = '11111111-1111-4111-8111-111111111111'
   and p.auth_user_id is null
   and lower(u.email) = lower(p.email)
   and not exists (select 1 from public.profiles q where q.auth_user_id = u.id);
```

- [ ] **Paso 5: Aplicar migración y seed**

Run: `npm run db:seed`
Expected: `Applying migration 0001_schema.sql...` y `Seeding data from seed.sql...` sin errores. Si falla por contraseña ("password authentication failed" o pide password), el usuario debe repetir `npx supabase link` con la contraseña correcta.

- [ ] **Paso 6: Verificar esquema**

Run: `npx supabase db query --linked "select table_name from information_schema.tables where table_schema = 'public' order by 1"`
Expected: `alerts, audit_events, branches, chains, inventory, movements, operations, products, profiles, transfers`.

Run: `npx supabase db query --linked "select code, name from public.branches order by code"`
Expected: `CEN | Sucursal Centro`, `POC | Sucursal Pocitos`.

- [ ] **Paso 7 (usuario): crear las tres cuentas demo**

Dashboard → Authentication → Users → **Add user** → Create new user: email `admin@pelu.com`, contraseña elegida por el usuario, **Auto Confirm User** activado. Repetir para `centro@pelu.com` y `pocitos@pelu.com`. El trigger vincula cada cuenta con su perfil.

- [ ] **Paso 8: Verificar vinculación**

Run: `npx supabase db query --linked "select email, role, auth_user_id is not null as vinculado from public.profiles order by email"`
Expected: las tres filas con `vinculado = t`. Si alguna da `f`, el email de la cuenta no coincide: corregir en el dashboard y correr `npm run db:seed` de nuevo (el re-vínculo al final del seed lo resuelve).

- [ ] **Paso 9: Commit**

```bash
git add supabase/config.toml supabase/migrations/0001_schema.sql supabase/seed.sql .gitignore
git commit -m "db: esquema P0, trigger de vinculación de cuentas y seed mínimo

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

(Si `supabase init` agregó líneas a `.gitignore`, se commitean también.)

---

### Task 5: Harness de pruebas DB, pruebas de RLS y migración `0002_helpers_rls.sql`

**Files:**
- Create: `tests/db/env.ts`, `tests/db/harness.ts`, `tests/db/auth.test.ts`, `supabase/migrations/0002_helpers_rls.sql`

**Interfaces:**
- Produces (SQL): `current_profile_id()`, `current_chain_id()`, `current_branch_id()`, `is_admin()` (todas `returns` escalar, `stable`, `security definer`); vista `profiles_public (id, chain_id, full_name, role, branch_id)`; vista `inventory_status (id, chain_id, branch_id, product_id, balance, min_qty, version, initialized_at, updated_at, below_min, sku, product_name, unit, product_active, brand, category, branch_code, branch_name, branch_active)`.
- Produces (TS): `createTestChain(): Promise<TestChain>` con `{ chainId, branchA, branchB, adminUser, opA, opB, addUser(role, branchId, label), cleanup() }`; `TestUser = { email, password, authUserId, profileId, client }`; `anonClient()`; `admin` (cliente service_role); `expectRpcError(res, code)`.

- [ ] **Paso 1: Escribir `tests/db/env.ts` y `tests/db/harness.ts`**

`tests/db/env.ts`:

```ts
import { config } from 'dotenv'

config({ path: '.env.test.local' })

for (const key of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!process.env[key]) {
    throw new Error(`Falta ${key} en .env.test.local (ver .env.test.example)`)
  }
}
```

`tests/db/harness.ts`:

```ts
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect } from 'vitest'

const URL = process.env.SUPABASE_URL!
const ANON = process.env.SUPABASE_ANON_KEY!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!

const noSession = { auth: { persistSession: false, autoRefreshToken: false } }

/** Cliente con service_role: salta RLS. Solo para preparar y limpiar datos. */
export const admin: SupabaseClient = createClient(URL, SERVICE, noSession)

export function anonClient(): SupabaseClient {
  return createClient(URL, ANON, noSession)
}

export type TestUser = {
  email: string
  password: string
  authUserId: string
  profileId: string
  client: SupabaseClient
}

export type TestChain = {
  chainId: string
  branchA: string
  branchB: string
  adminUser: TestUser
  opA: TestUser
  opB: TestUser
  addUser: (role: 'admin' | 'operator', branchId: string | null, label: string) => Promise<TestUser>
  cleanup: () => Promise<void>
}

/** Crea cadena aislada con 2 sucursales y 3 usuarios autenticados. */
export async function createTestChain(): Promise<TestChain> {
  const tag = randomUUID().slice(0, 8)
  const users: TestUser[] = []

  const { data: chain, error: e1 } = await admin
    .from('chains')
    .insert({ name: `test-${tag}` })
    .select()
    .single()
  if (e1) throw e1

  const { data: branches, error: e2 } = await admin
    .from('branches')
    .insert([
      { chain_id: chain.id, code: 'TA', name: `Sucursal A ${tag}` },
      { chain_id: chain.id, code: 'TB', name: `Sucursal B ${tag}` },
    ])
    .select()
  if (e2) throw e2
  const branchA = branches.find((b) => b.code === 'TA')!.id as string
  const branchB = branches.find((b) => b.code === 'TB')!.id as string

  const addUser = async (role: 'admin' | 'operator', branchId: string | null, label: string) => {
    const email = `${label}-${tag}@example.com`
    const password = `Test-${randomUUID()}`
    const { data: profile, error: ep } = await admin
      .from('profiles')
      .insert({ chain_id: chain.id, email, full_name: label, role, branch_id: branchId })
      .select()
      .single()
    if (ep) throw ep
    const { data: created, error: ea } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (ea) throw ea
    const client = anonClient()
    const { error: es } = await client.auth.signInWithPassword({ email, password })
    if (es) throw es
    const user: TestUser = {
      email,
      password,
      authUserId: created.user.id,
      profileId: profile.id,
      client,
    }
    users.push(user)
    return user
  }

  const adminUser = await addUser('admin', null, 'admin')
  const opA = await addUser('operator', branchA, 'opa')
  const opB = await addUser('operator', branchB, 'opb')

  const cleanup = async () => {
    await admin.from('chains').delete().eq('id', chain.id)
    for (const u of users) await admin.auth.admin.deleteUser(u.authUserId)
  }

  return { chainId: chain.id, branchA, branchB, adminUser, opA, opB, addUser, cleanup }
}

/** Afirma que una respuesta de supabase-js trae el código RPC esperado. */
export function expectRpcError(res: { error: { message: string } | null }, code: string) {
  expect(res.error, `esperaba error ${code} y no hubo error`).not.toBeNull()
  expect(res.error!.message).toBe(code)
}
```

- [ ] **Paso 2: Escribir `tests/db/auth.test.ts` (falla hasta aplicar 0002)**

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { admin, anonClient, createTestChain, type TestChain } from './harness'

let t: TestChain
let productId: string

beforeAll(async () => {
  t = await createTestChain()
  const { data: p, error } = await admin
    .from('products')
    .insert({ chain_id: t.chainId, sku: 'T-RLS-1', name: 'Producto RLS', unit: 'ml' })
    .select()
    .single()
  if (error) throw error
  productId = p.id
  const { error: e2 } = await admin.from('inventory').insert([
    { chain_id: t.chainId, branch_id: t.branchA, product_id: productId, balance: 10, min_qty: 20 },
    { chain_id: t.chainId, branch_id: t.branchB, product_id: productId, balance: 30, min_qty: 5 },
  ])
  if (e2) throw e2
})

afterAll(async () => {
  await t.cleanup()
})

describe('CP-01 sin sesión', () => {
  it('anon no lee inventory', async () => {
    const res = await anonClient().from('inventory').select('*')
    expect(res.error).not.toBeNull()
  })
  it('anon no lee branches ni profiles', async () => {
    expect((await anonClient().from('branches').select('*')).error).not.toBeNull()
    expect((await anonClient().from('profiles').select('*')).error).not.toBeNull()
  })
})

describe('trigger de vinculación', () => {
  it('auth_user_id quedó vinculado al perfil por email', async () => {
    const { data } = await admin
      .from('profiles')
      .select('auth_user_id')
      .eq('id', t.opA.profileId)
      .single()
    expect(data!.auth_user_id).toBe(t.opA.authUserId)
  })
})

describe('CP-02 lectura por sucursal', () => {
  it('operador A solo ve inventario de A', async () => {
    const { data, error } = await t.opA.client.from('inventory').select('branch_id')
    expect(error).toBeNull()
    expect(data!.map((r) => r.branch_id)).toEqual([t.branchA])
  })
  it('operador A no ve inventario de B ni filtrando por id', async () => {
    const { data } = await t.opA.client.from('inventory').select('*').eq('branch_id', t.branchB)
    expect(data).toEqual([])
  })
  it('admin ve ambas sucursales', async () => {
    const { data } = await t.adminUser.client.from('inventory').select('branch_id')
    expect(data!.map((r) => r.branch_id).sort()).toEqual([t.branchA, t.branchB].sort())
  })
  it('operador A no puede escribir inventory directamente (sin privilegio)', async () => {
    const res = await t.opA.client.from('inventory').update({ balance: 999 }).eq('branch_id', t.branchA)
    expect(res.error).not.toBeNull()
    const { data } = await admin.from('inventory').select('balance').eq('branch_id', t.branchA).single()
    expect(Number(data!.balance)).toBe(10)
  })
  it('operador A no puede insertar productos ni sucursales directamente', async () => {
    const r1 = await t.opA.client.from('products').insert({ chain_id: t.chainId, sku: 'X', name: 'x', unit: 'g' })
    expect(r1.error).not.toBeNull()
    const r2 = await t.opA.client.from('branches').insert({ chain_id: t.chainId, code: 'ZZ', name: 'z' })
    expect(r2.error).not.toBeNull()
  })
})

describe('perfiles', () => {
  it('operador ve solo su fila; admin ve las tres', async () => {
    const mine = await t.opA.client.from('profiles').select('id')
    expect(mine.data!.map((r) => r.id)).toEqual([t.opA.profileId])
    const all = await t.adminUser.client.from('profiles').select('id')
    expect(all.data!.length).toBe(3)
  })
  it('CP-03 operador no puede cambiarse el rol por UPDATE directo', async () => {
    const res = await t.opA.client.from('profiles').update({ role: 'admin' }).eq('id', t.opA.profileId)
    expect(res.error).not.toBeNull()
    const { data } = await admin.from('profiles').select('role').eq('id', t.opA.profileId).single()
    expect(data!.role).toBe('operator')
  })
  it('profiles_public: operador ve nombres de toda la cadena sin email', async () => {
    const { data, error } = await t.opA.client.from('profiles_public').select('*')
    expect(error).toBeNull()
    expect(data!.length).toBe(3)
    expect(Object.keys(data![0]!)).not.toContain('email')
  })
})

describe('CP-04 usuario desactivado con sesión vigente', () => {
  it('pierde lecturas de inmediato y las recupera al reactivarlo', async () => {
    await admin.from('profiles').update({ is_active: false }).eq('id', t.opB.profileId)
    const inv = await t.opB.client.from('inventory').select('*')
    expect(inv.data).toEqual([])
    const me = await t.opB.client.from('profiles').select('*')
    expect(me.data).toEqual([])
    const pub = await t.opB.client.from('profiles_public').select('*')
    expect(pub.data).toEqual([])
    await admin.from('profiles').update({ is_active: true }).eq('id', t.opB.profileId)
    const again = await t.opB.client.from('inventory').select('branch_id')
    expect(again.data!.map((r) => r.branch_id)).toEqual([t.branchB])
  })
})

describe('aislamiento entre cadenas', () => {
  it('otra cadena no es visible ni para el admin', async () => {
    const { data: other } = await admin.from('chains').insert({ name: 'otra-cadena' }).select().single()
    await admin.from('branches').insert({ chain_id: other!.id, code: 'OT', name: 'Otra' })
    const { data } = await t.adminUser.client.from('branches').select('code')
    expect(data!.map((r) => r.code).sort()).toEqual(['TA', 'TB'])
    await admin.from('chains').delete().eq('id', other!.id)
  })
})

describe('audit_events e inventory_status', () => {
  it('audit_events: operador no ve, admin sí', async () => {
    await admin.from('audit_events').insert({
      chain_id: t.chainId, action: 'test', entity_type: 'test', new_values: { a: 1 },
    })
    const op = await t.opA.client.from('audit_events').select('*')
    expect(op.data).toEqual([])
    const ad = await t.adminUser.client.from('audit_events').select('*')
    expect(ad.data!.length).toBe(1)
  })
  it('inventory_status calcula below_min y respeta RLS', async () => {
    const { data, error } = await t.opA.client.from('inventory_status').select('*')
    expect(error).toBeNull()
    expect(data!.length).toBe(1)
    expect(data![0]!.below_min).toBe(true)
    expect(data![0]!.sku).toBe('T-RLS-1')
    expect(data![0]!.branch_code).toBe('TA')
    const b = await t.adminUser.client.from('inventory_status').select('below_min').eq('branch_id', t.branchB)
    expect(b.data![0]!.below_min).toBe(false)
  })
})
```

- [ ] **Paso 3: Correr y verificar que falla**

Run: `npm run test:db`
Expected: varias FAIL (por ejemplo, `operador A solo ve inventario de A` devuelve las dos filas o error de vista inexistente). Si en cambio falla en `beforeAll` con `Falta SUPABASE_...`, completar la Tarea 0.

- [ ] **Paso 4: Escribir `supabase/migrations/0002_helpers_rls.sql`**

```sql
-- 0002_helpers_rls.sql — helpers de sesión, vistas y RLS de solo lectura.

-- Helpers: devuelven null si no hay sesión, no hay perfil o el perfil está inactivo.
create or replace function public.current_profile_id()
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select p.id from public.profiles p
   where p.auth_user_id = auth.uid() and p.is_active
   limit 1;
$$;

create or replace function public.current_chain_id()
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select p.chain_id from public.profiles p
   where p.auth_user_id = auth.uid() and p.is_active
   limit 1;
$$;

create or replace function public.current_branch_id()
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select p.branch_id from public.profiles p
   where p.auth_user_id = auth.uid() and p.is_active
   limit 1;
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((
    select p.role = 'admin' from public.profiles p
     where p.auth_user_id = auth.uid() and p.is_active
     limit 1
  ), false);
$$;

revoke execute on function public.current_profile_id(), public.current_chain_id(),
  public.current_branch_id(), public.is_admin() from public, anon;
grant execute on function public.current_profile_id(), public.current_chain_id(),
  public.current_branch_id(), public.is_admin() to authenticated;

-- Vistas
-- profiles_public: única vista privilegiada (se ejecuta como su dueño). Expone solo nombre y rol de la propia cadena.
create view public.profiles_public
with (security_invoker = false) as
  select p.id, p.chain_id, p.full_name, p.role, p.branch_id
    from public.profiles p
   where p.chain_id = public.current_chain_id();

-- inventory_status: vista de lectura con RLS de las tablas subyacentes (security_invoker).
create view public.inventory_status
with (security_invoker = true) as
  select i.id, i.chain_id, i.branch_id, i.product_id, i.balance, i.min_qty, i.version,
         i.initialized_at, i.updated_at,
         (i.balance <= i.min_qty) as below_min,
         p.sku, p.name as product_name, p.unit, p.is_active as product_active, p.brand, p.category,
         b.code as branch_code, b.name as branch_name, b.is_active as branch_active
    from public.inventory i
    join public.products p on p.id = i.product_id
    join public.branches b on b.id = i.branch_id;

-- RLS: habilitada (sin FORCE, para que las RPC SECURITY DEFINER y el seed escriban). Solo SELECT.
alter table public.chains enable row level security;
alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.inventory enable row level security;
alter table public.operations enable row level security;
alter table public.transfers enable row level security;
alter table public.movements enable row level security;
alter table public.alerts enable row level security;
alter table public.audit_events enable row level security;

create policy chains_select on public.chains for select to authenticated
  using (id = public.current_chain_id());

create policy branches_select on public.branches for select to authenticated
  using (chain_id = public.current_chain_id());

create policy products_select on public.products for select to authenticated
  using (chain_id = public.current_chain_id());

create policy profiles_select on public.profiles for select to authenticated
  using (chain_id = public.current_chain_id()
         and (public.is_admin() or id = public.current_profile_id()));

create policy inventory_select on public.inventory for select to authenticated
  using (chain_id = public.current_chain_id()
         and (public.is_admin() or branch_id = public.current_branch_id()));

create policy movements_select on public.movements for select to authenticated
  using (chain_id = public.current_chain_id()
         and (public.is_admin() or branch_id = public.current_branch_id()));

create policy operations_select on public.operations for select to authenticated
  using (chain_id = public.current_chain_id()
         and (public.is_admin() or exists (
           select 1 from public.movements m
            where m.operation_id = operations.id and m.branch_id = public.current_branch_id())));

create policy alerts_select on public.alerts for select to authenticated
  using (chain_id = public.current_chain_id()
         and (public.is_admin() or branch_id = public.current_branch_id()));

create policy transfers_select on public.transfers for select to authenticated
  using (chain_id = public.current_chain_id()
         and (public.is_admin()
              or from_branch_id = public.current_branch_id()
              or to_branch_id = public.current_branch_id()));

create policy audit_events_select on public.audit_events for select to authenticated
  using (chain_id = public.current_chain_id() and public.is_admin());

-- Privilegios: anon nada; authenticated solo SELECT (las escrituras van por RPC).
revoke all on all tables in schema public from anon, authenticated;
grant select on public.chains, public.branches, public.profiles, public.products,
  public.inventory, public.operations, public.transfers, public.movements,
  public.alerts, public.audit_events, public.profiles_public, public.inventory_status
  to authenticated;
```

- [ ] **Paso 5: Aplicar**

Run: `npm run db:push`
Expected: `Applying migration 0002_helpers_rls.sql...` sin errores.

- [ ] **Paso 6: Correr y verificar que pasa**

Run: `npm run test:db`
Expected: `tests/db/auth.test.ts` todo PASS.

- [ ] **Paso 7: Chequeo de asesores de seguridad de Supabase**

Run: `npx supabase db advisors --linked 2>&1 | head -60`
Expected: sin errores de nivel "ERROR" sobre tablas sin RLS. Advertencias sobre `profiles_public` (security definer view) son esperadas y están documentadas en el spec §5.3.

- [ ] **Paso 8: Commit**

```bash
git add supabase/migrations/0002_helpers_rls.sql tests/db
git commit -m "db: helpers de sesión, vistas y RLS de solo lectura con pruebas de aislamiento

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 6: RPC de catálogo (`0003_rpc_catalog.sql`) con pruebas

**Files:**
- Create: `supabase/migrations/0003_rpc_catalog.sql`, `tests/db/catalog.test.ts`

**Interfaces:**
- Consumes: harness de la Tarea 5; helpers de 0002.
- Produces (SQL, todas `security definer`, ejecutables por `authenticated`):
  - `create_branch(p_code text, p_name text) returns branches`
  - `update_branch(p_id uuid, p_name text, p_is_active boolean) returns branches`
  - `upsert_product(p_sku text, p_name text, p_unit unit_kind, p_id uuid default null, p_brand text default null, p_category text default null, p_variant text default null, p_presentation text default null, p_presentation_qty numeric default null, p_max_movement_qty numeric default 100000, p_is_active boolean default true) returns products`
  - `create_profile(p_email text, p_full_name text, p_role user_role, p_branch_id uuid default null) returns profiles`
  - `update_profile(p_id uuid, p_full_name text, p_role user_role, p_branch_id uuid default null, p_is_active boolean default true) returns profiles`
  - Internas (sin execute para `authenticated`): `raise_error(code, detail)`, `assert_active() returns profiles`, `assert_admin() returns profiles`, `assert_quantity_scale(qty numeric, unit unit_kind)`, `log_audit(actor uuid, chain uuid, action text, entity_type text, entity_id uuid, old jsonb, new jsonb)`.
  - Acciones de auditoría: `branch.create`, `branch.update`, `product.create`, `product.update`, `profile.create`, `profile.update`.

- [ ] **Paso 1: Escribir `tests/db/catalog.test.ts` (falla hasta aplicar 0003)**

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { admin, createTestChain, expectRpcError, type TestChain } from './harness'

let t: TestChain

beforeAll(async () => {
  t = await createTestChain()
})
afterAll(async () => {
  await t.cleanup()
})

describe('create_branch / update_branch', () => {
  it('admin crea sucursal y queda auditada', async () => {
    const res = await t.adminUser.client.rpc('create_branch', { p_code: 'TC', p_name: 'Sucursal C' })
    expect(res.error).toBeNull()
    expect(res.data.code).toBe('TC')
    const audit = await t.adminUser.client
      .from('audit_events')
      .select('action, entity_id')
      .eq('action', 'branch.create')
    expect(audit.data!.some((a) => a.entity_id === res.data.id)).toBe(true)
  })
  it('rechaza código inválido y duplicado', async () => {
    expectRpcError(await t.adminUser.client.rpc('create_branch', { p_code: 'tc', p_name: 'x' }), 'invalid_code')
    expectRpcError(await t.adminUser.client.rpc('create_branch', { p_code: 'TA', p_name: 'x' }), 'duplicate_code')
    expectRpcError(await t.adminUser.client.rpc('create_branch', { p_code: 'TD', p_name: '   ' }), 'invalid_name')
  })
  it('operador no puede crear ni editar sucursales', async () => {
    expectRpcError(await t.opA.client.rpc('create_branch', { p_code: 'TX', p_name: 'x' }), 'permission_denied')
    expectRpcError(
      await t.opA.client.rpc('update_branch', { p_id: t.branchA, p_name: 'Hack', p_is_active: true }),
      'permission_denied',
    )
  })
  it('no desactiva sucursal con usuarios activos; sí sin ellos', async () => {
    expectRpcError(
      await t.adminUser.client.rpc('update_branch', { p_id: t.branchB, p_name: 'B', p_is_active: false }),
      'has_active_users',
    )
    const { data: c } = await admin.from('branches').select('id').eq('chain_id', t.chainId).eq('code', 'TC').single()
    const ok = await t.adminUser.client.rpc('update_branch', { p_id: c!.id, p_name: 'C cerrada', p_is_active: false })
    expect(ok.error).toBeNull()
    expect(ok.data.is_active).toBe(false)
    expect(ok.data.name).toBe('C cerrada')
  })
  it('no desactiva sucursal con saldo', async () => {
    const { data: p } = await admin
      .from('products').insert({ chain_id: t.chainId, sku: 'B-STOCK', name: 'Con stock', unit: 'g' }).select().single()
    const { data: c } = await admin.from('branches').select('id').eq('chain_id', t.chainId).eq('code', 'TC').single()
    await admin.from('inventory').insert({ chain_id: t.chainId, branch_id: c!.id, product_id: p!.id, balance: 5 })
    await t.adminUser.client.rpc('update_branch', { p_id: c!.id, p_name: 'C', p_is_active: true })
    expectRpcError(
      await t.adminUser.client.rpc('update_branch', { p_id: c!.id, p_name: 'C', p_is_active: false }),
      'has_stock',
    )
    await admin.from('inventory').delete().eq('product_id', p!.id)
  })
})

describe('upsert_product', () => {
  let productId: string
  it('crea producto con unidad y lo audita', async () => {
    const res = await t.adminUser.client.rpc('upsert_product', {
      p_sku: 'SH-PRO-1', p_name: 'Shampoo profesional 1 L', p_unit: 'ml',
      p_brand: 'Marca', p_category: 'Profesional', p_presentation: 'Envase 1.000 ml', p_presentation_qty: 1000,
    })
    expect(res.error).toBeNull()
    expect(res.data.unit).toBe('ml')
    expect(Number(res.data.presentation_qty)).toBe(1000)
    expect(Number(res.data.max_movement_qty)).toBe(100000)
    productId = res.data.id
  })
  it('CP-05 rechaza SKU duplicado (sin distinguir mayúsculas) e inválido', async () => {
    expectRpcError(
      await t.adminUser.client.rpc('upsert_product', { p_sku: 'sh-pro-1', p_name: 'Otro', p_unit: 'ml' }),
      'duplicate_sku',
    )
    expectRpcError(
      await t.adminUser.client.rpc('upsert_product', { p_sku: 'con espacio', p_name: 'Otro', p_unit: 'ml' }),
      'invalid_sku',
    )
    expectRpcError(
      await t.adminUser.client.rpc('upsert_product', { p_sku: 'OK-1', p_name: 'x', p_unit: 'ml', p_presentation_qty: -1 }),
      'invalid_quantity',
    )
    expectRpcError(
      await t.adminUser.client.rpc('upsert_product', { p_sku: 'OK-2', p_name: 'x', p_unit: 'unit', p_presentation_qty: 1.5 }),
      'invalid_quantity',
    )
  })
  it('edita nombre y permite cambiar unidad mientras no haya saldo', async () => {
    const res = await t.adminUser.client.rpc('upsert_product', {
      p_id: productId, p_sku: 'SH-PRO-1', p_name: 'Shampoo profesional neutro 1 L', p_unit: 'g',
    })
    expect(res.error).toBeNull()
    expect(res.data.unit).toBe('g')
    const back = await t.adminUser.client.rpc('upsert_product', {
      p_id: productId, p_sku: 'SH-PRO-1', p_name: 'Shampoo profesional neutro 1 L', p_unit: 'ml',
    })
    expect(back.error).toBeNull()
  })
  it('CP-33 con saldo no se desactiva; sin saldo sí y conserva la fila', async () => {
    await admin.from('inventory').insert({ chain_id: t.chainId, branch_id: t.branchA, product_id: productId, balance: 3 })
    expectRpcError(
      await t.adminUser.client.rpc('upsert_product', { p_id: productId, p_sku: 'SH-PRO-1', p_name: 'S', p_unit: 'ml', p_is_active: false }),
      'has_stock',
    )
    await admin.from('inventory').update({ balance: 0 }).eq('product_id', productId)
    const off = await t.adminUser.client.rpc('upsert_product', { p_id: productId, p_sku: 'SH-PRO-1', p_name: 'S', p_unit: 'ml', p_is_active: false })
    expect(off.error).toBeNull()
    expect(off.data.is_active).toBe(false)
    const still = await admin.from('products').select('id').eq('id', productId).single()
    expect(still.data!.id).toBe(productId)
  })
  it('operador no puede crear productos', async () => {
    expectRpcError(await t.opA.client.rpc('upsert_product', { p_sku: 'X', p_name: 'x', p_unit: 'g' }), 'permission_denied')
  })
})

describe('create_profile / update_profile', () => {
  let newOperatorId: string
  it('crea operador con sucursal', async () => {
    const res = await t.adminUser.client.rpc('create_profile', {
      p_email: `nuevo-${t.chainId.slice(0, 6)}@example.com`, p_full_name: 'Nuevo Op', p_role: 'operator', p_branch_id: t.branchB,
    })
    expect(res.error).toBeNull()
    expect(res.data.role).toBe('operator')
    newOperatorId = res.data.id
  })
  it('rechaza operador sin sucursal, email inválido y duplicado', async () => {
    expectRpcError(
      await t.adminUser.client.rpc('create_profile', { p_email: 'a@example.com', p_full_name: 'A', p_role: 'operator' }),
      'branch_required',
    )
    expectRpcError(
      await t.adminUser.client.rpc('create_profile', { p_email: 'no-es-email', p_full_name: 'A', p_role: 'admin' }),
      'invalid_email',
    )
    expectRpcError(
      await t.adminUser.client.rpc('create_profile', { p_email: t.opA.email.toUpperCase(), p_full_name: 'A', p_role: 'admin' }),
      'duplicate_email',
    )
  })
  it('CP-03 operador no puede ascenderse ni reasignarse', async () => {
    expectRpcError(
      await t.opA.client.rpc('update_profile', { p_id: t.opA.profileId, p_full_name: 'X', p_role: 'admin' }),
      'permission_denied',
    )
  })
  it('CP-31 admin edita y queda auditado con valores anteriores', async () => {
    const res = await t.adminUser.client.rpc('update_profile', {
      p_id: newOperatorId, p_full_name: 'Nuevo Op Editado', p_role: 'operator', p_branch_id: t.branchA, p_is_active: true,
    })
    expect(res.error).toBeNull()
    expect(res.data.branch_id).toBe(t.branchA)
    const audit = await t.adminUser.client.from('audit_events').select('*').eq('action', 'profile.update').eq('entity_id', newOperatorId)
    expect(audit.data!.length).toBe(1)
    expect(audit.data![0]!.old_values.full_name).toBe('Nuevo Op')
  })
  it('no permite autodesactivarse ni dejar la cadena sin administrador', async () => {
    expectRpcError(
      await t.adminUser.client.rpc('update_profile', { p_id: t.adminUser.profileId, p_full_name: 'A', p_role: 'admin', p_is_active: false }),
      'self_deactivation',
    )
    expectRpcError(
      await t.adminUser.client.rpc('update_profile', { p_id: t.adminUser.profileId, p_full_name: 'A', p_role: 'operator', p_branch_id: t.branchA, p_is_active: true }),
      'last_admin',
    )
  })
  it('CP-04 desactivar vía RPC bloquea la siguiente RPC del usuario', async () => {
    const off = await t.adminUser.client.rpc('update_profile', { p_id: t.opB.profileId, p_full_name: 'opb', p_role: 'operator', p_branch_id: t.branchB, p_is_active: false })
    expect(off.error).toBeNull()
    expectRpcError(await t.opB.client.rpc('create_branch', { p_code: 'QQ', p_name: 'q' }), 'inactive_user')
    await t.adminUser.client.rpc('update_profile', { p_id: t.opB.profileId, p_full_name: 'opb', p_role: 'operator', p_branch_id: t.branchB, p_is_active: true })
  })
})
```

- [ ] **Paso 2: Correr y verificar que falla**

Run: `npm run test:db -- tests/db/catalog.test.ts`
Expected: FAIL con `Could not find the function public.create_branch` (PGRST202).

- [ ] **Paso 3: Escribir `supabase/migrations/0003_rpc_catalog.sql`**

```sql
-- 0003_rpc_catalog.sql — helpers de validación y RPC de sucursales, productos y perfiles.

create or replace function public.raise_error(p_code text, p_detail text)
returns void language plpgsql as $$
begin
  raise exception using message = p_code, detail = p_detail, errcode = 'P0001';
end;
$$;

-- Perfil activo del usuario de la sesión, o error.
create or replace function public.assert_active()
returns public.profiles language plpgsql security definer set search_path = public, pg_temp as $$
declare v public.profiles;
begin
  if auth.uid() is null then
    perform public.raise_error('not_authenticated', 'Iniciá sesión para continuar.');
  end if;
  select * into v from public.profiles where auth_user_id = auth.uid() limit 1;
  if v.id is null then
    perform public.raise_error('no_profile', 'Tu cuenta no tiene un perfil asignado.');
  end if;
  if not v.is_active then
    perform public.raise_error('inactive_user', 'Tu usuario fue desactivado.');
  end if;
  return v;
end;
$$;

create or replace function public.assert_admin()
returns public.profiles language plpgsql security definer set search_path = public, pg_temp as $$
declare v public.profiles;
begin
  v := public.assert_active();
  if v.role <> 'admin' then
    perform public.raise_error('permission_denied', 'Esta acción requiere perfil de administrador.');
  end if;
  return v;
end;
$$;

-- Cantidad válida para la unidad: no nula, no negativa, entera si 'unit', máx. 2 decimales si ml/g.
create or replace function public.assert_quantity_scale(p_qty numeric, p_unit public.unit_kind)
returns void language plpgsql as $$
begin
  if p_qty is null then
    perform public.raise_error('invalid_quantity', 'La cantidad es obligatoria.');
  end if;
  if p_qty < 0 then
    perform public.raise_error('invalid_quantity', 'La cantidad no puede ser negativa.');
  end if;
  if p_unit = 'unit' and p_qty <> trunc(p_qty) then
    perform public.raise_error('invalid_quantity', 'Los productos por unidad solo admiten cantidades enteras.');
  end if;
  if p_unit in ('ml', 'g') and scale(p_qty) > 2 then
    perform public.raise_error('invalid_quantity', 'Se admiten hasta dos decimales.');
  end if;
end;
$$;

create or replace function public.log_audit(
  p_actor uuid, p_chain uuid, p_action text, p_entity_type text, p_entity_id uuid, p_old jsonb, p_new jsonb)
returns void language sql as $$
  insert into public.audit_events (chain_id, actor_profile_id, action, entity_type, entity_id, old_values, new_values)
  values (p_chain, p_actor, p_action, p_entity_type, p_entity_id, p_old, p_new);
$$;

revoke execute on function
  public.raise_error(text, text),
  public.assert_active(),
  public.assert_admin(),
  public.assert_quantity_scale(numeric, public.unit_kind),
  public.log_audit(uuid, uuid, text, text, uuid, jsonb, jsonb)
from public, anon, authenticated;

-- Sucursales -------------------------------------------------------------

create or replace function public.create_branch(p_code text, p_name text)
returns public.branches language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor public.profiles; v_row public.branches;
begin
  v_actor := public.assert_admin();
  if p_code is null or p_code !~ '^[A-Z0-9]{2,8}$' then
    perform public.raise_error('invalid_code', 'El código debe tener entre 2 y 8 letras mayúsculas o números.');
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    perform public.raise_error('invalid_name', 'El nombre es obligatorio.');
  end if;
  if exists (select 1 from public.branches where chain_id = v_actor.chain_id and code = p_code) then
    perform public.raise_error('duplicate_code', 'Ya existe una sucursal con ese código.');
  end if;
  insert into public.branches (chain_id, code, name)
  values (v_actor.chain_id, p_code, trim(p_name))
  returning * into v_row;
  perform public.log_audit(v_actor.id, v_actor.chain_id, 'branch.create', 'branch', v_row.id, null, to_jsonb(v_row));
  return v_row;
end;
$$;

create or replace function public.update_branch(p_id uuid, p_name text, p_is_active boolean)
returns public.branches language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor public.profiles; v_old public.branches; v_row public.branches;
begin
  v_actor := public.assert_admin();
  select * into v_old from public.branches where id = p_id and chain_id = v_actor.chain_id for update;
  if v_old.id is null then
    perform public.raise_error('not_found', 'La sucursal no existe.');
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    perform public.raise_error('invalid_name', 'El nombre es obligatorio.');
  end if;
  if v_old.is_active and not coalesce(p_is_active, true) then
    if exists (select 1 from public.inventory where branch_id = p_id and balance > 0) then
      perform public.raise_error('has_stock', 'La sucursal tiene productos con saldo; no se puede desactivar.');
    end if;
    if exists (select 1 from public.transfers
                where (from_branch_id = p_id or to_branch_id = p_id)
                  and status in ('draft', 'dispatched', 'disputed')) then
      perform public.raise_error('has_open_transfers', 'La sucursal tiene transferencias abiertas.');
    end if;
    if exists (select 1 from public.profiles where branch_id = p_id and is_active) then
      perform public.raise_error('has_active_users', 'La sucursal tiene usuarios activos asignados.');
    end if;
  end if;
  update public.branches set name = trim(p_name), is_active = coalesce(p_is_active, true)
   where id = p_id returning * into v_row;
  perform public.log_audit(v_actor.id, v_actor.chain_id, 'branch.update', 'branch', p_id, to_jsonb(v_old), to_jsonb(v_row));
  return v_row;
end;
$$;

-- Productos --------------------------------------------------------------

create or replace function public.upsert_product(
  p_sku text,
  p_name text,
  p_unit public.unit_kind,
  p_id uuid default null,
  p_brand text default null,
  p_category text default null,
  p_variant text default null,
  p_presentation text default null,
  p_presentation_qty numeric default null,
  p_max_movement_qty numeric default 100000,
  p_is_active boolean default true)
returns public.products language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor public.profiles; v_old public.products; v_row public.products;
begin
  v_actor := public.assert_admin();
  if p_sku is null or p_sku !~ '^[A-Za-z0-9._-]{1,40}$' then
    perform public.raise_error('invalid_sku', 'El SKU admite letras, números, punto, guion y guion bajo (máximo 40).');
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    perform public.raise_error('invalid_name', 'El nombre es obligatorio.');
  end if;
  if p_unit is null then
    perform public.raise_error('invalid_unit', 'La unidad es obligatoria.');
  end if;
  if p_presentation_qty is not null then
    if p_presentation_qty <= 0 then
      perform public.raise_error('invalid_quantity', 'El contenido por envase debe ser mayor que cero.');
    end if;
    perform public.assert_quantity_scale(p_presentation_qty, p_unit);
  end if;
  if p_max_movement_qty is null or p_max_movement_qty <= 0 then
    perform public.raise_error('invalid_quantity', 'El máximo por movimiento debe ser mayor que cero.');
  end if;
  if exists (select 1 from public.products
              where chain_id = v_actor.chain_id and lower(sku) = lower(p_sku)
                and (p_id is null or id <> p_id)) then
    perform public.raise_error('duplicate_sku', 'Ya existe un producto con ese SKU.');
  end if;

  if p_id is null then
    insert into public.products
      (chain_id, sku, name, brand, category, variant, unit, presentation, presentation_qty, max_movement_qty, is_active)
    values
      (v_actor.chain_id, p_sku, trim(p_name), nullif(trim(p_brand), ''), nullif(trim(p_category), ''),
       nullif(trim(p_variant), ''), p_unit, nullif(trim(p_presentation), ''), p_presentation_qty,
       p_max_movement_qty, coalesce(p_is_active, true))
    returning * into v_row;
    perform public.log_audit(v_actor.id, v_actor.chain_id, 'product.create', 'product', v_row.id, null, to_jsonb(v_row));
    return v_row;
  end if;

  select * into v_old from public.products where id = p_id and chain_id = v_actor.chain_id for update;
  if v_old.id is null then
    perform public.raise_error('not_found', 'El producto no existe.');
  end if;
  if v_old.unit <> p_unit then
    if exists (select 1 from public.movements where product_id = p_id)
       or exists (select 1 from public.inventory where product_id = p_id and initialized_at is not null) then
      perform public.raise_error('unit_locked', 'La unidad no se puede cambiar: el producto ya tiene saldo o movimientos.');
    end if;
    if p_unit = 'unit' and exists (select 1 from public.inventory where product_id = p_id and min_qty <> trunc(min_qty)) then
      perform public.raise_error('invalid_quantity', 'Hay mínimos con decimales; corregilos antes de cambiar la unidad.');
    end if;
  end if;
  if v_old.is_active and not coalesce(p_is_active, true) then
    if exists (select 1 from public.inventory where product_id = p_id and balance > 0) then
      perform public.raise_error('has_stock', 'El producto tiene saldo en alguna sucursal.');
    end if;
    if exists (select 1 from public.transfers where product_id = p_id and status in ('draft', 'dispatched', 'disputed')) then
      perform public.raise_error('has_open_transfers', 'El producto tiene transferencias abiertas.');
    end if;
  end if;
  update public.products
     set sku = p_sku, name = trim(p_name), brand = nullif(trim(p_brand), ''), category = nullif(trim(p_category), ''),
         variant = nullif(trim(p_variant), ''), unit = p_unit, presentation = nullif(trim(p_presentation), ''),
         presentation_qty = p_presentation_qty, max_movement_qty = p_max_movement_qty,
         is_active = coalesce(p_is_active, true)
   where id = p_id returning * into v_row;
  perform public.log_audit(v_actor.id, v_actor.chain_id, 'product.update', 'product', p_id, to_jsonb(v_old), to_jsonb(v_row));
  return v_row;
end;
$$;

-- Perfiles ---------------------------------------------------------------

create or replace function public.create_profile(
  p_email text, p_full_name text, p_role public.user_role, p_branch_id uuid default null)
returns public.profiles language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor public.profiles; v_row public.profiles; v_branch uuid := p_branch_id;
begin
  v_actor := public.assert_admin();
  if p_email is null or p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    perform public.raise_error('invalid_email', 'El email no es válido.');
  end if;
  if p_full_name is null or length(trim(p_full_name)) = 0 then
    perform public.raise_error('invalid_name', 'El nombre es obligatorio.');
  end if;
  if p_role is null then
    perform public.raise_error('invalid_role', 'El rol es obligatorio.');
  end if;
  if p_role = 'operator' then
    if v_branch is null then
      perform public.raise_error('branch_required', 'Un operador necesita una sucursal asignada.');
    end if;
    if not exists (select 1 from public.branches where id = v_branch and chain_id = v_actor.chain_id and is_active) then
      perform public.raise_error('branch_inactive', 'La sucursal no existe o está inactiva.');
    end if;
  else
    v_branch := null;
  end if;
  if exists (select 1 from public.profiles where chain_id = v_actor.chain_id and lower(email) = lower(trim(p_email))) then
    perform public.raise_error('duplicate_email', 'Ya existe un usuario con ese email.');
  end if;
  insert into public.profiles (chain_id, email, full_name, role, branch_id)
  values (v_actor.chain_id, lower(trim(p_email)), trim(p_full_name), p_role, v_branch)
  returning * into v_row;
  -- Si la cuenta Auth ya existe, vincularla ahora.
  update public.profiles p
     set auth_user_id = u.id
    from auth.users u
   where p.id = v_row.id
     and lower(u.email) = lower(v_row.email)
     and not exists (select 1 from public.profiles q where q.auth_user_id = u.id);
  select * into v_row from public.profiles where id = v_row.id;
  perform public.log_audit(v_actor.id, v_actor.chain_id, 'profile.create', 'profile', v_row.id, null, to_jsonb(v_row));
  return v_row;
end;
$$;

create or replace function public.update_profile(
  p_id uuid, p_full_name text, p_role public.user_role, p_branch_id uuid default null, p_is_active boolean default true)
returns public.profiles language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor public.profiles; v_old public.profiles; v_row public.profiles; v_branch uuid := p_branch_id; v_other_admins int;
begin
  v_actor := public.assert_admin();
  select * into v_old from public.profiles where id = p_id and chain_id = v_actor.chain_id for update;
  if v_old.id is null then
    perform public.raise_error('not_found', 'El usuario no existe.');
  end if;
  if p_full_name is null or length(trim(p_full_name)) = 0 then
    perform public.raise_error('invalid_name', 'El nombre es obligatorio.');
  end if;
  if p_role is null then
    perform public.raise_error('invalid_role', 'El rol es obligatorio.');
  end if;
  if p_id = v_actor.id and not coalesce(p_is_active, true) then
    perform public.raise_error('self_deactivation', 'No podés desactivar tu propio usuario.');
  end if;
  if p_role = 'operator' then
    if v_branch is null then
      perform public.raise_error('branch_required', 'Un operador necesita una sucursal asignada.');
    end if;
    if not exists (select 1 from public.branches where id = v_branch and chain_id = v_actor.chain_id and is_active) then
      perform public.raise_error('branch_inactive', 'La sucursal no existe o está inactiva.');
    end if;
  else
    v_branch := null;
  end if;
  if not (p_role = 'admin' and coalesce(p_is_active, true)) then
    select count(*) into v_other_admins from public.profiles
     where chain_id = v_actor.chain_id and role = 'admin' and is_active and id <> p_id;
    if v_other_admins = 0 then
      perform public.raise_error('last_admin', 'No se puede desactivar ni degradar al último administrador activo.');
    end if;
  end if;
  update public.profiles
     set full_name = trim(p_full_name), role = p_role, branch_id = v_branch, is_active = coalesce(p_is_active, true)
   where id = p_id returning * into v_row;
  perform public.log_audit(v_actor.id, v_actor.chain_id, 'profile.update', 'profile', p_id, to_jsonb(v_old), to_jsonb(v_row));
  return v_row;
end;
$$;

revoke execute on function
  public.create_branch(text, text),
  public.update_branch(uuid, text, boolean),
  public.upsert_product(text, text, public.unit_kind, uuid, text, text, text, text, numeric, numeric, boolean),
  public.create_profile(text, text, public.user_role, uuid),
  public.update_profile(uuid, text, public.user_role, uuid, boolean)
from public, anon;
grant execute on function
  public.create_branch(text, text),
  public.update_branch(uuid, text, boolean),
  public.upsert_product(text, text, public.unit_kind, uuid, text, text, text, text, numeric, numeric, boolean),
  public.create_profile(text, text, public.user_role, uuid),
  public.update_profile(uuid, text, public.user_role, uuid, boolean)
to authenticated;
```

- [ ] **Paso 4: Aplicar**

Run: `npm run db:push`
Expected: `Applying migration 0003_rpc_catalog.sql...` sin errores.

- [ ] **Paso 5: Correr y verificar que pasa**

Run: `npm run test:db`
Expected: `auth.test.ts` y `catalog.test.ts` todo PASS.

- [ ] **Paso 6: Commit**

```bash
git add supabase/migrations/0003_rpc_catalog.sql tests/db/catalog.test.ts
git commit -m "db: RPC de sucursales, productos y perfiles con validación y auditoría

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: RPC de inventario (`0004_rpc_inventory.sql`) con pruebas

**Files:**
- Create: `supabase/migrations/0004_rpc_inventory.sql`, `tests/db/inventory.test.ts`

**Interfaces:**
- Consumes: RPC de la Tarea 6, harness.
- Produces (SQL):
  - `enable_product_in_branch(p_product_id uuid, p_branch_id uuid, p_min_qty numeric default 0) returns inventory`
  - `set_min_qty(p_branch_id uuid, p_product_id uuid, p_min_qty numeric) returns inventory`
  - `set_initial_balance(p_key uuid, p_branch_id uuid, p_product_id uuid, p_qty numeric, p_reference text default null) returns jsonb` → `{ operation_id, movement_id | null, balance, branch_id, product_id }`
  - Interna: `recalc_alert(p_branch_id uuid, p_product_id uuid)`.
  - Acciones de auditoría: `inventory.enable`, `inventory.set_min`, `inventory.initial_balance`.

- [ ] **Paso 1: Escribir `tests/db/inventory.test.ts` (falla hasta aplicar 0004)**

```ts
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { admin, anonClient, createTestChain, expectRpcError, type TestChain } from './harness'

let t: TestChain
let shampooId: string // ml, envase 1000
let botellaId: string // unit

beforeAll(async () => {
  t = await createTestChain()
  const s = await t.adminUser.client.rpc('upsert_product', {
    p_sku: 'SH-PRO', p_name: 'Shampoo profesional 1 L', p_unit: 'ml', p_presentation_qty: 1000, p_max_movement_qty: 50000,
  })
  if (s.error) throw s.error
  shampooId = s.data.id
  const b = await t.adminUser.client.rpc('upsert_product', { p_sku: 'VT-250', p_name: 'Shampoo venta 250 ml', p_unit: 'unit' })
  if (b.error) throw b.error
  botellaId = b.data.id
})
afterAll(async () => {
  await t.cleanup()
})

async function openAlerts(branchId: string, productId: string) {
  const { data } = await admin.from('alerts').select('id').eq('branch_id', branchId).eq('product_id', productId).eq('status', 'open')
  return data!.length
}
async function movementsFor(branchId: string, productId: string) {
  const { data } = await admin.from('movements').select('id, qty_delta').eq('branch_id', branchId).eq('product_id', productId)
  return data!
}

describe('enable_product_in_branch / set_min_qty', () => {
  it('habilita con saldo 0 y abre alerta (0 <= mínimo)', async () => {
    const res = await t.adminUser.client.rpc('enable_product_in_branch', { p_product_id: shampooId, p_branch_id: t.branchA, p_min_qty: 1980 })
    expect(res.error).toBeNull()
    expect(Number(res.data.balance)).toBe(0)
    expect(Number(res.data.min_qty)).toBe(1980)
    expect(res.data.initialized_at).toBeNull()
    expect(await openAlerts(t.branchA, shampooId)).toBe(1)
  })
  it('rechaza habilitar dos veces, mínimo con escala inválida y operador', async () => {
    expectRpcError(
      await t.adminUser.client.rpc('enable_product_in_branch', { p_product_id: shampooId, p_branch_id: t.branchA }),
      'already_enabled',
    )
    expectRpcError(
      await t.adminUser.client.rpc('enable_product_in_branch', { p_product_id: botellaId, p_branch_id: t.branchA, p_min_qty: 2.5 }),
      'invalid_quantity',
    )
    expectRpcError(
      await t.opA.client.rpc('enable_product_in_branch', { p_product_id: botellaId, p_branch_id: t.branchA }),
      'permission_denied',
    )
  })
  it('CP-20 (parcial) cambiar el mínimo recalcula sin duplicar alertas', async () => {
    const r1 = await t.adminUser.client.rpc('set_min_qty', { p_branch_id: t.branchA, p_product_id: shampooId, p_min_qty: 0 })
    expect(r1.error).toBeNull()
    expect(await openAlerts(t.branchA, shampooId)).toBe(1) // 0 <= 0 sigue en alerta
    const r2 = await t.adminUser.client.rpc('set_min_qty', { p_branch_id: t.branchA, p_product_id: shampooId, p_min_qty: 1980 })
    expect(r2.error).toBeNull()
    expect(await openAlerts(t.branchA, shampooId)).toBe(1)
    expectRpcError(
      await t.adminUser.client.rpc('set_min_qty', { p_branch_id: t.branchB, p_product_id: shampooId, p_min_qty: 1 }),
      'not_enabled',
    )
  })
})

describe('set_initial_balance', () => {
  it('CP-05/CP-07 rechaza negativo, decimales en unidad y más de dos decimales', async () => {
    await t.adminUser.client.rpc('enable_product_in_branch', { p_product_id: botellaId, p_branch_id: t.branchA, p_min_qty: 5 })
    expectRpcError(
      await t.adminUser.client.rpc('set_initial_balance', { p_key: randomUUID(), p_branch_id: t.branchA, p_product_id: shampooId, p_qty: -1 }),
      'invalid_quantity',
    )
    expectRpcError(
      await t.adminUser.client.rpc('set_initial_balance', { p_key: randomUUID(), p_branch_id: t.branchA, p_product_id: botellaId, p_qty: 0.5 }),
      'invalid_quantity',
    )
    expectRpcError(
      await t.adminUser.client.rpc('set_initial_balance', { p_key: randomUUID(), p_branch_id: t.branchA, p_product_id: shampooId, p_qty: 1.005 }),
      'invalid_quantity',
    )
    expectRpcError(
      await t.adminUser.client.rpc('set_initial_balance', { p_key: randomUUID(), p_branch_id: t.branchA, p_product_id: shampooId, p_qty: 60000 }),
      'invalid_quantity',
    )
    expect(await movementsFor(t.branchA, shampooId)).toEqual([])
  })
  it('registra 2.000 ml, crea movimiento y resuelve la alerta (2.000 > 1.980)', async () => {
    const key = randomUUID()
    const res = await t.adminUser.client.rpc('set_initial_balance', {
      p_key: key, p_branch_id: t.branchA, p_product_id: shampooId, p_qty: 2000, p_reference: 'Conteo 10/09',
    })
    expect(res.error).toBeNull()
    expect(Number(res.data.balance)).toBe(2000)
    expect(res.data.movement_id).toBeTruthy()
    const inv = await admin.from('inventory').select('balance, version, initialized_at').eq('branch_id', t.branchA).eq('product_id', shampooId).single()
    expect(Number(inv.data!.balance)).toBe(2000)
    expect(Number(inv.data!.version)).toBe(2)
    expect(inv.data!.initialized_at).not.toBeNull()
    expect((await movementsFor(t.branchA, shampooId)).length).toBe(1)
    expect(await openAlerts(t.branchA, shampooId)).toBe(0)

    // CP-10 idempotencia: misma clave y mismos datos devuelve el mismo resultado sin nuevo movimiento
    const again = await t.adminUser.client.rpc('set_initial_balance', {
      p_key: key, p_branch_id: t.branchA, p_product_id: shampooId, p_qty: 2000, p_reference: 'Conteo 10/09',
    })
    expect(again.error).toBeNull()
    expect(again.data.operation_id).toBe(res.data.operation_id)
    expect((await movementsFor(t.branchA, shampooId)).length).toBe(1)

    // CP-11 misma clave, otra cantidad
    expectRpcError(
      await t.adminUser.client.rpc('set_initial_balance', { p_key: key, p_branch_id: t.branchA, p_product_id: shampooId, p_qty: 2500 }),
      'idempotency_conflict',
    )
    // otra clave, ya inicializado
    expectRpcError(
      await t.adminUser.client.rpc('set_initial_balance', { p_key: randomUUID(), p_branch_id: t.branchA, p_product_id: shampooId, p_qty: 1 }),
      'already_initialized',
    )
    expect(Number((await admin.from('inventory').select('balance').eq('branch_id', t.branchA).eq('product_id', shampooId).single()).data!.balance)).toBe(2000)
  })
  it('inicializar con 0 marca initialized_at, no crea movimiento y deja alerta', async () => {
    const res = await t.adminUser.client.rpc('set_initial_balance', { p_key: randomUUID(), p_branch_id: t.branchA, p_product_id: botellaId, p_qty: 0 })
    expect(res.error).toBeNull()
    expect(res.data.movement_id).toBeNull()
    const inv = await admin.from('inventory').select('initialized_at').eq('branch_id', t.branchA).eq('product_id', botellaId).single()
    expect(inv.data!.initialized_at).not.toBeNull()
    expect(await movementsFor(t.branchA, botellaId)).toEqual([])
    expect(await openAlerts(t.branchA, botellaId)).toBe(1)
  })
  it('unit_locked tras inicializar', async () => {
    expectRpcError(
      await t.adminUser.client.rpc('upsert_product', { p_id: shampooId, p_sku: 'SH-PRO', p_name: 'S', p_unit: 'g' }),
      'unit_locked',
    )
  })
  it('CP-33 con saldo no se desactiva el producto', async () => {
    expectRpcError(
      await t.adminUser.client.rpc('upsert_product', { p_id: shampooId, p_sku: 'SH-PRO', p_name: 'S', p_unit: 'ml', p_is_active: false }),
      'has_stock',
    )
  })
  it('producto no habilitado y sucursal ajena', async () => {
    expectRpcError(
      await t.adminUser.client.rpc('set_initial_balance', { p_key: randomUUID(), p_branch_id: t.branchB, p_product_id: botellaId, p_qty: 1 }),
      'not_enabled',
    )
    expectRpcError(
      await t.opA.client.rpc('set_initial_balance', { p_key: randomUUID(), p_branch_id: t.branchA, p_product_id: botellaId, p_qty: 1 }),
      'permission_denied',
    )
  })
  it('CP-21 el saldo persiste tras cerrar sesión y volver a entrar', async () => {
    const fresh = anonClient()
    const { error } = await fresh.auth.signInWithPassword({ email: t.opA.email, password: t.opA.password })
    expect(error).toBeNull()
    const { data } = await fresh.from('inventory_status').select('balance, sku').eq('product_id', shampooId)
    expect(data!.length).toBe(1)
    expect(Number(data![0]!.balance)).toBe(2000)
    await fresh.auth.signOut()
  })
})

describe('CP-23 tercera sucursal por configuración', () => {
  it('opera con inventario, alertas y operador propios', async () => {
    const c = await t.adminUser.client.rpc('create_branch', { p_code: 'TC', p_name: 'Sucursal C' })
    expect(c.error).toBeNull()
    const opC = await t.addUser('operator', c.data.id, 'opc')
    const en = await t.adminUser.client.rpc('enable_product_in_branch', { p_product_id: shampooId, p_branch_id: c.data.id, p_min_qty: 500 })
    expect(en.error).toBeNull()
    const init = await t.adminUser.client.rpc('set_initial_balance', { p_key: randomUUID(), p_branch_id: c.data.id, p_product_id: shampooId, p_qty: 300 })
    expect(init.error).toBeNull()
    expect(await openAlerts(c.data.id, shampooId)).toBe(1)
    const mine = await opC.client.from('inventory_status').select('branch_id, balance')
    expect(mine.data!.map((r) => r.branch_id)).toEqual([c.data.id])
    expect(Number(mine.data![0]!.balance)).toBe(300)
    const notA = await opC.client.from('inventory').select('*').eq('branch_id', t.branchA)
    expect(notA.data).toEqual([])
  })
})
```

- [ ] **Paso 2: Correr y verificar que falla**

Run: `npm run test:db -- tests/db/inventory.test.ts`
Expected: FAIL con `Could not find the function public.enable_product_in_branch`.

- [ ] **Paso 3: Escribir `supabase/migrations/0004_rpc_inventory.sql`**

```sql
-- 0004_rpc_inventory.sql — habilitación por sucursal, mínimos, alerta y saldo inicial.

-- Abre alerta si balance <= min_qty (incluye 0); la resuelve si balance > min_qty. Máximo una abierta.
create or replace function public.recalc_alert(p_branch_id uuid, p_product_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_inv public.inventory; v_open uuid;
begin
  select * into v_inv from public.inventory where branch_id = p_branch_id and product_id = p_product_id;
  if v_inv.id is null then return; end if;
  select id into v_open from public.alerts
   where branch_id = p_branch_id and product_id = p_product_id and status = 'open';
  if v_inv.balance <= v_inv.min_qty then
    if v_open is null then
      insert into public.alerts (chain_id, branch_id, product_id) values (v_inv.chain_id, p_branch_id, p_product_id);
    end if;
  elsif v_open is not null then
    update public.alerts set status = 'resolved', resolved_at = now() where id = v_open;
  end if;
end;
$$;
revoke execute on function public.recalc_alert(uuid, uuid) from public, anon, authenticated;

create or replace function public.enable_product_in_branch(p_product_id uuid, p_branch_id uuid, p_min_qty numeric default 0)
returns public.inventory language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor public.profiles; v_prod public.products; v_branch public.branches; v_row public.inventory;
begin
  v_actor := public.assert_admin();
  select * into v_prod from public.products where id = p_product_id and chain_id = v_actor.chain_id;
  if v_prod.id is null then perform public.raise_error('not_found', 'El producto no existe.'); end if;
  if not v_prod.is_active then perform public.raise_error('product_inactive', 'El producto está inactivo.'); end if;
  select * into v_branch from public.branches where id = p_branch_id and chain_id = v_actor.chain_id;
  if v_branch.id is null then perform public.raise_error('not_found', 'La sucursal no existe.'); end if;
  if not v_branch.is_active then perform public.raise_error('branch_inactive', 'La sucursal está inactiva.'); end if;
  perform public.assert_quantity_scale(coalesce(p_min_qty, 0), v_prod.unit);
  if exists (select 1 from public.inventory where branch_id = p_branch_id and product_id = p_product_id) then
    perform public.raise_error('already_enabled', 'El producto ya está habilitado en esa sucursal.');
  end if;
  insert into public.inventory (chain_id, branch_id, product_id, min_qty)
  values (v_actor.chain_id, p_branch_id, p_product_id, coalesce(p_min_qty, 0))
  returning * into v_row;
  perform public.recalc_alert(p_branch_id, p_product_id);
  perform public.log_audit(v_actor.id, v_actor.chain_id, 'inventory.enable', 'inventory', v_row.id, null, to_jsonb(v_row));
  return v_row;
end;
$$;

create or replace function public.set_min_qty(p_branch_id uuid, p_product_id uuid, p_min_qty numeric)
returns public.inventory language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor public.profiles; v_old public.inventory; v_row public.inventory; v_unit public.unit_kind;
begin
  v_actor := public.assert_admin();
  select * into v_old from public.inventory
   where branch_id = p_branch_id and product_id = p_product_id and chain_id = v_actor.chain_id for update;
  if v_old.id is null then perform public.raise_error('not_enabled', 'El producto no está habilitado en esa sucursal.'); end if;
  select unit into v_unit from public.products where id = p_product_id;
  perform public.assert_quantity_scale(p_min_qty, v_unit);
  update public.inventory set min_qty = p_min_qty, updated_at = now() where id = v_old.id returning * into v_row;
  perform public.recalc_alert(p_branch_id, p_product_id);
  perform public.log_audit(v_actor.id, v_actor.chain_id, 'inventory.set_min', 'inventory', v_row.id, to_jsonb(v_old), to_jsonb(v_row));
  return v_row;
end;
$$;

create or replace function public.set_initial_balance(
  p_key uuid, p_branch_id uuid, p_product_id uuid, p_qty numeric, p_reference text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor public.profiles; v_hash text; v_existing public.operations; v_prod public.products;
  v_branch public.branches; v_inv public.inventory; v_op public.operations; v_mov_id uuid; v_result jsonb;
begin
  v_actor := public.assert_admin();
  if p_key is null then perform public.raise_error('invalid_key', 'Falta el identificador de la operación.'); end if;
  v_hash := md5(concat_ws('|', p_branch_id::text, p_product_id::text, p_qty::text, coalesce(p_reference, '')));

  select * into v_existing from public.operations where chain_id = v_actor.chain_id and idempotency_key = p_key;
  if v_existing.id is not null then
    if v_existing.request_hash = v_hash then return v_existing.result; end if;
    perform public.raise_error('idempotency_conflict', 'Esta operación ya se envió con otros datos.');
  end if;

  select * into v_prod from public.products where id = p_product_id and chain_id = v_actor.chain_id;
  if v_prod.id is null then perform public.raise_error('not_found', 'El producto no existe.'); end if;
  if not v_prod.is_active then perform public.raise_error('product_inactive', 'El producto está inactivo.'); end if;
  select * into v_branch from public.branches where id = p_branch_id and chain_id = v_actor.chain_id;
  if v_branch.id is null then perform public.raise_error('not_found', 'La sucursal no existe.'); end if;
  if not v_branch.is_active then perform public.raise_error('branch_inactive', 'La sucursal está inactiva.'); end if;
  perform public.assert_quantity_scale(p_qty, v_prod.unit);
  if p_qty > v_prod.max_movement_qty then
    perform public.raise_error('invalid_quantity', 'La cantidad supera el máximo por movimiento del producto.');
  end if;

  select * into v_inv from public.inventory where branch_id = p_branch_id and product_id = p_product_id for update;
  if v_inv.id is null then perform public.raise_error('not_enabled', 'El producto no está habilitado en esa sucursal.'); end if;

  -- Re-chequeo tras el bloqueo: un reintento concurrente con la misma clave pudo confirmarse mientras esperábamos.
  select * into v_existing from public.operations where chain_id = v_actor.chain_id and idempotency_key = p_key;
  if v_existing.id is not null then
    if v_existing.request_hash = v_hash then return v_existing.result; end if;
    perform public.raise_error('idempotency_conflict', 'Esta operación ya se envió con otros datos.');
  end if;

  if v_inv.initialized_at is not null
     or exists (select 1 from public.movements where branch_id = p_branch_id and product_id = p_product_id) then
    perform public.raise_error('already_initialized', 'El saldo inicial ya fue registrado.');
  end if;

  insert into public.operations (chain_id, type, actor_profile_id, idempotency_key, request_hash, reference)
  values (v_actor.chain_id, 'initial', v_actor.id, p_key, v_hash, nullif(trim(p_reference), ''))
  returning * into v_op;

  if p_qty > 0 then
    insert into public.movements (chain_id, operation_id, product_id, branch_id, qty_delta, unit)
    values (v_actor.chain_id, v_op.id, p_product_id, p_branch_id, p_qty, v_prod.unit)
    returning id into v_mov_id;
  end if;

  update public.inventory
     set balance = p_qty, initialized_at = now(), version = version + 1, updated_at = now()
   where id = v_inv.id returning * into v_inv;

  perform public.recalc_alert(p_branch_id, p_product_id);

  v_result := jsonb_build_object(
    'operation_id', v_op.id, 'movement_id', v_mov_id, 'balance', v_inv.balance,
    'branch_id', p_branch_id, 'product_id', p_product_id);
  update public.operations set result = v_result where id = v_op.id;
  perform public.log_audit(v_actor.id, v_actor.chain_id, 'inventory.initial_balance', 'inventory', v_inv.id, null, v_result);
  return v_result;
end;
$$;

revoke execute on function
  public.enable_product_in_branch(uuid, uuid, numeric),
  public.set_min_qty(uuid, uuid, numeric),
  public.set_initial_balance(uuid, uuid, uuid, numeric, text)
from public, anon;
grant execute on function
  public.enable_product_in_branch(uuid, uuid, numeric),
  public.set_min_qty(uuid, uuid, numeric),
  public.set_initial_balance(uuid, uuid, uuid, numeric, text)
to authenticated;
```

- [ ] **Paso 4: Aplicar**

Run: `npm run db:push`
Expected: `Applying migration 0004_rpc_inventory.sql...` sin errores.

- [ ] **Paso 5: Correr y verificar que pasa**

Run: `npm run test:db`
Expected: los tres archivos PASS.

- [ ] **Paso 6: Commit**

```bash
git add supabase/migrations/0004_rpc_inventory.sql tests/db/inventory.test.ts
git commit -m "db: habilitación por sucursal, mínimos, alertas y saldo inicial idempotente

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 8: Tipos generados, modelos, cliente Supabase y helper de validación

**Files:**
- Create: `src/types/database.ts` (generado), `src/types/models.ts`, `src/lib/supabase.ts`, `src/lib/validation.ts`
- Test: `tests/unit/validation.test.ts`

**Interfaces:**
- Produces:
  - `supabase: SupabaseClient<Database>` (cliente único)
  - `Tables<'x'>`, `Views<'x'>`, `Enums<'x'>`; alias `Branch`, `Profile`, `Product`, `Inventory`, `Alert`, `InventoryStatus`, `ProfilePublic`, `UnitKind`, `UserRole`; `ROLE_LABEL: Record<UserRole, string>`
  - `fieldErrors(error: ZodError): Record<string, string>`

- [ ] **Paso 1: Generar tipos**

Run: `npm run db:types`
Expected: `src/types/database.ts` creado. Verificar:

Run: `grep -c "inventory_status\|profiles_public\|set_initial_balance\|create_branch" src/types/database.ts`
Expected: número mayor que 0 (las vistas y RPC están tipadas).

- [ ] **Paso 2: Escribir `src/types/models.ts`**

```ts
import type { Database } from './database'

type PublicSchema = Database['public']

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row']
export type Views<T extends keyof PublicSchema['Views']> = PublicSchema['Views'][T]['Row']
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T]

export type Chain = Tables<'chains'>
export type Branch = Tables<'branches'>
export type Profile = Tables<'profiles'>
export type Product = Tables<'products'>
export type Inventory = Tables<'inventory'>
export type Alert = Tables<'alerts'>
export type InventoryStatus = Views<'inventory_status'>
export type ProfilePublic = Views<'profiles_public'>

export type UnitKind = Enums<'unit_kind'>
export type UserRole = Enums<'user_role'>

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Administrador',
  operator: 'Operador',
}
```

- [ ] **Paso 3: Escribir `src/lib/supabase.ts`**

```ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env.local (ver .env.example)')
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
```

- [ ] **Paso 4: Test y helper de validación**

`tests/unit/validation.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { fieldErrors } from '@/lib/validation'

const schema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio.'),
  code: z.string().regex(/^[A-Z0-9]{2,8}$/, 'Código inválido.'),
})

describe('fieldErrors', () => {
  it('devuelve el primer mensaje por campo', () => {
    const r = schema.safeParse({ name: '  ', code: 'ab' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(fieldErrors(r.error)).toEqual({ name: 'El nombre es obligatorio.', code: 'Código inválido.' })
    }
  })
  it('no falla con path vacío', () => {
    const r = z.string().safeParse(5)
    if (!r.success) expect(Object.keys(fieldErrors(r.error))).toEqual(['_'])
  })
})
```

`src/lib/validation.ts`:

```ts
import type { ZodError } from 'zod'

export type FieldErrors = Record<string, string>

/** Primer mensaje de error por campo (clave `_` para errores sin campo). */
export function fieldErrors(error: ZodError): FieldErrors {
  const out: FieldErrors = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '_')
    if (!(key in out)) out[key] = issue.message
  }
  return out
}
```

- [ ] **Paso 5: Verificar**

Run: `npm test`
Expected: PASS.

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Paso 6: Commit**

```bash
git add src/types src/lib/supabase.ts src/lib/validation.ts tests/unit/validation.test.ts
git commit -m "feat: tipos generados de Supabase, cliente único y helper de validación

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Primitivas de UI

**Files:**
- Create: `src/components/ui/Button.tsx`, `Input.tsx`, `Select.tsx`, `Chip.tsx`, `Dialog.tsx`, `Toast.tsx`, `OfflineBanner.tsx`, `PageHeader.tsx`, `States.tsx`

**Interfaces:**
- Produces:
  - `Button({ variant?: 'primary'|'secondary'|'danger'|'ghost', ...button props })`
  - `Input({ label, error?, hint?, ...input props })`, `Select({ label, error?, options: {value,label}[], placeholder?, ...select props })`
  - `Chip({ tone?: 'amber'|'indigo'|'carmine'|'sage'|'neutral', children })`
  - `Dialog({ open, onClose, title, children })`
  - `ToastProvider`, `useToast().push({ kind: 'success'|'error'|'info', text })`
  - `useOnline(): boolean`, `OfflineBanner()`
  - `PageHeader({ eyebrow?, title, description?, actions? })`
  - `LoadingState({ label? })`, `EmptyState({ title, description?, action? })`, `ErrorState({ message, onRetry? })`

- [ ] **Paso 1: `Button.tsx`, `Input.tsx`, `Select.tsx`, `Chip.tsx`**

`src/components/ui/Button.tsx`:

```tsx
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const styles: Record<Variant, string> = {
  primary: 'bg-ink text-white hover:bg-ink-hover disabled:bg-ink/40',
  secondary: 'border border-hairline bg-surface text-ink hover:bg-canvas disabled:text-muted',
  danger: 'bg-carmine-fg text-white hover:opacity-90 disabled:opacity-50',
  ghost: 'text-ink hover:bg-canvas disabled:text-muted',
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }

export function Button({ variant = 'primary', className = '', type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-control px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...rest}
    />
  )
}
```

`src/components/ui/Input.tsx`:

```tsx
import { useId, type InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }

export function Input({ label, error, hint, id, className = '', ...rest }: Props) {
  const autoId = useId()
  const inputId = id ?? autoId
  const describedBy = error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`h-10 rounded-control border bg-surface px-3 text-sm ${error ? 'border-carmine-fg' : 'border-hairline'} ${className}`}
        {...rest}
      />
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${inputId}-err`} role="alert" className="text-xs text-carmine-fg">
          {error}
        </p>
      )}
    </div>
  )
}
```

`src/components/ui/Select.tsx`:

```tsx
import { useId, type SelectHTMLAttributes } from 'react'

type Option = { value: string; label: string }
type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  options: Option[]
  placeholder?: string
  error?: string
}

export function Select({ label, options, placeholder, error, id, className = '', ...rest }: Props) {
  const autoId = useId()
  const selectId = id ?? autoId
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={selectId} className="text-sm font-semibold">
        {label}
      </label>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${selectId}-err` : undefined}
        className={`h-10 rounded-control border bg-surface px-3 text-sm ${error ? 'border-carmine-fg' : 'border-hairline'} ${className}`}
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${selectId}-err`} role="alert" className="text-xs text-carmine-fg">
          {error}
        </p>
      )}
    </div>
  )
}
```

`src/components/ui/Chip.tsx`:

```tsx
import type { ReactNode } from 'react'

type Tone = 'amber' | 'indigo' | 'carmine' | 'sage' | 'neutral'

const tones: Record<Tone, string> = {
  amber: 'bg-amber-bg text-amber-fg',
  indigo: 'bg-indigo-bg text-indigo-fg',
  carmine: 'bg-carmine-bg text-carmine-fg',
  sage: 'bg-sage-bg text-sage-fg',
  neutral: 'border border-hairline bg-canvas text-muted',
}

export function Chip({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`label-caps inline-flex items-center rounded-full px-2.5 py-1 ${tones[tone]}`}>
      {children}
    </span>
  )
}
```

- [ ] **Paso 2: `Dialog.tsx`, `Toast.tsx`, `OfflineBanner.tsx`**

`src/components/ui/Dialog.tsx`:

```tsx
import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

type Props = { open: boolean; onClose: () => void; title: string; children: ReactNode }

/** Diálogo modal nativo. Se cierra con Escape, con la X o cuando `open` pasa a false. */
export function Dialog({ open, onClose, title, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[min(92vw,32rem)] rounded-lg border border-hairline bg-surface p-0 shadow-2xl backdrop:bg-ink/35 backdrop:backdrop-blur-[4px]"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-control p-1 text-muted hover:bg-canvas hover:text-ink"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </dialog>
  )
}
```

`src/components/ui/Toast.tsx`:

```tsx
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type Kind = 'success' | 'error' | 'info'
type Toast = { id: number; kind: Kind; text: string }
type Ctx = { push: (t: { kind: Kind; text: string }) => void }

const ToastContext = createContext<Ctx | null>(null)

const tone: Record<Kind, string> = {
  success: 'bg-sage-bg text-sage-fg',
  error: 'bg-carmine-bg text-carmine-fg',
  info: 'bg-indigo-bg text-indigo-fg',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const push = useCallback((t: { kind: Kind; text: string }) => {
    const id = Date.now() + Math.random()
    setItems((prev) => [...prev, { ...t, id }])
    window.setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), 5000)
  }, [])
  return (
    <ToastContext value={{ push }}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="fixed right-4 bottom-20 z-50 flex flex-col gap-2 md:bottom-4"
      >
        {items.map((i) => (
          <div key={i.id} className={`rounded-control px-4 py-3 text-sm font-semibold shadow-lg ${tone[i.kind]}`}>
            {i.text}
          </div>
        ))}
      </div>
    </ToastContext>
  )
}

export function useToast(): Ctx {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider')
  return ctx
}
```

`src/components/ui/OfflineBanner.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

export function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <div role="alert" className="flex items-center gap-2 bg-carmine-bg px-4 py-2 text-sm font-semibold text-carmine-fg">
      <WifiOff size={16} aria-hidden />
      Sin conexión. Los cambios no se pueden confirmar hasta que vuelva.
    </div>
  )
}
```

- [ ] **Paso 3: `PageHeader.tsx` y `States.tsx`**

`src/components/ui/PageHeader.tsx`:

```tsx
import type { ReactNode } from 'react'

type Props = { eyebrow?: string; title: string; description?: string; actions?: ReactNode }

export function PageHeader({ eyebrow, title, description, actions }: Props) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="label-caps text-muted">{eyebrow}</p>}
        <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
```

`src/components/ui/States.tsx`:

```tsx
import type { ReactNode } from 'react'
import { CircleAlert } from 'lucide-react'
import { Button } from './Button'

export function LoadingState({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 p-6 text-sm text-muted">
      <span className="size-4 animate-spin rounded-full border-2 border-hairline border-t-ink" aria-hidden />
      {label}
    </div>
  )
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-hairline bg-surface p-8 text-center">
      <p className="font-semibold">{title}</p>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-carmine-fg/30 bg-carmine-bg p-4 text-sm text-carmine-fg">
      <p className="flex items-center gap-2 font-semibold">
        <CircleAlert size={16} aria-hidden /> {message}
      </p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Paso 4: Verificar**

Run: `npm run typecheck`
Expected: sin errores. Si `lucide-react` no exporta `CircleAlert`, `WifiOff` o `X`, buscar el nombre actual con `grep -o "export { default as [A-Za-z]*Alert[A-Za-z]* }" node_modules/lucide-react/dist/lucide-react.d.ts | head` y usar ese.

- [ ] **Paso 5: Commit**

```bash
git add src/components/ui
git commit -m "feat: primitivas de UI del design system (botón, inputs, chip, diálogo, toast, estados)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Sesión, páginas de acceso, guardas, router y shell

**Files:**
- Create: `src/features/auth/session.tsx`, `useProfile.ts`, `authErrors.ts`, `AuthLayout.tsx`, `LoginPage.tsx`, `RecuperarPage.tsx`, `RestablecerPage.tsx`, `SinPerfilPage.tsx`; `src/app/guards.tsx`, `providers.tsx`, `router.tsx`; `src/app/layout/nav.ts`, `AppShell.tsx`, `BranchPill.tsx`; `src/features/branches/api.ts`, `activeBranch.tsx`; `src/features/home/HomeRedirect.tsx`; `src/pages/ForbiddenPage.tsx`, `NotFoundPage.tsx`, `PlaceholderPage.tsx`
- Modify: `src/App.tsx` (reemplazar el provisorio)
- Test: `tests/unit/authErrors.test.ts`

**Interfaces:**
- Produces:
  - `SessionProvider({ onSignedOut?, children })`, `useSession(): { status: 'loading'|'signed_out'|'signed_in'; session }`, `signOut()`, `SESSION_EXPIRED_FLAG`
  - `useProfile()` (query de `profiles` por `auth_user_id`), `profileKey(userId)`
  - `RequireAuth`, `RequireProfile`, `RequireRole({ role })`, `useCurrentProfile(): Profile`
  - `useBranches()` → `Branch[]`, `branchKeys.all`
  - `ActiveBranchProvider`, `useActiveBranch(): { branchId: string | 'all'; setBranchId; canChange }`
  - `router` (rutas de la Tarea 10; las tareas 11–15 reemplazan los `PlaceholderPage`)
  - `authMessage(err): string`

- [ ] **Paso 1: Test de `authMessage`**

`tests/unit/authErrors.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { authMessage } from '@/features/auth/authErrors'

describe('authMessage', () => {
  it('traduce credenciales inválidas', () => {
    expect(authMessage({ message: 'Invalid login credentials' })).toBe('Email o contraseña incorrectos.')
  })
  it('traduce límite de intentos', () => {
    expect(authMessage({ message: 'Request rate limit reached' })).toBe('Demasiados intentos. Esperá un momento y reintentá.')
  })
  it('cae al genérico', () => {
    expect(authMessage({ message: 'weird' })).toBe('No se pudo completar la operación. Reintentá.')
    expect(authMessage(null)).toBe('No se pudo completar la operación. Reintentá.')
  })
})
```

Run: `npm test -- tests/unit/authErrors.test.ts` → Expected: FAIL (import no resuelto).

- [ ] **Paso 2: `authErrors.ts`, `session.tsx`, `useProfile.ts`**

`src/features/auth/authErrors.ts`:

```ts
/** Traduce errores de Supabase Auth a mensajes para el usuario. */
export function authMessage(err: { message?: string } | null | undefined): string {
  const m = err?.message ?? ''
  if (/invalid login credentials/i.test(m)) return 'Email o contraseña incorrectos.'
  if (/email not confirmed/i.test(m)) return 'La cuenta todavía no está confirmada.'
  if (/rate limit|too many/i.test(m)) return 'Demasiados intentos. Esperá un momento y reintentá.'
  if (/password should be at least|weak password/i.test(m)) return 'La contraseña debe tener al menos 6 caracteres.'
  if (/same password|different from the old/i.test(m)) return 'La nueva contraseña debe ser distinta a la anterior.'
  if (/failed to fetch|network/i.test(m)) return 'No se pudo conectar. Verificá la conexión.'
  return 'No se pudo completar la operación. Reintentá.'
}
```

`src/features/auth/session.tsx`:

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type SessionState = {
  status: 'loading' | 'signed_out' | 'signed_in'
  session: Session | null
}

const SessionContext = createContext<SessionState>({ status: 'loading', session: null })

export const SESSION_EXPIRED_FLAG = 'stock:sesion_vencida'
const LOGOUT_FLAG = 'stock:logout'

function safeStorage(fn: (s: Storage) => void) {
  try {
    fn(window.sessionStorage)
  } catch {
    /* sin storage (modo privado, etc.) */
  }
}

export function SessionProvider({ onSignedOut, children }: { onSignedOut?: () => void; children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading', session: null })

  useEffect(() => {
    let previous: SessionState['status'] = 'loading'
    void supabase.auth.getSession().then(({ data }) => {
      previous = data.session ? 'signed_in' : 'signed_out'
      setState({ status: previous, session: data.session })
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' && previous === 'signed_in') {
        safeStorage((s) => {
          if (!s.getItem(LOGOUT_FLAG)) s.setItem(SESSION_EXPIRED_FLAG, '1')
          s.removeItem(LOGOUT_FLAG)
        })
        onSignedOut?.()
      }
      previous = session ? 'signed_in' : 'signed_out'
      setState({ status: previous, session })
    })
    return () => sub.subscription.unsubscribe()
  }, [onSignedOut])

  return <SessionContext value={state}>{children}</SessionContext>
}

export function useSession(): SessionState {
  return useContext(SessionContext)
}

/** Cierre de sesión explícito: no se muestra "sesión vencida". */
export async function signOut() {
  safeStorage((s) => s.setItem(LOGOUT_FLAG, '1'))
  await supabase.auth.signOut()
}
```

`src/features/auth/useProfile.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/models'
import { useSession } from './session'

export const profileKey = (userId: string | undefined) => ['profile', userId] as const

/** Perfil del usuario autenticado. `null` si no tiene perfil o está inactivo (RLS lo oculta). */
export function useProfile() {
  const { session } = useSession()
  const userId = session?.user.id
  return useQuery({
    queryKey: profileKey(userId),
    enabled: Boolean(userId),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('auth_user_id', userId!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}
```

- [ ] **Paso 3: Páginas de acceso**

`src/features/auth/AuthLayout.tsx`:

```tsx
import type { ReactNode } from 'react'
import { OfflineBanner } from '@/components/ui/OfflineBanner'

export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <OfflineBanner />
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-lg border border-hairline bg-surface p-6">
          <p className="label-caps text-muted">Stock Peluquerías</p>
          <h1 className="mt-1 mb-6 text-2xl font-bold">{title}</h1>
          {children}
        </div>
      </main>
    </div>
  )
}
```

`src/features/auth/LoginPage.tsx`:

```tsx
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useOnline } from '@/components/ui/OfflineBanner'
import { AuthLayout } from './AuthLayout'
import { authMessage } from './authErrors'
import { SESSION_EXPIRED_FLAG, useSession } from './session'

function consumeExpiredFlag(): boolean {
  try {
    const v = window.sessionStorage.getItem(SESSION_EXPIRED_FLAG) === '1'
    window.sessionStorage.removeItem(SESSION_EXPIRED_FLAG)
    return v
  } catch {
    return false
  }
}

export function LoginPage() {
  const { status } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const online = useOnline()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [expired] = useState(consumeExpiredFlag)

  if (status === 'signed_in') return <Navigate to="/" replace />

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setPending(false)
    if (error) {
      setError(authMessage(error))
      return
    }
    navigate(from, { replace: true })
  }

  return (
    <AuthLayout title="Iniciar sesión">
      {expired && (
        <p role="status" className="mb-4 rounded-control bg-amber-bg p-3 text-sm text-amber-fg">
          Tu sesión venció. Volvé a ingresar.
        </p>
      )}
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input label="Contraseña" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && (
          <p role="alert" className="text-sm text-carmine-fg">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending || !online}>
          {pending ? 'Ingresando…' : 'Ingresar'}
        </Button>
        <Link to="/auth/recuperar" className="text-sm text-muted underline">
          Olvidé mi contraseña
        </Link>
      </form>
    </AuthLayout>
  )
}
```

`src/features/auth/RecuperarPage.tsx`:

```tsx
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useOnline } from '@/components/ui/OfflineBanner'
import { AuthLayout } from './AuthLayout'
import { authMessage } from './authErrors'

export function RecuperarPage() {
  const online = useOnline()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/restablecer`,
    })
    setPending(false)
    if (error && /failed to fetch|network|rate limit/i.test(error.message)) {
      setError(authMessage(error))
      return
    }
    // No revelar si el email existe.
    setSent(true)
  }

  return (
    <AuthLayout title="Recuperar contraseña">
      {sent ? (
        <div className="flex flex-col gap-4 text-sm">
          <p role="status">Si el email existe, te enviamos un enlace para restablecer la contraseña.</p>
          <Link to="/login" className="underline">
            Volver a iniciar sesión
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          {error && (
            <p role="alert" className="text-sm text-carmine-fg">
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending || !online || !email.trim()}>
            {pending ? 'Enviando…' : 'Enviar enlace'}
          </Button>
          <Link to="/login" className="text-sm text-muted underline">
            Volver
          </Link>
        </form>
      )}
    </AuthLayout>
  )
}
```

`src/features/auth/RestablecerPage.tsx`:

```tsx
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LoadingState } from '@/components/ui/States'
import { AuthLayout } from './AuthLayout'
import { authMessage } from './authErrors'
import { useSession } from './session'

export function RestablecerPage() {
  const { status } = useSession()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (status === 'loading') return <LoadingState label="Verificando enlace…" />
  if (status === 'signed_out') {
    return (
      <AuthLayout title="Enlace inválido">
        <p className="text-sm">El enlace no es válido o venció.</p>
        <Link to="/auth/recuperar" className="mt-4 inline-block text-sm underline">
          Pedir uno nuevo
        </Link>
      </AuthLayout>
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.')
    if (password !== confirm) return setError('Las contraseñas no coinciden.')
    setPending(true)
    const { error } = await supabase.auth.updateUser({ password })
    setPending(false)
    if (error) return setError(authMessage(error))
    navigate('/', { replace: true })
  }

  return (
    <AuthLayout title="Nueva contraseña">
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Input label="Nueva contraseña" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Input label="Repetir contraseña" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        {error && (
          <p role="alert" className="text-sm text-carmine-fg">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar contraseña'}
        </Button>
      </form>
    </AuthLayout>
  )
}
```

`src/features/auth/SinPerfilPage.tsx`:

```tsx
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { AuthLayout } from './AuthLayout'
import { signOut } from './session'

export function SinPerfilPage() {
  const navigate = useNavigate()
  return (
    <AuthLayout title="Cuenta sin perfil">
      <p className="text-sm">
        Tu cuenta no tiene un perfil activo en ninguna cadena. Pedile al administrador que te habilite y volvé a ingresar.
      </p>
      <Button
        className="mt-6"
        variant="secondary"
        onClick={async () => {
          await signOut()
          navigate('/login', { replace: true })
        }}
      >
        Cerrar sesión
      </Button>
    </AuthLayout>
  )
}
```

- [ ] **Paso 4: Guardas, providers, sucursal activa y `useBranches`**

`src/app/guards.tsx`:

```tsx
import { createContext, useContext } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { useSession } from '@/features/auth/session'
import { useProfile } from '@/features/auth/useProfile'
import { messageFor } from '@/lib/errors'
import type { Profile, UserRole } from '@/types/models'

export function RequireAuth() {
  const { status } = useSession()
  const location = useLocation()
  if (status === 'loading') return <LoadingState label="Verificando sesión…" />
  if (status === 'signed_out') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return <Outlet />
}

const ProfileContext = createContext<Profile | null>(null)

export function RequireProfile() {
  const q = useProfile()
  if (q.isPending) return <LoadingState label="Cargando perfil…" />
  if (q.isError) return <ErrorState message={messageFor(q.error)} onRetry={() => void q.refetch()} />
  if (!q.data) return <Navigate to="/sin-perfil" replace />
  return (
    <ProfileContext value={q.data}>
      <Outlet />
    </ProfileContext>
  )
}

/** Perfil activo garantizado (solo dentro de RequireProfile). */
export function useCurrentProfile(): Profile {
  const p = useContext(ProfileContext)
  if (!p) throw new Error('useCurrentProfile debe usarse dentro de RequireProfile')
  return p
}

/** Ayuda visual: el servidor es quien realmente autoriza. */
export function RequireRole({ role }: { role: UserRole }) {
  const p = useCurrentProfile()
  if (p.role !== role) return <Navigate to="/403" replace />
  return <Outlet />
}
```

`src/app/providers.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCallback, useState, type ReactNode } from 'react'
import { ToastProvider } from '@/components/ui/Toast'
import { SessionProvider } from '@/features/auth/session'

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }),
  )
  const onSignedOut = useCallback(() => client.clear(), [client])
  return (
    <QueryClientProvider client={client}>
      <SessionProvider onSignedOut={onSignedOut}>
        <ToastProvider>{children}</ToastProvider>
      </SessionProvider>
    </QueryClientProvider>
  )
}
```

`src/features/branches/api.ts` (solo lectura por ahora; la Tarea 11 agrega mutaciones):

```ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Branch } from '@/types/models'

export const branchKeys = { all: ['branches'] as const }

export function useBranches() {
  return useQuery({
    queryKey: branchKeys.all,
    staleTime: 60_000,
    queryFn: async (): Promise<Branch[]> => {
      const { data, error } = await supabase.from('branches').select('*').order('name')
      if (error) throw error
      return data
    },
  })
}
```

`src/features/branches/activeBranch.tsx`:

```tsx
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { useCurrentProfile } from '@/app/guards'

export type ActiveBranchId = string | 'all'
type Ctx = { branchId: ActiveBranchId; setBranchId: (id: ActiveBranchId) => void; canChange: boolean }

const ActiveBranchContext = createContext<Ctx | null>(null)
const STORAGE_KEY = 'stock:sucursal-activa'

function readStored(): ActiveBranchId {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? 'all'
  } catch {
    return 'all'
  }
}

/** Operador: fija a su sucursal. Admin: elige una o "all" (comparar), recordado en localStorage. */
export function ActiveBranchProvider({ children }: { children: ReactNode }) {
  const profile = useCurrentProfile()
  const [stored, setStored] = useState<ActiveBranchId>(readStored)
  const setBranchId = useCallback((id: ActiveBranchId) => {
    setStored(id)
    try {
      window.localStorage.setItem(STORAGE_KEY, id)
    } catch {
      /* sin storage */
    }
  }, [])
  const isOperator = profile.role === 'operator'
  const value: Ctx = {
    branchId: isOperator ? (profile.branch_id as string) : stored,
    setBranchId,
    canChange: !isOperator,
  }
  return <ActiveBranchContext value={value}>{children}</ActiveBranchContext>
}

export function useActiveBranch(): Ctx {
  const ctx = useContext(ActiveBranchContext)
  if (!ctx) throw new Error('useActiveBranch debe usarse dentro de ActiveBranchProvider')
  return ctx
}
```

- [ ] **Paso 5: Shell, navegación y pill de sucursal**

`src/app/layout/nav.ts`:

```ts
import { Boxes, House, Package, Store, Users, type LucideIcon } from 'lucide-react'

export type NavItem = { to: string; label: string; icon: LucideIcon; adminOnly?: boolean }

export const NAV: NavItem[] = [
  { to: '/inicio', label: 'Inicio', icon: House, adminOnly: true },
  { to: '/inventario', label: 'Inventario', icon: Boxes },
  { to: '/catalogo', label: 'Catálogo', icon: Package, adminOnly: true },
  { to: '/sucursales', label: 'Sucursales', icon: Store, adminOnly: true },
  { to: '/usuarios', label: 'Usuarios', icon: Users, adminOnly: true },
]
```

`src/app/layout/BranchPill.tsx`:

```tsx
import { MapPin } from 'lucide-react'
import { useBranches } from '@/features/branches/api'
import { useActiveBranch } from '@/features/branches/activeBranch'

/** Sucursal activa siempre visible. Admin puede cambiarla; operador la ve fija. */
export function BranchPill() {
  const { branchId, setBranchId, canChange } = useActiveBranch()
  const branches = useBranches()
  const active = (branches.data ?? []).filter((b) => b.is_active)
  const current = branches.data?.find((b) => b.id === branchId)
  const label = branchId === 'all' ? 'Todas las sucursales' : (current?.name ?? 'Sucursal')

  const base =
    'inline-flex h-9 items-center gap-2 rounded-full border border-champagne/30 bg-canvas px-3 text-sm font-semibold'

  if (!canChange) {
    return (
      <span className={base} aria-label={`Sucursal activa: ${label}`}>
        <MapPin size={16} className="text-champagne" aria-hidden /> {label}
      </span>
    )
  }
  return (
    <label className={`${base} cursor-pointer`}>
      <MapPin size={16} className="text-champagne" aria-hidden />
      <span className="sr-only">Sucursal activa</span>
      <select
        value={branchId}
        onChange={(e) => setBranchId(e.target.value === 'all' ? 'all' : e.target.value)}
        className="bg-transparent pr-1 text-sm font-semibold outline-none"
      >
        <option value="all">Todas las sucursales</option>
        {active.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </label>
  )
}
```

`src/app/layout/AppShell.tsx`:

```tsx
import { NavLink, Outlet } from 'react-router'
import { LogOut } from 'lucide-react'
import { OfflineBanner } from '@/components/ui/OfflineBanner'
import { useCurrentProfile } from '@/app/guards'
import { signOut } from '@/features/auth/session'
import { ActiveBranchProvider } from '@/features/branches/activeBranch'
import { ROLE_LABEL } from '@/types/models'
import { BranchPill } from './BranchPill'
import { NAV, type NavItem } from './nav'

function SideLink({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-control px-3 py-2 text-sm font-semibold ${isActive ? 'bg-ink text-white' : 'text-ink hover:bg-canvas'}`
      }
    >
      <Icon size={18} aria-hidden /> {item.label}
    </NavLink>
  )
}

function BottomLink({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${isActive ? 'text-ink' : 'text-muted'}`
      }
    >
      <Icon size={20} aria-hidden />
      {item.label}
    </NavLink>
  )
}

export function AppShell() {
  const profile = useCurrentProfile()
  const items = NAV.filter((i) => !i.adminOnly || profile.role === 'admin')
  return (
    <ActiveBranchProvider>
      <div className="min-h-dvh md:grid md:grid-cols-[16rem_1fr]">
        <aside className="hidden border-r border-hairline bg-surface p-4 md:flex md:flex-col md:gap-1">
          <p className="label-caps mb-3 px-3 text-muted">Stock Peluquerías</p>
          {items.map((i) => (
            <SideLink key={i.to} item={i} />
          ))}
        </aside>
        <div className="flex min-h-dvh flex-col">
          <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-hairline bg-surface/95 px-4 py-3 backdrop-blur">
            <span className="font-bold md:hidden">Stock</span>
            <BranchPill />
            <div className="ml-auto flex items-center gap-3 text-sm">
              <span className="hidden sm:block">
                <span className="font-semibold">{profile.full_name}</span>{' '}
                <span className="text-muted">· {ROLE_LABEL[profile.role]}</span>
              </span>
              <button
                type="button"
                onClick={() => void signOut()}
                className="inline-flex items-center gap-1 rounded-control border border-hairline px-2 py-1 text-sm hover:bg-canvas"
              >
                <LogOut size={16} aria-hidden /> Salir
              </button>
            </div>
          </header>
          <OfflineBanner />
          <main className="mx-auto w-full max-w-7xl flex-1 p-4 pb-24 md:p-6 md:pb-6">
            <Outlet />
          </main>
          <nav
            aria-label="Navegación principal"
            className="fixed inset-x-0 bottom-0 z-10 flex border-t border-hairline bg-surface md:hidden"
          >
            {items.map((i) => (
              <BottomLink key={i.to} item={i} />
            ))}
          </nav>
        </div>
      </div>
    </ActiveBranchProvider>
  )
}
```

- [ ] **Paso 6: Páginas auxiliares, redirección de inicio y router**

`src/pages/PlaceholderPage.tsx`:

```tsx
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/States'

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState title="Disponible en la próxima versión" />
    </>
  )
}
```

`src/pages/ForbiddenPage.tsx`:

```tsx
import { Link } from 'react-router'
import { PageHeader } from '@/components/ui/PageHeader'

export function ForbiddenPage() {
  return (
    <>
      <PageHeader eyebrow="403" title="No tenés permiso para ver esta pantalla" />
      <Link to="/" className="text-sm underline">
        Ir al inicio
      </Link>
    </>
  )
}
```

`src/pages/NotFoundPage.tsx`:

```tsx
import { Link } from 'react-router'
import { PageHeader } from '@/components/ui/PageHeader'

export function NotFoundPage() {
  return (
    <>
      <PageHeader eyebrow="404" title="La página no existe" />
      <Link to="/" className="text-sm underline">
        Ir al inicio
      </Link>
    </>
  )
}
```

`src/features/home/HomeRedirect.tsx`:

```tsx
import { Navigate } from 'react-router'
import { useCurrentProfile } from '@/app/guards'

export function HomeRedirect() {
  const p = useCurrentProfile()
  return <Navigate to={p.role === 'admin' ? '/inicio' : '/inventario'} replace />
}
```

`src/app/router.tsx`:

```tsx
import { createBrowserRouter } from 'react-router'
import { RequireAuth, RequireProfile, RequireRole } from './guards'
import { AppShell } from './layout/AppShell'
import { LoginPage } from '@/features/auth/LoginPage'
import { RecuperarPage } from '@/features/auth/RecuperarPage'
import { RestablecerPage } from '@/features/auth/RestablecerPage'
import { SinPerfilPage } from '@/features/auth/SinPerfilPage'
import { HomeRedirect } from '@/features/home/HomeRedirect'
import { ForbiddenPage } from '@/pages/ForbiddenPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PlaceholderPage } from '@/pages/PlaceholderPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/auth/recuperar', element: <RecuperarPage /> },
  { path: '/auth/restablecer', element: <RestablecerPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/sin-perfil', element: <SinPerfilPage /> },
      {
        element: <RequireProfile />,
        children: [
          {
            element: <AppShell />,
            children: [
              { index: true, element: <HomeRedirect /> },
              { path: 'inventario', element: <PlaceholderPage title="Inventario" /> },
              { path: 'inventario/:productId', element: <PlaceholderPage title="Producto" /> },
              {
                element: <RequireRole role="admin" />,
                children: [
                  { path: 'inicio', element: <PlaceholderPage title="Inicio" /> },
                  { path: 'catalogo', element: <PlaceholderPage title="Catálogo" /> },
                  { path: 'catalogo/nuevo', element: <PlaceholderPage title="Nuevo producto" /> },
                  { path: 'catalogo/:productId', element: <PlaceholderPage title="Producto" /> },
                  { path: 'sucursales', element: <PlaceholderPage title="Sucursales" /> },
                  { path: 'usuarios', element: <PlaceholderPage title="Usuarios" /> },
                ],
              },
              { path: '403', element: <ForbiddenPage /> },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
])
```

`src/App.tsx` (reemplaza el provisorio):

```tsx
import { RouterProvider } from 'react-router/dom'
import { Providers } from './app/providers'
import { router } from './app/router'

export function App() {
  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  )
}
```

- [ ] **Paso 7: Verificar automático**

Run: `npm test`
Expected: PASS (incluye `authErrors.test.ts`).

Run: `npm run typecheck`
Expected: sin errores. Si `react-router/dom` no resuelve `RouterProvider`, importar `RouterProvider` desde `react-router`.

Run: `npm run build`
Expected: build OK.

- [ ] **Paso 8: Verificar manual en el navegador**

Run: `npm run dev` (dejar corriendo) y abrir `http://localhost:5173`.

1. Sin sesión, `/` redirige a `/login`.
2. Ingresar con `admin@pelu.com` → redirige a `/inicio` (placeholder). El rail muestra Inicio, Inventario, Catálogo, Sucursales, Usuarios. El pill muestra "Todas las sucursales" con selector.
3. Cambiar el selector a "Sucursal Centro", recargar: sigue en Centro.
4. "Salir" → `/login` sin aviso de sesión vencida.
5. Ingresar con `centro@pelu.com` → `/inventario`. Solo aparece Inventario. El pill muestra "Sucursal Centro" sin selector. Navegar a `/catalogo` → `/403`.
6. En DevTools → Network → Offline: aparece el banner y el botón "Ingresar" del login queda deshabilitado.
7. En ancho 360 px: bottom nav visible, header sin nombre completo.

Anotar cualquier desvío y corregirlo antes del commit.

- [ ] **Paso 9: Commit**

```bash
git add src tests/unit/authErrors.test.ts
git commit -m "feat: sesión, acceso, guardas por rol, router y shell con sucursal activa

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 11: Sucursales (lista, alta, edición, desactivación)

**Files:**
- Modify: `src/features/branches/api.ts` (agregar mutaciones), `src/app/router.tsx` (ruta `sucursales`)
- Create: `src/features/branches/schema.ts`, `BranchDialog.tsx`, `SucursalesPage.tsx`
- Test: `tests/unit/branchSchema.test.ts`

**Interfaces:**
- Consumes: `useBranches`, `branchKeys`, `Dialog`, `Input`, `Button`, `Chip`, `useToast`, `useOnline`, `messageFor`, `fieldErrors`.
- Produces: `branchSchema`, `useCreateBranch()`, `useUpdateBranch()` (mutaciones TanStack), `SucursalesPage`.

- [ ] **Paso 1: Test del schema**

`tests/unit/branchSchema.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { branchSchema } from '@/features/branches/schema'
import { fieldErrors } from '@/lib/validation'

describe('branchSchema', () => {
  it('acepta código y nombre válidos', () => {
    expect(branchSchema.safeParse({ code: 'CEN', name: ' Sucursal Centro ' }).success).toBe(true)
  })
  it('rechaza código en minúscula y nombre vacío', () => {
    const r = branchSchema.safeParse({ code: 'cen', name: '  ' })
    expect(r.success).toBe(false)
    if (!r.success) {
      const e = fieldErrors(r.error)
      expect(e.code).toBe('Entre 2 y 8 letras mayúsculas o números.')
      expect(e.name).toBe('El nombre es obligatorio.')
    }
  })
})
```

Run: `npm test -- tests/unit/branchSchema.test.ts` → Expected: FAIL.

- [ ] **Paso 2: `schema.ts` y mutaciones en `api.ts`**

`src/features/branches/schema.ts`:

```ts
import { z } from 'zod'

export const branchSchema = z.object({
  code: z.string().trim().regex(/^[A-Z0-9]{2,8}$/, 'Entre 2 y 8 letras mayúsculas o números.'),
  name: z.string().trim().min(1, 'El nombre es obligatorio.').max(120, 'Máximo 120 caracteres.'),
})

export type BranchInput = z.infer<typeof branchSchema>
```

Agregar al final de `src/features/branches/api.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useCreateBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { code: string; name: string }): Promise<Branch> => {
      const { data, error } = await supabase.rpc('create_branch', { p_code: input.code, p_name: input.name })
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: branchKeys.all }),
  })
}

export function useUpdateBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; name: string; is_active: boolean }): Promise<Branch> => {
      const { data, error } = await supabase.rpc('update_branch', {
        p_id: input.id,
        p_name: input.name,
        p_is_active: input.is_active,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: branchKeys.all }),
  })
}
```

(Mover el `import { useMutation, useQueryClient }` junto al `import { useQuery }` existente: `import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'`.)

Run: `npm test -- tests/unit/branchSchema.test.ts` → Expected: PASS.

- [ ] **Paso 3: `BranchDialog.tsx`**

```tsx
import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { useOnline } from '@/components/ui/OfflineBanner'
import { useToast } from '@/components/ui/Toast'
import { messageFor } from '@/lib/errors'
import { fieldErrors, type FieldErrors } from '@/lib/validation'
import type { Branch } from '@/types/models'
import { useCreateBranch, useUpdateBranch } from './api'
import { branchSchema } from './schema'

type Props = { open: boolean; onClose: () => void; branch: Branch | null }

/** Alta (branch = null) o edición de sucursal. El código no se edita. */
export function BranchDialog({ open, onClose, branch }: Props) {
  const online = useOnline()
  const toast = useToast()
  const create = useCreateBranch()
  const update = useUpdateBranch()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setCode(branch?.code ?? '')
    setName(branch?.name ?? '')
    setIsActive(branch?.is_active ?? true)
    setErrors({})
    setServerError(null)
  }, [open, branch])

  const pending = create.isPending || update.isPending

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setServerError(null)
    const parsed = branchSchema.safeParse({ code: branch ? branch.code : code.toUpperCase(), name })
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error))
      return
    }
    setErrors({})
    try {
      if (branch) {
        await update.mutateAsync({ id: branch.id, name: parsed.data.name, is_active: isActive })
        toast.push({ kind: 'success', text: 'Sucursal actualizada.' })
      } else {
        await create.mutateAsync(parsed.data)
        toast.push({ kind: 'success', text: 'Sucursal creada.' })
      }
      onClose()
    } catch (err) {
      setServerError(messageFor(err))
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={branch ? 'Editar sucursal' : 'Nueva sucursal'}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Input
          label="Código"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          disabled={Boolean(branch)}
          hint="Entre 2 y 8 letras mayúsculas o números. No se puede cambiar después."
          error={errors.code}
          maxLength={8}
        />
        <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} maxLength={120} />
        {branch && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Sucursal activa
          </label>
        )}
        {branch && branch.is_active && !isActive && (
          <p className="rounded-control bg-amber-bg p-3 text-xs text-amber-fg">
            Solo se puede desactivar sin saldo, sin transferencias abiertas y sin usuarios activos asignados.
          </p>
        )}
        {serverError && (
          <p role="alert" className="text-sm text-carmine-fg">
            {serverError}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending || !online}>
            {pending ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
```

- [ ] **Paso 4: `SucursalesPage.tsx`**

```tsx
import { useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { messageFor } from '@/lib/errors'
import type { Branch } from '@/types/models'
import { useBranches } from './api'
import { BranchDialog } from './BranchDialog'

export function SucursalesPage() {
  const branches = useBranches()
  const [dialog, setDialog] = useState<{ open: boolean; branch: Branch | null }>({ open: false, branch: null })

  const openNew = () => setDialog({ open: true, branch: null })
  const openEdit = (b: Branch) => setDialog({ open: true, branch: b })
  const close = () => setDialog((d) => ({ ...d, open: false }))

  return (
    <>
      <PageHeader
        eyebrow="Administración"
        title="Sucursales"
        description="Cada sucursal tiene su propio inventario."
        actions={
          <Button onClick={openNew}>
            <Plus size={16} aria-hidden /> Nueva sucursal
          </Button>
        }
      />
      {branches.isPending && <LoadingState />}
      {branches.isError && <ErrorState message={messageFor(branches.error)} onRetry={() => void branches.refetch()} />}
      {branches.data && branches.data.length === 0 && (
        <EmptyState title="Todavía no hay sucursales" action={<Button onClick={openNew}>Crear la primera</Button>} />
      )}
      {branches.data && branches.data.length > 0 && (
        <>
          <table className="hidden w-full border-collapse text-sm md:table">
            <thead>
              <tr className="label-caps text-left text-muted">
                <th className="py-2 pr-4">Código</th>
                <th className="py-2 pr-4">Nombre</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {branches.data.map((b) => (
                <tr key={b.id} className="border-t border-hairline hover:bg-canvas">
                  <td className="py-3 pr-4 font-semibold tnum">{b.code}</td>
                  <td className="py-3 pr-4">{b.name}</td>
                  <td className="py-3 pr-4">
                    <Chip tone={b.is_active ? 'sage' : 'neutral'}>{b.is_active ? 'Activa' : 'Inactiva'}</Chip>
                  </td>
                  <td className="py-3 text-right">
                    <Button variant="secondary" onClick={() => openEdit(b)} aria-label={`Editar ${b.name}`}>
                      <Pencil size={14} aria-hidden /> Editar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="flex flex-col gap-3 md:hidden">
            {branches.data.map((b) => (
              <li key={b.id} className="rounded-lg border border-hairline bg-surface p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="label-caps text-muted">{b.code}</p>
                    <p className="font-semibold">{b.name}</p>
                  </div>
                  <Chip tone={b.is_active ? 'sage' : 'neutral'}>{b.is_active ? 'Activa' : 'Inactiva'}</Chip>
                </div>
                <Button variant="secondary" className="mt-3 w-full" onClick={() => openEdit(b)}>
                  <Pencil size={14} aria-hidden /> Editar
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
      <BranchDialog open={dialog.open} onClose={close} branch={dialog.branch} />
    </>
  )
}
```

- [ ] **Paso 5: Enrutar**

En `src/app/router.tsx`, agregar `import { SucursalesPage } from '@/features/branches/SucursalesPage'` y reemplazar `{ path: 'sucursales', element: <PlaceholderPage title="Sucursales" /> }` por `{ path: 'sucursales', element: <SucursalesPage /> }`.

- [ ] **Paso 6: Verificar**

Run: `npm test && npm run typecheck`
Expected: PASS y sin errores.

Manual (`npm run dev`, como admin): en `/sucursales` se ven Centro y Pocitos. Crear `NOR` / "Sucursal Norte" → aparece en la lista y en el pill. Intentar crear `CEN` de nuevo → "Ya existe una sucursal con ese código." Editar Norte, desmarcar "activa" → guarda como Inactiva (no tiene usuarios ni saldo). Editar Centro y desactivar → "La sucursal tiene usuarios activos asignados." (el formulario conserva los datos).

- [ ] **Paso 7: Commit**

```bash
git add src/features/branches src/app/router.tsx tests/unit/branchSchema.test.ts
git commit -m "feat: gestión de sucursales con alta, edición y desactivación protegida

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: Usuarios (perfiles, rol, sucursal, estado)

**Files:**
- Create: `src/features/users/api.ts`, `schema.ts`, `ProfileDialog.tsx`, `UsuariosPage.tsx`
- Modify: `src/app/router.tsx` (ruta `usuarios`)
- Test: `tests/unit/profileSchema.test.ts`

**Interfaces:**
- Consumes: `useBranches`, UI primitives, `useCurrentProfile`.
- Produces: `profileSchema`, `useProfiles()`, `useCreateProfile()`, `useUpdateProfile()`, `UsuariosPage`.

- [ ] **Paso 1: Test del schema**

`tests/unit/profileSchema.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { profileSchema } from '@/features/users/schema'
import { fieldErrors } from '@/lib/validation'

describe('profileSchema', () => {
  it('normaliza email y acepta admin sin sucursal', () => {
    const r = profileSchema.safeParse({ email: ' Admin@Example.com ', full_name: 'Ana', role: 'admin', branch_id: '' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.email).toBe('admin@pelu.com')
      expect(r.data.branch_id).toBeNull()
    }
  })
  it('exige sucursal para operador', () => {
    const r = profileSchema.safeParse({ email: 'op@example.com', full_name: 'Op', role: 'operator', branch_id: '' })
    expect(r.success).toBe(false)
    if (!r.success) expect(fieldErrors(r.error).branch_id).toBe('Un operador necesita una sucursal.')
  })
  it('rechaza email inválido', () => {
    const r = profileSchema.safeParse({ email: 'no-es-email', full_name: 'X', role: 'admin', branch_id: '' })
    expect(r.success).toBe(false)
    if (!r.success) expect(fieldErrors(r.error).email).toBe('El email no es válido.')
  })
})
```

Run: `npm test -- tests/unit/profileSchema.test.ts` → Expected: FAIL.

- [ ] **Paso 2: `schema.ts` y `api.ts`**

`src/features/users/schema.ts`:

```ts
import { z } from 'zod'

export const profileSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email('El email no es válido.')),
    full_name: z.string().trim().min(1, 'El nombre es obligatorio.').max(120, 'Máximo 120 caracteres.'),
    role: z.enum(['admin', 'operator'], { message: 'Elegí un rol.' }),
    branch_id: z
      .string()
      .transform((v) => (v.trim() === '' ? null : v))
      .nullable(),
  })
  .transform((v) => ({ ...v, branch_id: v.role === 'admin' ? null : v.branch_id }))
  .refine((v) => v.role !== 'operator' || Boolean(v.branch_id), {
    message: 'Un operador necesita una sucursal.',
    path: ['branch_id'],
  })

export type ProfileInput = z.infer<typeof profileSchema>
```

`src/features/users/api.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Profile, UserRole } from '@/types/models'

export const profileKeys = { all: ['profiles'] as const }

export function useProfiles() {
  return useQuery({
    queryKey: profileKeys.all,
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase.from('profiles').select('*').order('full_name')
      if (error) throw error
      return data
    },
  })
}

export function useCreateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { email: string; full_name: string; role: UserRole; branch_id: string | null }) => {
      const { data, error } = await supabase.rpc('create_profile', {
        p_email: input.email,
        p_full_name: input.full_name,
        p_role: input.role,
        p_branch_id: input.branch_id ?? undefined,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: profileKeys.all }),
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      full_name: string
      role: UserRole
      branch_id: string | null
      is_active: boolean
    }) => {
      const { data, error } = await supabase.rpc('update_profile', {
        p_id: input.id,
        p_full_name: input.full_name,
        p_role: input.role,
        p_branch_id: input.branch_id ?? undefined,
        p_is_active: input.is_active,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: profileKeys.all })
      void qc.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}
```

Run: `npm test -- tests/unit/profileSchema.test.ts` → Expected: PASS.

- [ ] **Paso 3: `ProfileDialog.tsx`**

```tsx
import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { useOnline } from '@/components/ui/OfflineBanner'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toast'
import { useBranches } from '@/features/branches/api'
import { messageFor } from '@/lib/errors'
import { fieldErrors, type FieldErrors } from '@/lib/validation'
import type { Profile, UserRole } from '@/types/models'
import { useCreateProfile, useUpdateProfile } from './api'
import { profileSchema } from './schema'

type Props = { open: boolean; onClose: () => void; profile: Profile | null; isSelf: boolean }

export function ProfileDialog({ open, onClose, profile, isSelf }: Props) {
  const online = useOnline()
  const toast = useToast()
  const branches = useBranches()
  const create = useCreateProfile()
  const update = useUpdateProfile()
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<UserRole>('operator')
  const [branchId, setBranchId] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setEmail(profile?.email ?? '')
    setFullName(profile?.full_name ?? '')
    setRole(profile?.role ?? 'operator')
    setBranchId(profile?.branch_id ?? '')
    setIsActive(profile?.is_active ?? true)
    setErrors({})
    setServerError(null)
  }, [open, profile])

  const pending = create.isPending || update.isPending
  const activeBranches = (branches.data ?? []).filter((b) => b.is_active || b.id === profile?.branch_id)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setServerError(null)
    const parsed = profileSchema.safeParse({ email: profile ? profile.email : email, full_name: fullName, role, branch_id: branchId })
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error))
      return
    }
    setErrors({})
    try {
      if (profile) {
        await update.mutateAsync({ id: profile.id, full_name: parsed.data.full_name, role: parsed.data.role, branch_id: parsed.data.branch_id, is_active: isActive })
        toast.push({ kind: 'success', text: 'Usuario actualizado.' })
      } else {
        await create.mutateAsync(parsed.data)
        toast.push({ kind: 'success', text: 'Perfil creado. Falta crear la cuenta de acceso.' })
      }
      onClose()
    } catch (err) {
      setServerError(messageFor(err))
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={profile ? 'Editar usuario' : 'Nuevo usuario'}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={Boolean(profile)} error={errors.email} />
        <Input label="Nombre completo" value={fullName} onChange={(e) => setFullName(e.target.value)} error={errors.full_name} maxLength={120} />
        <Select
          label="Rol"
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          options={[
            { value: 'operator', label: 'Operador de sucursal' },
            { value: 'admin', label: 'Administrador de cadena' },
          ]}
          disabled={isSelf}
          error={errors.role}
        />
        {role === 'operator' && (
          <Select
            label="Sucursal"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            placeholder="Elegí una sucursal"
            options={activeBranches.map((b) => ({ value: b.id, label: `${b.code} · ${b.name}` }))}
            error={errors.branch_id}
          />
        )}
        {profile && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} disabled={isSelf} />
            Usuario activo
          </label>
        )}
        {!profile && (
          <p className="rounded-control bg-indigo-bg p-3 text-xs text-indigo-fg">
            Después de guardar, creá la cuenta de acceso con este mismo email desde Supabase → Authentication → Add user (ver docs/operacion.md). La cuenta se vincula sola.
          </p>
        )}
        {serverError && (
          <p role="alert" className="text-sm text-carmine-fg">
            {serverError}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending || !online}>
            {pending ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
```

- [ ] **Paso 4: `UsuariosPage.tsx`**

```tsx
import { useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { useCurrentProfile } from '@/app/guards'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { useBranches } from '@/features/branches/api'
import { messageFor } from '@/lib/errors'
import { ROLE_LABEL, type Profile } from '@/types/models'
import { useProfiles } from './api'
import { ProfileDialog } from './ProfileDialog'

export function UsuariosPage() {
  const me = useCurrentProfile()
  const profiles = useProfiles()
  const branches = useBranches()
  const [dialog, setDialog] = useState<{ open: boolean; profile: Profile | null }>({ open: false, profile: null })
  const branchName = (id: string | null) => branches.data?.find((b) => b.id === id)?.name ?? '—'

  const openNew = () => setDialog({ open: true, profile: null })
  const openEdit = (p: Profile) => setDialog({ open: true, profile: p })
  const close = () => setDialog((d) => ({ ...d, open: false }))

  function StatusChips({ p }: { p: Profile }) {
    return (
      <span className="flex flex-wrap gap-1">
        <Chip tone={p.is_active ? 'sage' : 'neutral'}>{p.is_active ? 'Activo' : 'Inactivo'}</Chip>
        {!p.auth_user_id && <Chip tone="amber">Sin cuenta</Chip>}
      </span>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Administración"
        title="Usuarios"
        description='"Sin cuenta" significa que falta crear el acceso en Supabase con ese email.'
        actions={
          <Button onClick={openNew}>
            <Plus size={16} aria-hidden /> Nuevo usuario
          </Button>
        }
      />
      {profiles.isPending && <LoadingState />}
      {profiles.isError && <ErrorState message={messageFor(profiles.error)} onRetry={() => void profiles.refetch()} />}
      {profiles.data && profiles.data.length === 0 && <EmptyState title="No hay usuarios" />}
      {profiles.data && profiles.data.length > 0 && (
        <>
          <table className="hidden w-full border-collapse text-sm md:table">
            <thead>
              <tr className="label-caps text-left text-muted">
                <th className="py-2 pr-4">Nombre</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Rol</th>
                <th className="py-2 pr-4">Sucursal</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {profiles.data.map((p) => (
                <tr key={p.id} className="border-t border-hairline hover:bg-canvas">
                  <td className="py-3 pr-4 font-semibold">
                    {p.full_name}
                    {p.id === me.id && <span className="ml-2 text-xs text-muted">(vos)</span>}
                  </td>
                  <td className="py-3 pr-4">{p.email}</td>
                  <td className="py-3 pr-4">{ROLE_LABEL[p.role]}</td>
                  <td className="py-3 pr-4">{p.role === 'operator' ? branchName(p.branch_id) : 'Toda la cadena'}</td>
                  <td className="py-3 pr-4">
                    <StatusChips p={p} />
                  </td>
                  <td className="py-3 text-right">
                    <Button variant="secondary" onClick={() => openEdit(p)} aria-label={`Editar ${p.full_name}`}>
                      <Pencil size={14} aria-hidden /> Editar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="flex flex-col gap-3 md:hidden">
            {profiles.data.map((p) => (
              <li key={p.id} className="rounded-lg border border-hairline bg-surface p-4">
                <p className="font-semibold">{p.full_name}</p>
                <p className="text-sm text-muted">{p.email}</p>
                <p className="mt-1 text-sm">
                  {ROLE_LABEL[p.role]} · {p.role === 'operator' ? branchName(p.branch_id) : 'Toda la cadena'}
                </p>
                <div className="mt-2">
                  <StatusChips p={p} />
                </div>
                <Button variant="secondary" className="mt-3 w-full" onClick={() => openEdit(p)}>
                  <Pencil size={14} aria-hidden /> Editar
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
      <ProfileDialog open={dialog.open} onClose={close} profile={dialog.profile} isSelf={dialog.profile?.id === me.id} />
    </>
  )
}
```

- [ ] **Paso 5: Enrutar**

En `src/app/router.tsx`, importar `UsuariosPage` desde `@/features/users/UsuariosPage` y reemplazar el placeholder de `usuarios`.

- [ ] **Paso 6: Verificar**

Run: `npm test && npm run typecheck`
Expected: PASS y sin errores.

Manual (como admin): `/usuarios` lista los tres perfiles demo, todos "Activo" y sin chip "Sin cuenta". Crear `norte@example.com` operador de Sucursal Norte (inactiva) → el selector no la ofrece; elegir Centro → se crea con chip "Sin cuenta". Editar a Valeria (vos): rol y "activo" deshabilitados. Editar a Sofía, desmarcar activo, guardar → "Inactivo". En otra ventana privada, ingresar como Sofía → pantalla "Cuenta sin perfil". Reactivarla.

- [ ] **Paso 7: Commit**

```bash
git add src/features/users src/app/router.tsx tests/unit/profileSchema.test.ts
git commit -m "feat: gestión de usuarios con rol, sucursal y estado

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 13: Catálogo (lista, formulario, disponibilidad por sucursal y mínimos)

**Files:**
- Create: `src/features/products/api.ts`, `schema.ts`, `CatalogoPage.tsx`, `ProductoFormPage.tsx`, `AvailabilitySection.tsx`
- Modify: `src/app/router.tsx` (rutas `catalogo`, `catalogo/nuevo`, `catalogo/:productId`)
- Test: `tests/unit/productSchema.test.ts`

**Interfaces:**
- Consumes: `useBranches`, `parseQuantity`, `formatQuantity`, `UNIT_NAME`, `UNIT_LABEL`, UI primitives.
- Produces: `productSchema`, `productKeys`, `useProducts({ search, includeInactive })`, `useProduct(id)`, `useProductAvailability(productId)` → `InventoryStatus[]`, `useUpsertProduct()`, `useEnableProduct()`, `useSetMinQty()`, `ProductInput`.
- Convención de claves de query: todo lo que lee `inventory`/`inventory_status` usa una clave que empieza con `'inventory'`, así `invalidateQueries({ queryKey: ['inventory'] })` refresca listas, disponibilidad y detalle a la vez.

- [ ] **Paso 1: Test del schema**

`tests/unit/productSchema.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { productSchema } from '@/features/products/schema'
import { fieldErrors } from '@/lib/validation'

const base = {
  sku: 'SH-PRO-1', name: 'Shampoo', unit: 'ml', brand: '', category: 'Profesional', variant: '',
  presentation: 'Envase 1.000 ml', presentation_qty: 1000, max_movement_qty: 100000, is_active: true,
}

describe('productSchema', () => {
  it('acepta un producto válido y normaliza vacíos a null', () => {
    const r = productSchema.safeParse(base)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.brand).toBeNull()
      expect(r.data.variant).toBeNull()
      expect(r.data.category).toBe('Profesional')
    }
  })
  it('rechaza SKU con espacios, nombre vacío y contenido por envase no positivo', () => {
    const r = productSchema.safeParse({ ...base, sku: 'con espacio', name: ' ', presentation_qty: 0 })
    expect(r.success).toBe(false)
    if (!r.success) {
      const e = fieldErrors(r.error)
      expect(e.sku).toBeTruthy()
      expect(e.name).toBe('El nombre es obligatorio.')
      expect(e.presentation_qty).toBe('Debe ser mayor que cero.')
    }
  })
  it('permite presentation_qty nulo', () => {
    expect(productSchema.safeParse({ ...base, presentation: '', presentation_qty: null }).success).toBe(true)
  })
})
```

Run: `npm test -- tests/unit/productSchema.test.ts` → Expected: FAIL.

- [ ] **Paso 2: `schema.ts` y `api.ts`**

`src/features/products/schema.ts`:

```ts
import { z } from 'zod'

const optionalText = (max: number) =>
  z.string().trim().max(max, `Máximo ${max} caracteres.`).transform((v) => (v === '' ? null : v))

export const productSchema = z.object({
  sku: z.string().trim().regex(/^[A-Za-z0-9._-]{1,40}$/, 'Letras, números, punto, guion o guion bajo (máximo 40).'),
  name: z.string().trim().min(1, 'El nombre es obligatorio.').max(160, 'Máximo 160 caracteres.'),
  unit: z.enum(['unit', 'ml', 'g'], { message: 'Elegí una unidad.' }),
  brand: optionalText(80),
  category: optionalText(80),
  variant: optionalText(80),
  presentation: optionalText(80),
  presentation_qty: z.number().positive('Debe ser mayor que cero.').nullable(),
  max_movement_qty: z.number().positive('Debe ser mayor que cero.'),
  is_active: z.boolean(),
})

export type ProductInput = z.infer<typeof productSchema>
```

`src/features/products/api.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { InventoryStatus, Product } from '@/types/models'
import type { ProductInput } from './schema'

export type ProductFilters = { search: string; includeInactive: boolean }

export const productKeys = {
  all: ['products'] as const,
  list: (f: ProductFilters) => ['products', 'list', f] as const,
  detail: (id: string) => ['products', 'detail', id] as const,
  availability: (id: string) => ['inventory', 'product', id] as const,
}

/** Quita caracteres que rompen el filtro `or` de PostgREST. */
export function sanitizeSearch(q: string): string {
  return q.replace(/[,()%.]/g, ' ').trim()
}

export function useProducts(filters: ProductFilters) {
  return useQuery({
    queryKey: productKeys.list(filters),
    queryFn: async (): Promise<Product[]> => {
      let q = supabase.from('products').select('*').order('name').limit(500)
      if (!filters.includeInactive) q = q.eq('is_active', true)
      const s = sanitizeSearch(filters.search)
      if (s) q = q.or(`sku.ilike.%${s}%,name.ilike.%${s}%`)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: productKeys.detail(id ?? ''),
    enabled: Boolean(id),
    queryFn: async (): Promise<Product | null> => {
      const { data, error } = await supabase.from('products').select('*').eq('id', id!).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

/** Filas de inventory_status del producto (una por sucursal habilitada, según RLS). */
export function useProductAvailability(productId: string | undefined) {
  return useQuery({
    queryKey: productKeys.availability(productId ?? ''),
    enabled: Boolean(productId),
    queryFn: async (): Promise<InventoryStatus[]> => {
      const { data, error } = await supabase
        .from('inventory_status')
        .select('*')
        .eq('product_id', productId!)
        .order('branch_name')
      if (error) throw error
      return data
    },
  })
}

export function useUpsertProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: ProductInput & { id?: string }): Promise<Product> => {
      const { data, error } = await supabase.rpc('upsert_product', {
        p_id: input.id,
        p_sku: input.sku,
        p_name: input.name,
        p_unit: input.unit,
        p_brand: input.brand ?? undefined,
        p_category: input.category ?? undefined,
        p_variant: input.variant ?? undefined,
        p_presentation: input.presentation ?? undefined,
        p_presentation_qty: input.presentation_qty ?? undefined,
        p_max_movement_qty: input.max_movement_qty,
        p_is_active: input.is_active,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: productKeys.all })
      void qc.invalidateQueries({ queryKey: ['inventory'] })
    },
  })
}

export function useEnableProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { productId: string; branchId: string; minQty: number }) => {
      const { data, error } = await supabase.rpc('enable_product_in_branch', {
        p_product_id: input.productId,
        p_branch_id: input.branchId,
        p_min_qty: input.minQty,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['inventory'] }),
  })
}

export function useSetMinQty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { productId: string; branchId: string; minQty: number }) => {
      const { data, error } = await supabase.rpc('set_min_qty', {
        p_branch_id: input.branchId,
        p_product_id: input.productId,
        p_min_qty: input.minQty,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['inventory'] }),
  })
}
```

Run: `npm test -- tests/unit/productSchema.test.ts` → Expected: PASS.

- [ ] **Paso 3: `AvailabilitySection.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Input } from '@/components/ui/Input'
import { useOnline } from '@/components/ui/OfflineBanner'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useBranches } from '@/features/branches/api'
import { messageFor } from '@/lib/errors'
import { formatNumber, formatQuantity, parseQuantity, UNIT_LABEL } from '@/lib/quantity'
import type { Branch, InventoryStatus, UnitKind } from '@/types/models'
import { useEnableProduct, useProductAvailability, useSetMinQty } from './api'

type RowProps = { productId: string; unit: UnitKind; branch: Branch; row: InventoryStatus | undefined }

function AvailabilityRow({ productId, unit, branch, row }: RowProps) {
  const online = useOnline()
  const toast = useToast()
  const enable = useEnableProduct()
  const setMin = useSetMinQty()
  const [minStr, setMinStr] = useState(() => (row ? formatNumber(Number(row.min_qty ?? 0), unit) : '0'))
  const [error, setError] = useState<string | null>(null)
  const pending = enable.isPending || setMin.isPending

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const parsed = parseQuantity(minStr, unit)
    if (!parsed.ok) return setError(parsed.error)
    try {
      if (row) {
        await setMin.mutateAsync({ productId, branchId: branch.id, minQty: parsed.value })
        toast.push({ kind: 'success', text: `Mínimo actualizado en ${branch.name}.` })
      } else {
        await enable.mutateAsync({ productId, branchId: branch.id, minQty: parsed.value })
        toast.push({ kind: 'success', text: `Producto habilitado en ${branch.name}.` })
      }
    } catch (err) {
      setError(messageFor(err))
    }
  }

  const status = !row
    ? null
    : !row.initialized_at
      ? <Chip tone="amber">Sin saldo inicial</Chip>
      : row.below_min
        ? <Chip tone="amber">Bajo mínimo</Chip>
        : <Chip tone="sage">OK</Chip>

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <p className="label-caps text-muted">{branch.code}</p>
        <p className="font-semibold">{branch.name}</p>
        <p className="mt-1 text-sm tnum">
          Saldo: {row ? formatQuantity(Number(row.balance ?? 0), unit) : '—'}
        </p>
        <div className="mt-1 flex items-center gap-2">
          {status}
          {row && (
            <Link to={`/inventario/${productId}`} className="text-xs underline">
              Ver en inventario
            </Link>
          )}
        </div>
      </div>
      <form onSubmit={onSubmit} className="flex items-end gap-2" noValidate>
        <Input
          label={`Mínimo (${UNIT_LABEL[unit]})`}
          value={minStr}
          onChange={(e) => setMinStr(e.target.value)}
          inputMode="decimal"
          className="w-32 tnum"
          error={error ?? undefined}
        />
        <Button type="submit" variant={row ? 'secondary' : 'primary'} disabled={pending || !online}>
          {pending ? 'Guardando…' : row ? 'Guardar mínimo' : 'Habilitar'}
        </Button>
      </form>
    </li>
  )
}

export function AvailabilitySection({ productId, unit }: { productId: string; unit: UnitKind }) {
  const branches = useBranches()
  const availability = useProductAvailability(productId)
  if (branches.isPending || availability.isPending) return <LoadingState label="Cargando disponibilidad…" />
  if (branches.isError) return <ErrorState message={messageFor(branches.error)} onRetry={() => void branches.refetch()} />
  if (availability.isError) return <ErrorState message={messageFor(availability.error)} onRetry={() => void availability.refetch()} />
  const rows = availability.data ?? []
  const visible = (branches.data ?? []).filter((b) => b.is_active || rows.some((r) => r.branch_id === b.id))
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">Disponibilidad por sucursal</h2>
      <p className="mb-3 text-sm text-muted">
        Habilitar crea el inventario con saldo 0. El saldo inicial se registra desde la ficha en Inventario.
      </p>
      <ul className="flex flex-col gap-3">
        {visible.map((b) => (
          <AvailabilityRow key={b.id} productId={productId} unit={unit} branch={b} row={rows.find((r) => r.branch_id === b.id)} />
        ))}
      </ul>
    </section>
  )
}
```

- [ ] **Paso 4: `ProductoFormPage.tsx`**

```tsx
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useOnline } from '@/components/ui/OfflineBanner'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { messageFor } from '@/lib/errors'
import { formatNumber, parseQuantity, UNIT_LABEL, UNIT_NAME } from '@/lib/quantity'
import { fieldErrors, type FieldErrors } from '@/lib/validation'
import type { UnitKind } from '@/types/models'
import { useProduct, useProductAvailability, useUpsertProduct } from './api'
import { AvailabilitySection } from './AvailabilitySection'
import { productSchema } from './schema'

const UNIT_OPTIONS = (['unit', 'ml', 'g'] as UnitKind[]).map((u) => ({ value: u, label: `${UNIT_NAME[u]} (${UNIT_LABEL[u]})` }))

export function ProductoFormPage() {
  const { productId } = useParams<{ productId: string }>()
  const isEdit = Boolean(productId)
  const navigate = useNavigate()
  const online = useOnline()
  const toast = useToast()
  const product = useProduct(productId)
  const availability = useProductAvailability(productId)
  const upsert = useUpsertProduct()

  const [sku, setSku] = useState('')
  const [name, setName] = useState('')
  const [unit, setUnit] = useState<UnitKind>('ml')
  const [brand, setBrand] = useState('')
  const [category, setCategory] = useState('')
  const [variant, setVariant] = useState('')
  const [presentation, setPresentation] = useState('')
  const [presentationQty, setPresentationQty] = useState('')
  const [maxQty, setMaxQty] = useState('100000')
  const [isActive, setIsActive] = useState(true)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    const p = product.data
    if (!p) return
    setSku(p.sku)
    setName(p.name)
    setUnit(p.unit)
    setBrand(p.brand ?? '')
    setCategory(p.category ?? '')
    setVariant(p.variant ?? '')
    setPresentation(p.presentation ?? '')
    setPresentationQty(p.presentation_qty == null ? '' : formatNumber(Number(p.presentation_qty), p.unit))
    setMaxQty(formatNumber(Number(p.max_movement_qty), p.unit))
    setIsActive(p.is_active)
  }, [product.data])

  const unitLocked = (availability.data ?? []).some((r) => r.initialized_at != null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setServerError(null)
    const next: FieldErrors = {}
    let presentationQtyNum: number | null = null
    if (presentationQty.trim() !== '') {
      const r = parseQuantity(presentationQty, unit)
      if (!r.ok) next.presentation_qty = r.error
      else presentationQtyNum = r.value
    }
    let maxNum = 0
    const m = parseQuantity(maxQty, unit)
    if (!m.ok) next.max_movement_qty = m.error
    else maxNum = m.value
    const parsed = productSchema.safeParse({
      sku, name, unit, brand, category, variant, presentation,
      presentation_qty: presentationQtyNum, max_movement_qty: maxNum, is_active: isActive,
    })
    if (!parsed.success) Object.assign(next, { ...fieldErrors(parsed.error), ...next })
    if (!parsed.success || Object.keys(next).length > 0) {
      setErrors(next)
      return
    }
    setErrors({})
    try {
      const saved = await upsert.mutateAsync({ ...parsed.data, id: productId })
      toast.push({ kind: 'success', text: isEdit ? 'Producto actualizado.' : 'Producto creado. Ahora habilitalo en las sucursales.' })
      if (!isEdit) navigate(`/catalogo/${saved.id}`, { replace: true })
    } catch (err) {
      setServerError(messageFor(err))
    }
  }

  if (isEdit && product.isPending) return <LoadingState />
  if (isEdit && product.isError) return <ErrorState message={messageFor(product.error)} onRetry={() => void product.refetch()} />
  if (isEdit && product.data === null) return <ErrorState message="El producto no existe o no pertenece a tu cadena." />

  return (
    <>
      <PageHeader
        eyebrow="Catálogo"
        title={isEdit ? (product.data?.name ?? 'Producto') : 'Nuevo producto'}
        actions={
          <Link to="/catalogo" className="text-sm underline">
            Volver al catálogo
          </Link>
        }
      />
      <form onSubmit={onSubmit} className="grid max-w-3xl gap-4 md:grid-cols-2" noValidate>
        <Input label="SKU" value={sku} onChange={(e) => setSku(e.target.value)} error={errors.sku} hint="Único por cadena." maxLength={40} />
        <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} maxLength={160} />
        <Select
          label="Unidad base"
          value={unit}
          onChange={(e) => setUnit(e.target.value as UnitKind)}
          options={UNIT_OPTIONS}
          disabled={unitLocked}
          error={errors.unit}
        />
        {unitLocked && (
          <p className="text-xs text-muted md:col-start-2">La unidad no se puede cambiar: el producto ya tiene saldo registrado.</p>
        )}
        <Input label="Marca" value={brand} onChange={(e) => setBrand(e.target.value)} error={errors.brand} maxLength={80} />
        <Input label="Categoría" value={category} onChange={(e) => setCategory(e.target.value)} error={errors.category} maxLength={80} />
        <Input label="Variante / tono" value={variant} onChange={(e) => setVariant(e.target.value)} error={errors.variant} maxLength={80} />
        <Input label="Presentación" value={presentation} onChange={(e) => setPresentation(e.target.value)} error={errors.presentation} hint='Ejemplo: "Envase 1.000 ml"' maxLength={80} />
        <Input
          label={`Contenido por envase (${UNIT_LABEL[unit]})`}
          value={presentationQty}
          onChange={(e) => setPresentationQty(e.target.value)}
          inputMode="decimal"
          className="tnum"
          hint="Opcional. Permite cargar por envases con conversión visible."
          error={errors.presentation_qty}
        />
        <Input
          label={`Máximo por movimiento (${UNIT_LABEL[unit]})`}
          value={maxQty}
          onChange={(e) => setMaxQty(e.target.value)}
          inputMode="decimal"
          className="tnum"
          error={errors.max_movement_qty}
        />
        {isEdit && (
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Producto activo
          </label>
        )}
        {serverError && (
          <p role="alert" className="text-sm text-carmine-fg md:col-span-2">
            {serverError}
          </p>
        )}
        <div className="flex justify-end gap-2 md:col-span-2">
          <Button type="submit" disabled={upsert.isPending || !online}>
            {upsert.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </form>
      {isEdit && productId && product.data && <AvailabilitySection productId={productId} unit={product.data.unit} />}
    </>
  )
}
```

- [ ] **Paso 5: `CatalogoPage.tsx`**

```tsx
import { useState } from 'react'
import { Link } from 'react-router'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { messageFor } from '@/lib/errors'
import { UNIT_LABEL } from '@/lib/quantity'
import { useProducts } from './api'

export function CatalogoPage() {
  const [search, setSearch] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const products = useProducts({ search, includeInactive })

  return (
    <>
      <PageHeader
        eyebrow="Catálogo"
        title="Productos"
        description="Catálogo compartido por toda la cadena."
        actions={
          <Link to="/catalogo/nuevo">
            <Button>
              <Plus size={16} aria-hidden /> Nuevo producto
            </Button>
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div className="relative w-full max-w-sm">
          <Input label="Buscar" placeholder="Nombre o SKU" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          <Search size={16} className="pointer-events-none absolute bottom-3 left-3 text-muted" aria-hidden />
        </div>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
          Mostrar inactivos
        </label>
      </div>
      {products.isPending && <LoadingState />}
      {products.isError && <ErrorState message={messageFor(products.error)} onRetry={() => void products.refetch()} />}
      {products.data && products.data.length === 0 && (
        <EmptyState title={search ? 'Sin resultados' : 'Todavía no hay productos'} description={search ? 'Probá con otro nombre o SKU.' : undefined} />
      )}
      {products.data && products.data.length > 0 && (
        <>
          <table className="hidden w-full border-collapse text-sm md:table">
            <thead>
              <tr className="label-caps text-left text-muted">
                <th className="py-2 pr-4">SKU</th>
                <th className="py-2 pr-4">Producto</th>
                <th className="py-2 pr-4">Marca / categoría</th>
                <th className="py-2 pr-4">Unidad</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.data.map((p) => (
                <tr key={p.id} className="border-t border-hairline hover:bg-canvas">
                  <td className="py-3 pr-4 font-semibold tnum">{p.sku}</td>
                  <td className="py-3 pr-4">
                    {p.name}
                    {p.variant && <span className="text-muted"> · {p.variant}</span>}
                  </td>
                  <td className="py-3 pr-4 text-muted">{[p.brand, p.category].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="py-3 pr-4">{UNIT_LABEL[p.unit]}</td>
                  <td className="py-3 pr-4">
                    <Chip tone={p.is_active ? 'sage' : 'neutral'}>{p.is_active ? 'Activo' : 'Inactivo'}</Chip>
                  </td>
                  <td className="py-3 text-right">
                    <Link to={`/catalogo/${p.id}`} className="text-sm underline">
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="flex flex-col gap-3 md:hidden">
            {products.data.map((p) => (
              <li key={p.id} className="rounded-lg border border-hairline bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="label-caps text-muted tnum">{p.sku}</p>
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-sm text-muted">{[p.brand, p.category].filter(Boolean).join(' · ') || '—'} · {UNIT_LABEL[p.unit]}</p>
                  </div>
                  <Chip tone={p.is_active ? 'sage' : 'neutral'}>{p.is_active ? 'Activo' : 'Inactivo'}</Chip>
                </div>
                <Link to={`/catalogo/${p.id}`} className="mt-3 inline-block text-sm underline">
                  Editar
                </Link>
              </li>
            ))}
          </ul>
          {products.data.length === 500 && <p className="mt-3 text-xs text-muted">Se muestran los primeros 500. Refiná la búsqueda.</p>}
        </>
      )}
    </>
  )
}
```

- [ ] **Paso 6: Enrutar**

En `src/app/router.tsx`, importar `CatalogoPage` y `ProductoFormPage` desde `@/features/products/...` y reemplazar los placeholders de `catalogo`, `catalogo/nuevo` y `catalogo/:productId` por `<CatalogoPage />`, `<ProductoFormPage />` y `<ProductoFormPage />`.

- [ ] **Paso 7: Verificar**

Run: `npm test && npm run typecheck`
Expected: PASS y sin errores.

Manual (como admin): `/catalogo` vacío (el seed completo llega en la Tarea 16). Crear `SH-PRO-NEUTRO` "Shampoo profesional neutro 1 L", unidad ml, contenido por envase `1.000` → redirige a la ficha con la sección de disponibilidad. Habilitar en Centro con mínimo `1.980` → chip "Sin saldo inicial". Cambiar mínimo a `abc` → error inline. Crear `VT-SH-250` unidad; intentar contenido por envase `1,5` → "Los productos por unidad solo admiten cantidades enteras." Volver a SH-PRO-NEUTRO e intentar cambiar unidad: el selector sigue habilitado (todavía sin saldo inicial); se bloquea recién tras la Tarea 14.

- [ ] **Paso 8: Commit**

```bash
git add src/features/products src/app/router.tsx tests/unit/productSchema.test.ts
git commit -m "feat: catálogo con formulario, habilitación por sucursal y mínimos

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 14: Inventario (lista por sucursal, comparación, detalle y saldo inicial)

**Files:**
- Create: `src/features/inventory/api.ts`, `group.ts`, `StatusChip.tsx`, `InventarioPage.tsx`, `ProductoDetallePage.tsx`, `SaldoInicialDialog.tsx`
- Modify: `src/app/router.tsx` (rutas `inventario`, `inventario/:productId`)
- Test: `tests/unit/inventoryGroup.test.ts`

**Interfaces:**
- Consumes: `useActiveBranch`, `useBranches`, `useProduct`, `useProductAvailability`, `sanitizeSearch`, `parseQuantity`, `formatQuantity`, `packagesToBase`, UI primitives.
- Produces: `useInventory(filters)` → `{ rows: InventoryStatus[]; count: number }`, `PAGE_SIZE = 50`, `useSetInitialBalance()`, `groupByProduct(rows)`, `StatusChip({ row })`, páginas.

- [ ] **Paso 1: Test de agrupación para el modo comparar**

`tests/unit/inventoryGroup.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { groupByProduct } from '@/features/inventory/group'
import type { InventoryStatus } from '@/types/models'

function row(p: Partial<InventoryStatus>): InventoryStatus {
  return {
    id: 'i', chain_id: 'c', branch_id: 'b', product_id: 'p', balance: 0, min_qty: 0, version: 1,
    initialized_at: null, updated_at: null, below_min: true, sku: 'S', product_name: 'N', unit: 'ml',
    product_active: true, brand: null, category: null, branch_code: 'B', branch_name: 'B', branch_active: true,
    ...p,
  } as InventoryStatus
}

describe('groupByProduct', () => {
  it('agrupa filas por producto y las indexa por sucursal, ordenadas por nombre', () => {
    const rows = [
      row({ product_id: 'p2', product_name: 'Zeta', branch_id: 'b1', balance: 5 }),
      row({ product_id: 'p1', product_name: 'Alfa', branch_id: 'b1', balance: 1 }),
      row({ product_id: 'p1', product_name: 'Alfa', branch_id: 'b2', balance: 2 }),
    ]
    const g = groupByProduct(rows)
    expect(g.map((x) => x.productId)).toEqual(['p1', 'p2'])
    expect(g[0]!.byBranch.b1?.balance).toBe(1)
    expect(g[0]!.byBranch.b2?.balance).toBe(2)
    expect(g[1]!.byBranch.b2).toBeUndefined()
  })
})
```

Run: `npm test -- tests/unit/inventoryGroup.test.ts` → Expected: FAIL.

- [ ] **Paso 2: `group.ts`, `api.ts`, `StatusChip.tsx`**

`src/features/inventory/group.ts`:

```ts
import type { InventoryStatus, UnitKind } from '@/types/models'

export type ProductGroup = {
  productId: string
  sku: string
  name: string
  unit: UnitKind
  byBranch: Record<string, InventoryStatus>
}

/** Una fila por producto con sus saldos por sucursal (para "Comparar locales"). */
export function groupByProduct(rows: InventoryStatus[]): ProductGroup[] {
  const map = new Map<string, ProductGroup>()
  for (const r of rows) {
    const id = r.product_id ?? ''
    let g = map.get(id)
    if (!g) {
      g = { productId: id, sku: r.sku ?? '', name: r.product_name ?? '', unit: (r.unit ?? 'unit') as UnitKind, byBranch: {} }
      map.set(id, g)
    }
    if (r.branch_id) g.byBranch[r.branch_id] = r
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
}
```

`src/features/inventory/api.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sanitizeSearch } from '@/features/products/api'
import { supabase } from '@/lib/supabase'
import type { InventoryStatus } from '@/types/models'

export const PAGE_SIZE = 50
export const COMPARE_LIMIT = 500

export type InventoryFilters = {
  branchId: string | 'all'
  search: string
  onlyBelowMin: boolean
  page: number
}

export const inventoryKeys = {
  list: (f: InventoryFilters) => ['inventory', 'list', f] as const,
}

export function useInventory(filters: InventoryFilters) {
  return useQuery({
    queryKey: inventoryKeys.list(filters),
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<{ rows: InventoryStatus[]; count: number }> => {
      let q = supabase
        .from('inventory_status')
        .select('*', { count: 'exact' })
        .eq('product_active', true)
        .order('product_name')
        .order('branch_code')
      if (filters.branchId !== 'all') q = q.eq('branch_id', filters.branchId)
      if (filters.onlyBelowMin) q = q.eq('below_min', true)
      const s = sanitizeSearch(filters.search)
      if (s) q = q.or(`sku.ilike.%${s}%,product_name.ilike.%${s}%`)
      q =
        filters.branchId === 'all'
          ? q.limit(COMPARE_LIMIT)
          : q.range(filters.page * PAGE_SIZE, (filters.page + 1) * PAGE_SIZE - 1)
      const { data, count, error } = await q
      if (error) throw error
      return { rows: data, count: count ?? 0 }
    },
  })
}

export type InitialBalanceResult = {
  operation_id: string
  movement_id: string | null
  balance: number
  branch_id: string
  product_id: string
}

export function useSetInitialBalance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      key: string
      branchId: string
      productId: string
      qty: number
      reference: string | null
    }): Promise<InitialBalanceResult> => {
      const { data, error } = await supabase.rpc('set_initial_balance', {
        p_key: input.key,
        p_branch_id: input.branchId,
        p_product_id: input.productId,
        p_qty: input.qty,
        p_reference: input.reference ?? undefined,
      })
      if (error) throw error
      return data as unknown as InitialBalanceResult
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['inventory'] }),
  })
}
```

`src/features/inventory/StatusChip.tsx`:

```tsx
import { Chip } from '@/components/ui/Chip'
import type { InventoryStatus } from '@/types/models'

export function StatusChip({ row }: { row: InventoryStatus }) {
  if (!row.initialized_at) return <Chip tone="amber">Sin saldo inicial</Chip>
  if (row.below_min) return <Chip tone="amber">Bajo mínimo</Chip>
  return <Chip tone="sage">OK</Chip>
}
```

Run: `npm test -- tests/unit/inventoryGroup.test.ts` → Expected: PASS.

- [ ] **Paso 3: `SaldoInicialDialog.tsx`**

```tsx
import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { useOnline } from '@/components/ui/OfflineBanner'
import { useToast } from '@/components/ui/Toast'
import { messageFor } from '@/lib/errors'
import { formatNumber, formatQuantity, packagesToBase, parseQuantity, UNIT_LABEL } from '@/lib/quantity'
import type { InventoryStatus, Product } from '@/types/models'
import { useSetInitialBalance } from './api'

type Props = { open: boolean; onClose: () => void; product: Product; row: InventoryStatus }

/**
 * Registra el saldo inicial de un producto en una sucursal. La clave de idempotencia
 * se genera al abrir y se conserva en los reintentos: un doble clic o un corte de red
 * no duplican el movimiento.
 */
export function SaldoInicialDialog({ open, onClose, product, row }: Props) {
  const online = useOnline()
  const toast = useToast()
  const mutation = useSetInitialBalance()
  const canUsePackages = product.presentation_qty != null && Number(product.presentation_qty) > 0
  const [mode, setMode] = useState<'qty' | 'packages'>('qty')
  const [qtyStr, setQtyStr] = useState('')
  const [packagesStr, setPackagesStr] = useState('')
  const [reference, setReference] = useState('')
  const [key, setKey] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setKey(crypto.randomUUID())
    setMode(canUsePackages ? 'packages' : 'qty')
    setQtyStr('')
    setPackagesStr('')
    setReference('')
    setError(null)
  }, [open, row.id, canUsePackages])

  const unit = product.unit
  const presentationQty = Number(product.presentation_qty ?? 0)

  function computeQty(): { ok: true; value: number } | { ok: false; error: string } {
    if (mode === 'packages') {
      const p = parseQuantity(packagesStr, 'unit')
      if (!p.ok) return p
      return { ok: true, value: packagesToBase(p.value, presentationQty) }
    }
    return parseQuantity(qtyStr, unit)
  }

  const preview = computeQty()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!preview.ok) return setError(preview.error)
    try {
      const result = await mutation.mutateAsync({
        key,
        branchId: row.branch_id as string,
        productId: product.id,
        qty: preview.value,
        reference: reference.trim() || null,
      })
      toast.push({ kind: 'success', text: `Saldo inicial registrado: ${formatQuantity(Number(result.balance), unit)} en ${row.branch_name}.` })
      onClose()
    } catch (err) {
      setError(messageFor(err))
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Saldo inicial · ${row.branch_name}`}>
      <p className="mb-4 text-sm text-muted">
        {product.name} · {product.sku} · se controla en {UNIT_LABEL[unit]}. Se registra una sola vez por sucursal.
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {canUsePackages && (
          <fieldset className="flex gap-4 text-sm">
            <legend className="sr-only">Modo de carga</legend>
            <label className="flex items-center gap-2">
              <input type="radio" name="mode" checked={mode === 'packages'} onChange={() => setMode('packages')} /> Por envases
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="mode" checked={mode === 'qty'} onChange={() => setMode('qty')} /> Por cantidad
            </label>
          </fieldset>
        )}
        {mode === 'packages' ? (
          <Input
            label={`Envases (de ${formatQuantity(presentationQty, unit)} cada uno)`}
            value={packagesStr}
            onChange={(e) => setPackagesStr(e.target.value)}
            inputMode="numeric"
            className="tnum"
            autoFocus
          />
        ) : (
          <Input
            label={`Cantidad (${UNIT_LABEL[unit]})`}
            value={qtyStr}
            onChange={(e) => setQtyStr(e.target.value)}
            inputMode="decimal"
            className="tnum"
            hint={unit === 'unit' ? 'Solo enteros.' : 'Hasta dos decimales, por ejemplo 1.974,50'}
            autoFocus
          />
        )}
        <Input label="Referencia (opcional)" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Conteo del 10/09" maxLength={120} />
        <div className="rounded-control border border-hairline bg-canvas p-3 text-sm tnum" aria-live="polite">
          {mode === 'packages' && preview.ok && (
            <p className="text-muted">
              {packagesStr.trim() || '0'} envases × {formatQuantity(presentationQty, unit)} ={' '}
              <span className="font-semibold text-ink">{formatQuantity(preview.value, unit)}</span>
            </p>
          )}
          <p>
            Saldo resultante:{' '}
            <span className="font-semibold">{preview.ok ? formatQuantity(preview.value, unit) : '—'}</span>
            {' · '}Mínimo: {formatNumber(Number(row.min_qty ?? 0), unit)} {UNIT_LABEL[unit]}
          </p>
          {preview.ok && preview.value <= Number(row.min_qty ?? 0) && (
            <p className="mt-1 text-amber-fg">Quedará bajo mínimo: se abrirá una alerta.</p>
          )}
        </div>
        {error && (
          <p role="alert" className="text-sm text-carmine-fg">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending || !online || !preview.ok}>
            {mutation.isPending ? 'Registrando…' : 'Confirmar saldo inicial'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
```

- [ ] **Paso 4: `ProductoDetallePage.tsx`**

```tsx
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useCurrentProfile } from '@/app/guards'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { useProduct, useProductAvailability } from '@/features/products/api'
import { messageFor } from '@/lib/errors'
import { formatQuantity, UNIT_NAME } from '@/lib/quantity'
import type { InventoryStatus } from '@/types/models'
import { SaldoInicialDialog } from './SaldoInicialDialog'
import { StatusChip } from './StatusChip'

export function ProductoDetallePage() {
  const { productId } = useParams<{ productId: string }>()
  const me = useCurrentProfile()
  const product = useProduct(productId)
  const availability = useProductAvailability(productId)
  const [initRow, setInitRow] = useState<InventoryStatus | null>(null)

  if (product.isPending || availability.isPending) return <LoadingState />
  if (product.isError) return <ErrorState message={messageFor(product.error)} onRetry={() => void product.refetch()} />
  if (availability.isError) return <ErrorState message={messageFor(availability.error)} onRetry={() => void availability.refetch()} />
  if (!product.data) return <ErrorState message="El producto no existe o no pertenece a tu cadena." />

  const p = product.data
  const rows = availability.data ?? []

  return (
    <>
      <PageHeader
        eyebrow={`${p.sku} · ${UNIT_NAME[p.unit]}`}
        title={p.name}
        description={[p.brand, p.category, p.variant, p.presentation].filter(Boolean).join(' · ') || undefined}
        actions={
          <>
            <Link to="/inventario" className="text-sm underline">
              Volver al inventario
            </Link>
            {me.role === 'admin' && (
              <Link to={`/catalogo/${p.id}`} className="text-sm underline">
                Editar en catálogo
              </Link>
            )}
          </>
        }
      />
      {rows.length === 0 && (
        <EmptyState
          title="Este producto no está habilitado en tu sucursal"
          description={me.role === 'admin' ? 'Habilitalo desde el catálogo.' : undefined}
        />
      )}
      {rows.length > 0 && (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="label-caps text-muted">{r.branch_code}</p>
                <p className="font-semibold">{r.branch_name}</p>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm tnum md:grid-cols-3">
                <dt className="text-muted">Saldo</dt>
                <dd className="font-semibold md:col-span-2">{formatQuantity(Number(r.balance ?? 0), p.unit)}</dd>
                <dt className="text-muted">Mínimo</dt>
                <dd className="md:col-span-2">{formatQuantity(Number(r.min_qty ?? 0), p.unit)}</dd>
                <dt className="text-muted">Estado</dt>
                <dd className="md:col-span-2">
                  <StatusChip row={r} />
                </dd>
              </dl>
              {me.role === 'admin' && !r.initialized_at && (
                <Button onClick={() => setInitRow(r)}>Registrar saldo inicial</Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Historial</h2>
        <EmptyState title="Disponible en la próxima versión" description="Los movimientos se incorporan en el siguiente incremento." />
      </section>
      {initRow && (
        <SaldoInicialDialog open={Boolean(initRow)} onClose={() => setInitRow(null)} product={p} row={initRow} />
      )}
    </>
  )
}
```

- [ ] **Paso 5: `InventarioPage.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { useActiveBranch } from '@/features/branches/activeBranch'
import { useBranches } from '@/features/branches/api'
import { messageFor } from '@/lib/errors'
import { formatQuantity, UNIT_LABEL } from '@/lib/quantity'
import type { InventoryStatus, UnitKind } from '@/types/models'
import { COMPARE_LIMIT, PAGE_SIZE, useInventory } from './api'
import { groupByProduct } from './group'
import { StatusChip } from './StatusChip'

function Cell({ row, unit }: { row: InventoryStatus | undefined; unit: UnitKind }) {
  if (!row) return <span className="text-muted">—</span>
  return (
    <span className="flex flex-col items-end gap-1">
      <span className="font-semibold tnum">{formatQuantity(Number(row.balance ?? 0), unit)}</span>
      {(!row.initialized_at || row.below_min) && <StatusChip row={row} />}
    </span>
  )
}

export function InventarioPage() {
  const { branchId } = useActiveBranch()
  const branches = useBranches()
  const [search, setSearch] = useState('')
  const [onlyBelowMin, setOnlyBelowMin] = useState(false)
  const [page, setPage] = useState(0)
  useEffect(() => setPage(0), [branchId, search, onlyBelowMin])
  const inventory = useInventory({ branchId, search, onlyBelowMin, page })

  const compare = branchId === 'all'
  const activeBranches = (branches.data ?? []).filter((b) => b.is_active)
  const branchName = branches.data?.find((b) => b.id === branchId)?.name

  const rows = inventory.data?.rows ?? []
  const count = inventory.data?.count ?? 0
  const from = page * PAGE_SIZE + 1
  const to = Math.min(count, (page + 1) * PAGE_SIZE)

  return (
    <>
      <PageHeader
        eyebrow={compare ? 'Comparación entre locales' : (branchName ?? 'Sucursal')}
        title="Inventario"
        description={compare ? 'Un mismo SKU en cada sucursal. No se suman unidades distintas.' : 'Saldo utilizable por producto.'}
      />
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div className="relative w-full max-w-sm">
          <Input label="Buscar" placeholder="Nombre o SKU" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          <Search size={16} className="pointer-events-none absolute bottom-3 left-3 text-muted" aria-hidden />
        </div>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyBelowMin} onChange={(e) => setOnlyBelowMin(e.target.checked)} />
          Solo bajo mínimo
        </label>
      </div>

      {inventory.isPending && <LoadingState />}
      {inventory.isError && <ErrorState message={messageFor(inventory.error)} onRetry={() => void inventory.refetch()} />}
      {inventory.data && rows.length === 0 && (
        <EmptyState
          title={search || onlyBelowMin ? 'Sin resultados' : 'No hay productos habilitados'}
          description={search || onlyBelowMin ? 'Probá quitando filtros.' : 'El administrador habilita productos desde el catálogo.'}
        />
      )}

      {inventory.data && rows.length > 0 && !compare && (
        <>
          <table className="hidden w-full border-collapse text-sm md:table">
            <thead>
              <tr className="label-caps text-left text-muted">
                <th className="py-2 pr-4">Producto</th>
                <th className="py-2 pr-4">SKU</th>
                <th className="py-2 pr-4">Unidad</th>
                <th className="py-2 pr-4 text-right">Saldo</th>
                <th className="py-2 pr-4 text-right">Mínimo</th>
                <th className="py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-hairline hover:bg-canvas">
                  <td className="py-3 pr-4">
                    <Link to={`/inventario/${r.product_id}`} className="font-semibold underline-offset-2 hover:underline">
                      {r.product_name}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 tnum">{r.sku}</td>
                  <td className="py-3 pr-4">{UNIT_LABEL[(r.unit ?? 'unit') as UnitKind]}</td>
                  <td className="py-3 pr-4 text-right font-semibold tnum">{formatQuantity(Number(r.balance ?? 0), (r.unit ?? 'unit') as UnitKind)}</td>
                  <td className="py-3 pr-4 text-right tnum">{formatQuantity(Number(r.min_qty ?? 0), (r.unit ?? 'unit') as UnitKind)}</td>
                  <td className="py-3">
                    <StatusChip row={r} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="flex flex-col gap-3 md:hidden">
            {rows.map((r) => (
              <li key={r.id} className="rounded-lg border border-hairline bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="label-caps text-muted tnum">{r.sku}</p>
                    <Link to={`/inventario/${r.product_id}`} className="font-semibold">
                      {r.product_name}
                    </Link>
                  </div>
                  <StatusChip row={r} />
                </div>
                <p className="mt-2 text-sm tnum">
                  <span className="font-semibold">{formatQuantity(Number(r.balance ?? 0), (r.unit ?? 'unit') as UnitKind)}</span>
                  <span className="text-muted"> · mínimo {formatQuantity(Number(r.min_qty ?? 0), (r.unit ?? 'unit') as UnitKind)}</span>
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between text-sm text-muted">
            <span className="tnum">
              Mostrando {from}–{to} de {count}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <Button variant="secondary" disabled={to >= count} onClick={() => setPage((p) => p + 1)}>
                Siguiente
              </Button>
            </div>
          </div>
        </>
      )}

      {inventory.data && rows.length > 0 && compare && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr className="label-caps text-left text-muted">
                <th className="py-2 pr-4">Producto</th>
                <th className="py-2 pr-4">Unidad</th>
                {activeBranches.map((b) => (
                  <th key={b.id} className="py-2 pr-4 text-right">
                    {b.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupByProduct(rows).map((g) => (
                <tr key={g.productId} className="border-t border-hairline hover:bg-canvas">
                  <td className="py-3 pr-4">
                    <Link to={`/inventario/${g.productId}`} className="font-semibold underline-offset-2 hover:underline">
                      {g.name}
                    </Link>
                    <span className="block text-xs text-muted tnum">{g.sku}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <Chip>{UNIT_LABEL[g.unit]}</Chip>
                  </td>
                  {activeBranches.map((b) => (
                    <td key={b.id} className="py-3 pr-4 text-right">
                      <Cell row={g.byBranch[b.id]} unit={g.unit} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length >= COMPARE_LIMIT && (
            <p className="mt-3 text-xs text-muted">Se muestran las primeras {COMPARE_LIMIT} filas. Refiná la búsqueda o elegí una sucursal.</p>
          )}
        </div>
      )}
    </>
  )
}
```

- [ ] **Paso 6: Enrutar**

En `src/app/router.tsx`, importar `InventarioPage` y `ProductoDetallePage` desde `@/features/inventory/...` y reemplazar los placeholders de `inventario` e `inventario/:productId`. Eliminar el import de `PlaceholderPage` si solo queda `inicio` (la Tarea 15 lo reemplaza; hasta entonces mantener el import).

- [ ] **Paso 7: Verificar**

Run: `npm test && npm run typecheck && npm run build`
Expected: PASS y sin errores.

Manual:
1. Admin, pill "Sucursal Centro": `/inventario` lista SH-PRO-NEUTRO con "Sin saldo inicial". Entrar al detalle → "Registrar saldo inicial" → modo envases `2` → vista previa "2 envases × 1.000,00 ml = 2.000,00 ml" → confirmar → toast, saldo 2.000,00 ml, chip OK (mínimo 1.980). El botón desaparece.
2. Volver a `/catalogo/<id>`: el selector de unidad ahora está bloqueado.
3. Admin, pill "Todas las sucursales": tabla comparativa con columna Centro y Pocitos; Pocitos muestra "—" (no habilitado).
4. Operador Centro (`centro@pelu.com`): `/inventario` muestra solo Centro; el detalle no tiene botón de saldo inicial; `/inventario/<id-de-otro-producto-no-habilitado>` muestra "no está habilitado en tu sucursal".
5. Con DevTools Offline, abrir el diálogo: "Confirmar" deshabilitado.

- [ ] **Paso 8: Commit**

```bash
git add src/features/inventory src/app/router.tsx tests/unit/inventoryGroup.test.ts
git commit -m "feat: inventario por sucursal, comparación entre locales y saldo inicial con conversión

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 15: Inicio del administrador

**Files:**
- Create: `src/features/home/api.ts`, `src/features/home/InicioAdminPage.tsx`
- Modify: `src/app/router.tsx` (ruta `inicio`; eliminar `PlaceholderPage` si ya no se usa), `src/pages/PlaceholderPage.tsx` (borrar si ningún import lo usa)

**Interfaces:**
- Consumes: `useBranches`, `useActiveBranch`, `inventory_status`, `alerts`.
- Produces: `useInventorySummary()` → `Record<branchId, { enabled: number; belowMin: number; uninitialized: number }>`, `useOpenAlertCount()` → `Record<branchId, number>`.

- [ ] **Paso 1: `api.ts`**

```ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type BranchSummary = { enabled: number; belowMin: number; uninitialized: number }

export function useInventorySummary() {
  return useQuery({
    queryKey: ['inventory', 'summary'],
    queryFn: async (): Promise<Record<string, BranchSummary>> => {
      const { data, error } = await supabase
        .from('inventory_status')
        .select('branch_id, below_min, initialized_at')
        .eq('product_active', true)
        .limit(5000)
      if (error) throw error
      const out: Record<string, BranchSummary> = {}
      for (const r of data) {
        const id = r.branch_id ?? ''
        const s = (out[id] ??= { enabled: 0, belowMin: 0, uninitialized: 0 })
        s.enabled += 1
        if (r.below_min) s.belowMin += 1
        if (!r.initialized_at) s.uninitialized += 1
      }
      return out
    },
  })
}

export function useOpenAlertCount() {
  return useQuery({
    queryKey: ['inventory', 'alerts', 'open'],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase.from('alerts').select('branch_id').eq('status', 'open').limit(5000)
      if (error) throw error
      const out: Record<string, number> = {}
      for (const r of data) out[r.branch_id] = (out[r.branch_id] ?? 0) + 1
      return out
    },
  })
}
```

- [ ] **Paso 2: `InicioAdminPage.tsx`**

```tsx
import { Link, useNavigate } from 'react-router'
import { Package, Store, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { useActiveBranch } from '@/features/branches/activeBranch'
import { useBranches } from '@/features/branches/api'
import { messageFor } from '@/lib/errors'
import { useInventorySummary, useOpenAlertCount } from './api'

export function InicioAdminPage() {
  const navigate = useNavigate()
  const { setBranchId } = useActiveBranch()
  const branches = useBranches()
  const summary = useInventorySummary()
  const alerts = useOpenAlertCount()

  if (branches.isPending || summary.isPending || alerts.isPending) return <LoadingState />
  if (branches.isError) return <ErrorState message={messageFor(branches.error)} onRetry={() => void branches.refetch()} />
  if (summary.isError) return <ErrorState message={messageFor(summary.error)} onRetry={() => void summary.refetch()} />
  if (alerts.isError) return <ErrorState message={messageFor(alerts.error)} onRetry={() => void alerts.refetch()} />

  const active = (branches.data ?? []).filter((b) => b.is_active)

  return (
    <>
      <PageHeader eyebrow="Cadena" title="Inicio" description="Estado de cada sucursal y accesos rápidos." />
      {active.length === 0 && (
        <EmptyState title="No hay sucursales activas" action={<Link to="/sucursales"><Button>Crear sucursal</Button></Link>} />
      )}
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {active.map((b) => {
          const s = summary.data?.[b.id] ?? { enabled: 0, belowMin: 0, uninitialized: 0 }
          const open = alerts.data?.[b.id] ?? 0
          return (
            <li key={b.id} className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="label-caps text-muted">{b.code}</p>
                  <h2 className="text-lg font-semibold">{b.name}</h2>
                </div>
                {open > 0 ? <Chip tone="amber">{open} alertas</Chip> : <Chip tone="sage">Sin alertas</Chip>}
              </div>
              <dl className="grid grid-cols-3 gap-2 text-center tnum">
                <div>
                  <dt className="label-caps text-muted">Habilitados</dt>
                  <dd className="text-2xl font-bold">{s.enabled}</dd>
                </div>
                <div>
                  <dt className="label-caps text-muted">Bajo mínimo</dt>
                  <dd className={`text-2xl font-bold ${s.belowMin > 0 ? 'text-amber-fg' : ''}`}>{s.belowMin}</dd>
                </div>
                <div>
                  <dt className="label-caps text-muted">Sin saldo inicial</dt>
                  <dd className="text-2xl font-bold">{s.uninitialized}</dd>
                </div>
              </dl>
              <Button
                variant="secondary"
                onClick={() => {
                  setBranchId(b.id)
                  navigate('/inventario')
                }}
              >
                Ver inventario
              </Button>
            </li>
          )
        })}
      </ul>
      <section className="mt-8">
        <h2 className="label-caps mb-3 text-muted">Accesos rápidos</h2>
        <div className="flex flex-wrap gap-2">
          <Link to="/catalogo"><Button variant="secondary"><Package size={16} aria-hidden /> Catálogo</Button></Link>
          <Link to="/sucursales"><Button variant="secondary"><Store size={16} aria-hidden /> Sucursales</Button></Link>
          <Link to="/usuarios"><Button variant="secondary"><Users size={16} aria-hidden /> Usuarios</Button></Link>
          <Button
            variant="secondary"
            onClick={() => {
              setBranchId('all')
              navigate('/inventario')
            }}
          >
            Comparar locales
          </Button>
        </div>
      </section>
    </>
  )
}
```

- [ ] **Paso 3: Enrutar y limpiar**

En `src/app/router.tsx`, importar `InicioAdminPage` desde `@/features/home/InicioAdminPage` y reemplazar el placeholder de `inicio`. Si ya no queda ningún `<PlaceholderPage`, borrar el import y el archivo `src/pages/PlaceholderPage.tsx`.

- [ ] **Paso 4: Verificar**

Run: `npm test && npm run typecheck && npm run build`
Expected: PASS y sin errores.

Manual (admin): `/inicio` muestra una tarjeta por sucursal activa con conteos coherentes con lo cargado en las tareas anteriores. "Ver inventario" cambia el pill a esa sucursal y abre `/inventario`. "Comparar locales" pone "Todas las sucursales".

- [ ] **Paso 5: Commit**

```bash
git add -A src
git commit -m "feat: inicio del administrador con resumen por sucursal y accesos rápidos

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 16: Seed completo, documentación y despliegue de vista previa

**Files:**
- Modify: `supabase/seed.sql` (reemplazar por la versión completa)
- Create: `README.md`, `docs/operacion.md`, `docs/decisiones/ADR-001-arquitectura.md`, `docs/bitacora.md`

**Interfaces:**
- Produces: cadena demo con 50 SKU y saldos determinísticos del guion (plan §23.2); documentación de instalación y operación; URL de vista previa en Vercel.

- [ ] **Paso 1: Reemplazar `supabase/seed.sql` por la versión completa**

```sql
-- seed.sql — cadena demo reproducible (50 SKU, 2 sucursales, 3 perfiles).
-- Idempotente: borra y recrea "Cadena Demo". Las cuentas Auth se crean a mano (docs/operacion.md)
-- y se re-vinculan por email al final.

delete from public.chains where name = 'Cadena Demo';

insert into public.chains (id, name, timezone)
values ('11111111-1111-4111-8111-111111111111', 'Cadena Demo', 'America/Montevideo');

insert into public.branches (id, chain_id, code, name) values
  ('22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111111', 'CEN', 'Sucursal Centro'),
  ('22222222-2222-4222-8222-222222222202', '11111111-1111-4111-8111-111111111111', 'POC', 'Sucursal Pocitos');

insert into public.profiles (id, chain_id, email, full_name, role, branch_id) values
  ('33333333-3333-4333-8333-333333333301', '11111111-1111-4111-8111-111111111111', 'admin@pelu.com',   'Valeria Méndez', 'admin',    null),
  ('33333333-3333-4333-8333-333333333302', '11111111-1111-4111-8111-111111111111', 'centro@pelu.com',  'Sofía Varela',   'operator', '22222222-2222-4222-8222-222222222201'),
  ('33333333-3333-4333-8333-333333333303', '11111111-1111-4111-8111-111111111111', 'pocitos@pelu.com', 'Esteban Rossi',  'operator', '22222222-2222-4222-8222-222222222202');

-- Catálogo + mínimos y saldos por sucursal (min_cen, bal_cen, min_poc, bal_poc) en unidad base.
create temp table seed_products (
  sku text, name text, brand text, category text, variant text, unit public.unit_kind,
  presentation text, presentation_qty numeric,
  min_cen numeric, bal_cen numeric, min_poc numeric, bal_poc numeric
);

insert into seed_products values
  -- Tinturas (unidad = tubo)
  ('TIN-1.0',  'Tintura 1.0 Negro',                    'Wella Koleston', 'Tinturas', '1.0',  'unit', 'Tubo 60 ml', null, 3, 8,  3, 5),
  ('TIN-3.0',  'Tintura 3.0 Castaño oscuro',           'Wella Koleston', 'Tinturas', '3.0',  'unit', 'Tubo 60 ml', null, 3, 6,  3, 4),
  ('TIN-4.0',  'Tintura 4.0 Castaño medio',            'Wella Koleston', 'Tinturas', '4.0',  'unit', 'Tubo 60 ml', null, 4, 9,  3, 6),
  ('TIN-5.0',  'Tintura 5.0 Castaño claro',            'Wella Koleston', 'Tinturas', '5.0',  'unit', 'Tubo 60 ml', null, 4, 10, 3, 7),
  ('TIN-6.0',  'Tintura 6.0 Rubio oscuro',             'Wella Koleston', 'Tinturas', '6.0',  'unit', 'Tubo 60 ml', null, 4, 12, 3, 8),
  ('TIN-7.0',  'Tintura 7.0 Rubio medio',              'Wella Koleston', 'Tinturas', '7.0',  'unit', 'Tubo 60 ml', null, 4, 11, 3, 3),
  ('TIN-8.0',  'Tintura 8.0 Rubio claro',              'Wella Koleston', 'Tinturas', '8.0',  'unit', 'Tubo 60 ml', null, 4, 7,  3, 6),
  ('TIN-9.0',  'Tintura 9.0 Rubio muy claro',          'Wella Koleston', 'Tinturas', '9.0',  'unit', 'Tubo 60 ml', null, 3, 5,  2, 4),
  ('TIN-6.1',  'Tintura 6.1 Rubio oscuro ceniza',      'Wella Koleston', 'Tinturas', '6.1',  'unit', 'Tubo 60 ml', null, 3, 6,  2, 2),
  ('TIN-7.3',  'Tintura 7.3 Rubio medio dorado',       'Wella Koleston', 'Tinturas', '7.3',  'unit', 'Tubo 60 ml', null, 3, 8,  2, 5),
  ('TIN-5.4',  'Tintura 5.4 Castaño claro cobrizo',    'Wella Koleston', 'Tinturas', '5.4',  'unit', 'Tubo 60 ml', null, 2, 4,  2, 3),
  ('TIN-8.81', 'Tintura 8.81 Rubio claro perla ceniza','Wella Koleston', 'Tinturas', '8.81', 'unit', 'Tubo 60 ml', null, 2, 3,  2, 1),
  -- Oxidantes (ml, envase 1.000 ml)
  ('OX-10', 'Oxidante 10 vol. 1 L', 'Wella Welloxon', 'Oxidantes', '10 vol', 'ml', 'Envase 1.000 ml', 1000, 500, 1200, 500, 900),
  ('OX-20', 'Oxidante 20 vol. 1 L', 'Wella Welloxon', 'Oxidantes', '20 vol', 'ml', 'Envase 1.000 ml', 1000, 500, 850,  500, 400),
  ('OX-30', 'Oxidante 30 vol. 1 L', 'Wella Welloxon', 'Oxidantes', '30 vol', 'ml', 'Envase 1.000 ml', 1000, 500, 1500, 500, 1100),
  ('OX-40', 'Oxidante 40 vol. 1 L', 'Wella Welloxon', 'Oxidantes', '40 vol', 'ml', 'Envase 1.000 ml', 1000, 300, 700,  300, 600),
  -- Profesional a granel (ml)
  ('SH-PRO-NEUTRO', 'Shampoo profesional neutro 1 L',        'L''Oréal Professionnel', 'Profesional', null, 'ml', 'Envase 1.000 ml', 1000, 1980, 2000, 1000, 3500),
  ('SH-PRO-COLOR',  'Shampoo profesional color 1 L',         'L''Oréal Professionnel', 'Profesional', null, 'ml', 'Envase 1.000 ml', 1000, 800,  2400, 800,  1600),
  ('SH-PRO-DETOX',  'Shampoo profesional detox 1 L',         'L''Oréal Professionnel', 'Profesional', null, 'ml', 'Envase 1.000 ml', 1000, 800,  1300, 800,  2000),
  ('AC-PRO-HIDRA',  'Acondicionador profesional hidratante 1 L', 'L''Oréal Professionnel', 'Profesional', null, 'ml', 'Envase 1.000 ml', 1000, 800, 1900, 800, 1200),
  ('MASK-PRO-REP',  'Máscara profesional reparadora 1 L',    'L''Oréal Professionnel', 'Profesional', null, 'ml', 'Envase 1.000 ml', 1000, 500,  1400, 500,  700),
  ('PLEX-1',        'Plex paso 1 protector 500 ml',          'Olaplex',               'Tratamientos', 'Paso 1', 'ml', 'Envase 500 ml', 500, 250, 750, 250, 400),
  ('PLEX-2',        'Plex paso 2 reparador 500 ml',          'Olaplex',               'Tratamientos', 'Paso 2', 'ml', 'Envase 500 ml', 500, 250, 900, 250, 350),
  -- Decolorantes (g)
  ('DEC-500',  'Polvo decolorante premium 500 g', 'Wella Blondor', 'Decolorantes', null,   'g', 'Bolsa 500 g', 500, 500, 1250, 500, 800),
  ('DEC-AZUL', 'Polvo decolorante azul 500 g',    'Wella Blondor', 'Decolorantes', 'Azul', 'g', 'Bolsa 500 g', 500, 300, 600,  300, 250),
  -- Ampollas y tonalizantes (unidad)
  ('AMP-PLEX-10', 'Ampolla plex 10 ml',            'Olaplex',     'Tratamientos', null,     'unit', 'Caja x10', null, 10, 24, 10, 8),
  ('AMP-KER',     'Ampolla keratina 12 ml',        'Kativa',      'Tratamientos', null,     'unit', 'Caja x12', null, 10, 30, 10, 14),
  ('AMP-VIT',     'Ampolla vitaminas 15 ml',       'Kativa',      'Tratamientos', null,     'unit', 'Caja x12', null, 6,  12, 6,  10),
  ('TON-VIOL',    'Tonalizante violeta 60 ml',     'Wella Color', 'Tonalizantes', 'Violeta','unit', 'Tubo 60 ml', null, 3, 5, 3, 4),
  ('TON-GRIS',    'Tonalizante gris 60 ml',        'Wella Color', 'Tonalizantes', 'Gris',   'unit', 'Tubo 60 ml', null, 2, 4, 2, 2),
  -- Descartables e insumos (unidad)
  ('GUA-M',       'Guantes nitrilo talle M (caja x100)', 'Sensitex', 'Insumos', 'M', 'unit', 'Caja x100', null, 2, 4, 2, 6),
  ('GUA-L',       'Guantes nitrilo talle L (caja x100)', 'Sensitex', 'Insumos', 'L', 'unit', 'Caja x100', null, 2, 3, 2, 3),
  ('ALU-ROLLO',   'Papel aluminio rollo 100 m',          'Salon Pro', 'Insumos', null, 'unit', 'Rollo', null, 2, 5, 2, 4),
  ('CAPA-DESC',   'Capa descartable (pack x50)',         'Salon Pro', 'Insumos', null, 'unit', 'Pack x50', null, 1, 3, 1, 2),
  ('TOALLA-DESC', 'Toalla descartable (pack x50)',       'Salon Pro', 'Insumos', null, 'unit', 'Pack x50', null, 2, 6, 2, 5),
  ('GORRO-MECH',  'Gorro de mechas',                     'Salon Pro', 'Insumos', null, 'unit', 'Unidad', null, 2, 6, 2, 4),
  ('ALG-500',     'Algodón 500 g',                       'Estrella',  'Insumos', null, 'unit', 'Paquete 500 g', null, 1, 3, 1, 2),
  -- Venta cerrada al público (unidad)
  ('VT-SH-250',      'Shampoo reparador post-color 250 ml',  'Kérastase', 'Venta', null, 'unit', 'Frasco 250 ml', null, 5, 10, 5, 2),
  ('VT-AC-250',      'Acondicionador reparador 250 ml',      'Kérastase', 'Venta', null, 'unit', 'Frasco 250 ml', null, 4, 8,  4, 6),
  ('VT-MASK-200',    'Máscara nutritiva 200 ml',             'Kérastase', 'Venta', null, 'unit', 'Pote 200 ml', null, 3, 6, 3, 5),
  ('VT-SERUM-50',    'Sérum de puntas 50 ml',                'Kérastase', 'Venta', null, 'unit', 'Frasco 50 ml', null, 3, 7, 3, 4),
  ('VT-ACEITE-100',  'Aceite de argán 100 ml',               'Moroccanoil', 'Venta', null, 'unit', 'Frasco 100 ml', null, 3, 5, 3, 3),
  ('VT-SPRAY-150',   'Spray protector térmico 150 ml',       'Moroccanoil', 'Venta', null, 'unit', 'Spray 150 ml', null, 3, 9, 3, 7),
  ('VT-SH-ANTICASPA','Shampoo anticaspa 300 ml',             'Kérastase', 'Venta', null, 'unit', 'Frasco 300 ml', null, 3, 4, 3, 5),
  ('VT-SH-RIZOS',    'Shampoo para rizos 300 ml',            'Kérastase', 'Venta', null, 'unit', 'Frasco 300 ml', null, 3, 6, 3, 2),
  ('VT-CREMA-RIZOS', 'Crema para rizos 200 ml',              'Kérastase', 'Venta', null, 'unit', 'Pote 200 ml', null, 3, 5, 3, 4),
  ('VT-LACA-300',    'Laca fijación fuerte 300 ml',          'Schwarzkopf', 'Venta', null, 'unit', 'Aerosol 300 ml', null, 4, 12, 4, 9),
  ('VT-CERA-80',     'Cera modeladora 80 g',                 'Schwarzkopf', 'Venta', null, 'unit', 'Pote 80 g', null, 3, 7, 3, 6),
  ('VT-MOUSSE-200',  'Mousse volumen 200 ml',                'Schwarzkopf', 'Venta', null, 'unit', 'Aerosol 200 ml', null, 3, 5, 3, 3),
  ('VT-KIT-VIAJE',   'Kit de viaje (3 miniaturas)',          'Kérastase', 'Venta', null, 'unit', 'Kit', null, 2, 4, 2, 5);

insert into public.products (chain_id, sku, name, brand, category, variant, unit, presentation, presentation_qty)
select '11111111-1111-4111-8111-111111111111', sku, name, brand, category, variant, unit, presentation, presentation_qty
  from seed_products;

-- Inventario en ambas sucursales, todo inicializado.
insert into public.inventory (chain_id, branch_id, product_id, balance, min_qty, initialized_at)
select p.chain_id, '22222222-2222-4222-8222-222222222201', p.id, s.bal_cen, s.min_cen, now()
  from seed_products s join public.products p on p.chain_id = '11111111-1111-4111-8111-111111111111' and p.sku = s.sku
union all
select p.chain_id, '22222222-2222-4222-8222-222222222202', p.id, s.bal_poc, s.min_poc, now()
  from seed_products s join public.products p on p.chain_id = '11111111-1111-4111-8111-111111111111' and p.sku = s.sku;

-- Una operación de carga inicial por sucursal, con un movimiento por producto con saldo > 0.
insert into public.operations (id, chain_id, type, actor_profile_id, idempotency_key, request_hash, reference) values
  ('44444444-4444-4444-8444-444444444401', '11111111-1111-4111-8111-111111111111', 'initial', '33333333-3333-4333-8333-333333333301', gen_random_uuid(), 'seed', 'Carga inicial Centro'),
  ('44444444-4444-4444-8444-444444444402', '11111111-1111-4111-8111-111111111111', 'initial', '33333333-3333-4333-8333-333333333301', gen_random_uuid(), 'seed', 'Carga inicial Pocitos');

insert into public.movements (chain_id, operation_id, product_id, branch_id, qty_delta, unit)
select i.chain_id,
       case i.branch_id when '22222222-2222-4222-8222-222222222201' then '44444444-4444-4444-8444-444444444401'
                        else '44444444-4444-4444-8444-444444444402' end,
       i.product_id, i.branch_id, i.balance, p.unit
  from public.inventory i join public.products p on p.id = i.product_id
 where i.chain_id = '11111111-1111-4111-8111-111111111111' and i.balance > 0;

-- Alertas abiertas donde saldo <= mínimo.
insert into public.alerts (chain_id, branch_id, product_id)
select chain_id, branch_id, product_id from public.inventory
 where chain_id = '11111111-1111-4111-8111-111111111111' and balance <= min_qty;

drop table seed_products;

-- Re-vincular cuentas Auth existentes (tras un re-seed los perfiles se recrean).
update public.profiles p
   set auth_user_id = u.id
  from auth.users u
 where p.chain_id = '11111111-1111-4111-8111-111111111111'
   and p.auth_user_id is null
   and lower(u.email) = lower(p.email)
   and not exists (select 1 from public.profiles q where q.auth_user_id = u.id);
```

- [ ] **Paso 2: Aplicar y verificar el seed**

Run: `npm run db:seed`
Expected: sin errores (no hay migraciones nuevas; corre solo el seed).

Run: `npx supabase db query --linked "select (select count(*) from public.products where chain_id='11111111-1111-4111-8111-111111111111') as productos, (select count(*) from public.inventory where chain_id='11111111-1111-4111-8111-111111111111') as inventario, (select count(*) from public.alerts where chain_id='11111111-1111-4111-8111-111111111111' and status='open') as alertas, (select count(*) from public.profiles where chain_id='11111111-1111-4111-8111-111111111111' and auth_user_id is not null) as vinculados"`
Expected: `productos = 50`, `inventario = 100`, `alertas > 0`, `vinculados = 3`.

Run: `npx supabase db query --linked "select b.code, s.balance, s.min_qty, s.below_min from public.inventory_status s join public.branches b on b.id = s.branch_id where s.sku in ('SH-PRO-NEUTRO','VT-SH-250') order by s.sku, b.code"`
Expected: `SH-PRO-NEUTRO CEN 2000.00 1980.00 f`, `SH-PRO-NEUTRO POC 3500.00 1000.00 f`, `VT-SH-250 CEN 10.00 5.00 f`, `VT-SH-250 POC 2.00 5.00 t`.

Conciliación (plan §14.3): `npx supabase db query --linked "select count(*) as diferencias from public.inventory i left join (select branch_id, product_id, sum(qty_delta) as total from public.movements group by 1,2) m on m.branch_id = i.branch_id and m.product_id = i.product_id where i.chain_id='11111111-1111-4111-8111-111111111111' and i.balance <> coalesce(m.total, 0)"`
Expected: `diferencias = 0`.

- [ ] **Paso 3: Escribir `README.md`**

```markdown
# Stock Peluquerías

Control de stock para una cadena de peluquerías con varias sucursales. Proyecto académico (IET, ORT Uruguay, 2026).
Aplicación web (React + Vite) sobre Supabase (PostgreSQL, Auth, RLS). Las escrituras pasan solo por funciones PostgreSQL que validan rol, sucursal y cantidades y registran auditoría.

Estado: SP1 (fundación y catálogo). Ver `docs/superpowers/specs/` y `docs/referencia/plan-v1.md`.

## Requisitos

- Node.js 22.12 o superior (probado con 24).
- Cuenta de Supabase con un proyecto creado y la CLI enlazada (`docs/operacion.md`).

## Instalación

```bash
npm install
cp .env.example .env.local        # completar con URL y anon key del proyecto
```

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en http://localhost:5173 |
| `npm run build` | Typecheck + build de producción en `dist/` |
| `npm test` | Pruebas unitarias (sin red) |
| `npm run test:db` | Pruebas de integración contra Supabase (`.env.test.local`) |
| `npm run db:push` | Aplica migraciones pendientes al proyecto enlazado |
| `npm run db:seed` | Aplica migraciones + `supabase/seed.sql` (cadena demo) |
| `npm run db:types` | Regenera `src/types/database.ts` |
| `npm run lint` / `npm run format` | ESLint / Prettier |

## Estructura

- `src/features/*`: una carpeta por área (auth, branches, users, products, inventory, home).
- `src/components/ui`: primitivas del design system.
- `src/lib`: cliente Supabase, cantidades, errores, validación.
- `supabase/migrations`: esquema, RLS y RPC en orden. `supabase/seed.sql`: datos demo.
- `tests/unit`, `tests/db`: pruebas.
- `docs/`: spec, plan, operación, decisiones, bitácora, material de referencia.

## Usuarios demo

Perfiles del seed: `admin@pelu.com` (administrador), `centro@pelu.com` y `pocitos@pelu.com` (operadores). Las contraseñas se definen al crear las cuentas en Supabase (ver `docs/operacion.md`); no viven en el repositorio.
```

- [ ] **Paso 4: Escribir `docs/operacion.md`**

```markdown
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
```

Agregar `backups/` a `.gitignore`.

- [ ] **Paso 5: Escribir `docs/decisiones/ADR-001-arquitectura.md` y `docs/bitacora.md`**

`docs/decisiones/ADR-001-arquitectura.md`:

```markdown
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
```

`docs/bitacora.md`:

```markdown
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
```

- [ ] **Paso 6 (usuario): preparar Vercel**

En la terminal del usuario: `vercel login`. Luego en https://vercel.com → Add New Project → importar la carpeta o dejar que `vercel --yes` cree el proyecto en el paso siguiente. Antes del build, cargar en Settings → Environment Variables (Preview y Production): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

- [ ] **Paso 7: Vista previa**

Run: `vercel --yes`
Expected: termina con una URL `https://stock-peluquerias-….vercel.app`. Si falla por variables faltantes, completar el Paso 6 y repetir.

Verificar: abrir la URL → `/login`; ingresar con `admin@pelu.com` → `/inicio` con dos tarjetas (Centro con 0–1 alertas, Pocitos con varias). Recargar en `/inventario` → no da 404 (rewrite SPA).

Agregar `https://<url-de-vercel>/auth/restablecer` a Supabase → Authentication → URL Configuration → Redirect URLs (usuario).

- [ ] **Paso 8: Verificación final de SP1**

Run: `npm test && npm run test:db && npm run typecheck && npm run build`
Expected: todo en verde.

Recorrido de aceptación (dos ventanas: admin y `centro@pelu.com`):

1. Admin compara locales: SH-PRO-NEUTRO muestra 2.000,00 ml en Centro y 3.500,00 ml en Pocitos (RF-05, HU-01).
2. Operador Centro ve solo Centro; `/catalogo` → 403; no aparece "Registrar saldo inicial" (RF-02).
3. Admin crea sucursal `NOR`, la habilita para un producto y registra saldo inicial; el operador de Centro no la ve (RF-03, CP-23).
4. Admin desactiva `pocitos@pelu.com`; en la ventana del operador de Pocitos la siguiente navegación lleva a "Cuenta sin perfil" (CP-04). Reactivar.
5. Cerrar sesión y volver a entrar: los saldos persisten (CP-21).

- [ ] **Paso 9: Commit**

```bash
git add supabase/seed.sql README.md docs/operacion.md docs/decisiones/ADR-001-arquitectura.md docs/bitacora.md .gitignore
git commit -m "docs: seed completo de la cadena demo, README, operación, ADR-001 y bitácora

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Cierre de SP1

Al terminar la Tarea 16:

- Todas las casillas marcadas, `main` con los commits de cada tarea.
- `docs/bitacora.md` con la entrada de la semana completada (problemas reales, horas).
- Siguiente paso: brainstorming de SP2 (movimientos) partiendo de `docs/referencia/plan-v1.md` §7.2, §7.3, §7.5, §8.2, §8.3 y CP-06, 08, 09, 10, 11, 18, 19, 20, 22.
