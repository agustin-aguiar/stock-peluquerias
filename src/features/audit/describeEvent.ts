import { formatQuantity, type UnitKind } from '@/lib/quantity'
import type { Json } from '@/types/database'
import type { AuditEvent, AuditLookups } from './api'

type Values = Record<string, Json | undefined>

const fieldNames: Record<string, string> = {
  name: 'Nombre', full_name: 'Nombre', email: 'Correo', code: 'Código', sku: 'SKU',
  brand: 'Marca', category: 'Categoría', variant: 'Variante', unit: 'Unidad',
  presentation: 'Presentación', presentation_qty: 'Contenido por envase',
  min_qty: 'Stock mínimo', balance: 'Saldo', max_movement_qty: 'Máximo por movimiento',
  is_active: 'Estado', role: 'Rol', branch_id: 'Sucursal', status: 'Estado',
  shipping_ref: 'Referencia de envío', dispute_note: 'Diferencia informada',
  resolution_note: 'Resolución',
}

const statusNames: Record<string, string> = {
  draft: 'borrador', dispatched: 'despachada', received: 'recibida',
  disputed: 'con diferencia', resolved: 'resuelta', cancelled: 'cancelada',
  pending: 'pendiente', approved: 'aprobado', rejected: 'rechazado',
}

function values(value: Json | null): Values {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function string(value: Json | undefined): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function number(value: Json | undefined): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function firstString(...items: (Json | undefined)[]): string | undefined {
  return items.map(string).find(Boolean)
}

function quantity(value: number, unit?: UnitKind): string {
  return unit ? formatQuantity(value, unit) : value.toLocaleString('es-UY', { maximumFractionDigits: 2 })
}

function labelFor(key: string, value: Json | undefined, lookups: AuditLookups, unit?: UnitKind): string {
  if (value === null || value === undefined || value === '') return 'sin asignar'
  if (key === 'is_active') return value ? 'activo' : 'inactivo'
  if (key === 'role') return value === 'admin' ? 'administrador' : 'operador de sucursal'
  if (key === 'branch_id') return lookups.branches[String(value)] ?? 'otra sucursal'
  if (key === 'status') return statusNames[String(value)] ?? 'otro estado'
  if (key === 'unit') return value === 'unit' ? 'unidades' : String(value)
  if (['min_qty', 'balance', 'max_movement_qty', 'presentation_qty'].includes(key)) {
    const amount = number(value)
    return amount === undefined ? 'sin dato' : quantity(amount, unit)
  }
  return typeof value === 'string' || typeof value === 'number' ? String(value) : 'dato actualizado'
}

function changes(before: Values, after: Values, lookups: AuditLookups, unit?: UnitKind): string[] {
  return Object.keys(fieldNames)
    .filter((key) => key in before && key in after && JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map((key) => `${fieldNames[key]}: ${labelFor(key, before[key], lookups, unit)} → ${labelFor(key, after[key], lookups, unit)}`)
}

export type AuditDescription = { summary: string; changes: string[] }

export function describeAuditEvent(event: AuditEvent, lookups: AuditLookups): AuditDescription {
  const before = values(event.old_values)
  const after = values(event.new_values)
  const transfer = lookups.transfers[event.entity_id ?? '']
  const productId = firstString(after.product_id, before.product_id, transfer?.product_id)
    ?? (event.entity_type === 'product' ? event.entity_id ?? undefined : undefined)
  const branchId = firstString(after.branch_id, before.branch_id)
    ?? (event.entity_type === 'branch' ? event.entity_id ?? undefined : undefined)
  const product = productId ? lookups.products[productId] : undefined
  const productName = product?.name ?? firstString(after.name, before.name) ?? 'un producto'
  const branchName = branchId ? lookups.branches[branchId] ?? 'una sucursal' : 'una sucursal'
  const unit = product?.unit
  const productAtBranch = `${productName} en ${branchName}`
  const amountBefore = number(before.balance)
  const amountAfter = number(after.balance)
  const balanceAfter = amountAfter ?? number(after.origin_balance) ?? number(after.destination_balance)
  const delta = amountBefore !== undefined && balanceAfter !== undefined
    ? balanceAfter - amountBefore : undefined
  const stockDetails = balanceAfter === undefined ? [] : [`Saldo resultante: ${quantity(balanceAfter, unit)}`]
  const targetChanges = changes(before, after, lookups, unit)
  const transferProduct = transfer ? lookups.products[transfer.product_id] : product
  const transferUnit = transferProduct?.unit
  const transferRoute = transfer
    ? `${transferProduct?.name ?? 'un producto'} de ${lookups.branches[transfer.from_branch_id] ?? 'origen'} a ${lookups.branches[transfer.to_branch_id] ?? 'destino'}`
    : 'un producto entre sucursales'
  const transferQty = transfer ? ` de ${quantity(transfer.qty, transferUnit)}` : ''

  switch (event.action) {
    case 'branch.create':
      return { summary: `Creó la sucursal ${firstString(after.name) ?? branchName}.`, changes: [] }
    case 'branch.update':
      return { summary: `Actualizó la sucursal ${firstString(after.name, before.name) ?? branchName}.`, changes: targetChanges }
    case 'product.create':
      return { summary: `Agregó el producto ${productName}${firstString(after.sku) ? ` (SKU ${after.sku})` : ''}.`, changes: [] }
    case 'product.update':
      return { summary: `Actualizó el producto ${productName}.`, changes: targetChanges }
    case 'profile.create': {
      const role = after.role === 'admin' ? ' como administrador'
        : after.role === 'operator' ? ` como operador de ${lookups.branches[string(after.branch_id) ?? ''] ?? 'una sucursal'}` : ''
      return { summary: `Creó el usuario ${firstString(after.full_name, after.email) ?? 'de la cadena'}${role}.`, changes: [] }
    }
    case 'profile.update':
      return { summary: `Actualizó el usuario ${firstString(after.full_name, before.full_name) ?? 'de la cadena'}.`, changes: targetChanges }
    case 'inventory.enable':
      return { summary: `Habilitó ${productAtBranch} para controlar su stock.`, changes: [] }
    case 'inventory.set_min': {
      const oldMin = number(before.min_qty)
      const newMin = number(after.min_qty)
      return { summary: oldMin !== undefined && newMin !== undefined
        ? `Cambió el mínimo de ${productAtBranch} de ${quantity(oldMin, unit)} a ${quantity(newMin, unit)}.`
        : `Cambió el mínimo de ${productAtBranch}.`, changes: [] }
    }
    case 'inventory.initial_balance':
      return { summary: `Registró el saldo inicial de ${productAtBranch}${balanceAfter !== undefined ? `: ${quantity(balanceAfter, unit)}` : ''}.`, changes: [] }
    case 'inventory.purchase':
    case 'inventory.consumption':
    case 'inventory.sale':
    case 'inventory.shrinkage': {
      const verb: Record<string, string> = {
        'inventory.purchase': 'un ingreso', 'inventory.consumption': 'un consumo',
        'inventory.sale': 'una venta', 'inventory.shrinkage': 'una merma',
      }
      const amount = delta === undefined ? '' : ` de ${quantity(Math.abs(delta), unit)}`
      return { summary: `Registró ${verb[event.action]}${amount} de ${productAtBranch}.`, changes: stockDetails }
    }
    case 'inventory.adjustment':
      return { summary: `Ajustó el stock de ${productAtBranch}${delta === undefined ? '' : ` en ${delta > 0 ? '+' : ''}${quantity(delta, unit)}`}.`, changes: stockDetails }
    case 'inventory.reversal':
      return { summary: `Revirtió un movimiento de ${productAtBranch}.`, changes: stockDetails }
    case 'transfer.create':
      return { summary: `Creó una transferencia${transferQty} de ${transferRoute}.`, changes: [] }
    case 'transfer.cancel':
      return { summary: `Canceló la transferencia${transferQty} de ${transferRoute}.`, changes: [] }
    case 'transfer.dispatch':
      return { summary: `Despachó la transferencia${transferQty} de ${transferRoute}.`, changes: [] }
    case 'transfer.receive':
      return { summary: `Recibió la transferencia${transferQty} de ${transferRoute}.`, changes: [] }
    case 'transfer.dispute':
      return { summary: `Informó una diferencia en la transferencia de ${transferRoute}.`,
        changes: firstString(after.dispute_note) ? [`Motivo: ${after.dispute_note}`] : [] }
    case 'transfer.resolve': {
      const parts = [
        ['Recibido', after.qty_received], ['Devuelto', after.qty_returned], ['Merma', after.qty_lost],
      ].flatMap(([label, value]) => {
        const amount = number(value)
        return amount === undefined ? [] : [`${label}: ${quantity(amount, transferUnit)}`]
      })
      return { summary: `Resolvió la diferencia en la transferencia de ${transferRoute}.`, changes: parts }
    }
    case 'count.submit': {
      const observed = number(after.observed_qty)
      return { summary: `Presentó un conteo físico de ${productAtBranch}${observed === undefined ? '' : `: ${quantity(observed, unit)}`}.`, changes: [] }
    }
    case 'count.approve':
      return { summary: `Aprobó el conteo físico de ${productAtBranch}.`, changes: stockDetails }
    case 'count.reject':
      return { summary: `Rechazó el conteo físico de ${productAtBranch}.`, changes: [] }
    case 'import.catalog':
    case 'import.initial':
    case 'import.initial_stock': {
      const rows = number(after.rows)
      return { summary: `Importó ${event.action === 'import.catalog' ? 'productos al catálogo' : 'saldos iniciales'}${rows === undefined ? '' : ` (${rows} filas)`}.`, changes: [] }
    }
    default: {
      const area: Record<string, string> = {
        inventory: 'el inventario', product: 'un producto', branch: 'una sucursal',
        profile: 'un usuario', transfer: 'una transferencia',
        physical_count: 'un conteo físico', import_batch: 'una importación',
      }
      return { summary: `Registró un cambio en ${area[event.entity_type] ?? 'el sistema'}.`, changes: targetChanges }
    }
  }
}
