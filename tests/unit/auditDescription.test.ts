import { describe, expect, it } from 'vitest'
import { describeAuditEvent } from '@/features/audit/describeEvent'
import type { AuditEvent, AuditLookups } from '@/features/audit/api'

const lookups: AuditLookups = {
  actors: { admin: 'Ana' },
  branches: { centro: 'Centro', pocitos: 'Pocitos' },
  products: { shampoo: { name: 'Shampoo', sku: 'SH-01', unit: 'ml' } },
  transfers: { traslado: { product_id: 'shampoo', from_branch_id: 'centro', to_branch_id: 'pocitos', qty: 100 } },
}

function event(action: string, overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: 'evento', actor_profile_id: 'admin', action, entity_type: 'inventory',
    entity_id: 'inventario', old_values: null, new_values: null,
    created_at: '2026-10-08T12:00:00Z', ...overrides,
  }
}

describe('descripción de auditoría', () => {
  it('explica el cambio de mínimo con nombres y cantidades, sin claves técnicas', () => {
    const description = describeAuditEvent(event('inventory.set_min', {
      old_values: { branch_id: 'centro', product_id: 'shampoo', min_qty: 25 },
      new_values: { branch_id: 'centro', product_id: 'shampoo', min_qty: 50 },
    }), lookups)
    expect(description.summary).toBe('Cambió el mínimo de Shampoo en Centro de 25,00 ml a 50,00 ml.')
    expect(JSON.stringify(description)).not.toContain('product_id')
  })

  it('explica un consumo a partir del saldo anterior y posterior', () => {
    const description = describeAuditEvent(event('inventory.consumption', {
      old_values: { branch_id: 'pocitos', product_id: 'shampoo', balance: 100 },
      new_values: { branch_id: 'pocitos', product_id: 'shampoo', balance: 75 },
    }), lookups)
    expect(description.summary).toBe('Registró un consumo de 25,00 ml de Shampoo en Pocitos.')
    expect(description.changes).toEqual(['Saldo resultante: 75,00 ml'])
  })

  it('explica una transferencia resuelta y sus cantidades', () => {
    const description = describeAuditEvent(event('transfer.resolve', {
      entity_type: 'transfer', entity_id: 'traslado',
      new_values: { qty_received: 70, qty_returned: 20, qty_lost: 10 },
    }), lookups)
    expect(description.summary).toBe('Resolvió la diferencia en la transferencia de Shampoo de Centro a Pocitos.')
    expect(description.changes).toEqual(['Recibido: 70,00 ml', 'Devuelto: 20,00 ml', 'Merma: 10,00 ml'])
  })

  it('muestra cambios de usuario y omite identificadores internos', () => {
    const description = describeAuditEvent(event('profile.update', {
      entity_type: 'profile', old_values: { full_name: 'Luis', role: 'operator', is_active: true, auth_user_id: 'id-interno' },
      new_values: { full_name: 'Luis', role: 'admin', is_active: false, auth_user_id: 'otro-id' },
    }), lookups)
    expect(description.summary).toBe('Actualizó el usuario Luis.')
    expect(description.changes).toEqual(['Estado: activo → inactivo', 'Rol: operador de sucursal → administrador'])
  })

  it('mantiene un texto entendible para acciones futuras desconocidas', () => {
    const description = describeAuditEvent(event('future.unknown', { entity_type: 'inventory' }), lookups)
    expect(description).toEqual({ summary: 'Registró un cambio en el inventario.', changes: [] })
  })
})
