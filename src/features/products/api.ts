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
