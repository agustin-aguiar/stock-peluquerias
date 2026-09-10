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
