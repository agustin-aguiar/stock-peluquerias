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
