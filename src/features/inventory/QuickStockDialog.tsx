import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { useOnline } from '@/components/ui/OfflineBanner'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toast'
import { useBranches } from '@/features/branches/api'
import { useProductAvailability, useProducts } from '@/features/products/api'
import { messageFor } from '@/lib/errors'
import { formatQuantity, packagesToBase, parseQuantity, UNIT_LABEL } from '@/lib/quantity'
import { supabase } from '@/lib/supabase'
import { useAssignStock, type AssignStockResult } from './api'

type Selection = { branchId?: string; productId?: string }
type Props = { open: boolean; onClose: () => void; selection: Selection }

export function QuickStockDialog({ open, onClose, selection }: Props) {
  const online = useOnline()
  const toast = useToast()
  const qc = useQueryClient()
  const mutation = useAssignStock()
  const branches = useBranches()
  const products = useProducts({ search: '', includeInactive: false })
  const [branchId, setBranchId] = useState('')
  const [productId, setProductId] = useState('')
  const [mode, setMode] = useState<'quantity' | 'packages'>('quantity')
  const [amount, setAmount] = useState('')
  const [reference, setReference] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const retry = useRef({ key: crypto.randomUUID(), signature: '' })

  useEffect(() => {
    if (!open) return
    setBranchId(selection.branchId ?? '')
    setProductId(selection.productId ?? '')
    setMode('quantity')
    setAmount('')
    setReference('')
    setProductSearch('')
    setError(null)
    retry.current = { key: crypto.randomUUID(), signature: '' }
  }, [open, selection.branchId, selection.productId])

  const activeBranches = (branches.data ?? []).filter((branch) => branch.is_active)
  const product = products.data?.find((item) => item.id === productId)
  const availability = useProductAvailability(productId || undefined)
  const row = availability.data?.find((item) => item.branch_id === branchId)
  const isInitial = !row?.initialized_at
  const canUsePackages = product && Number(product.presentation_qty ?? 0) > 0
  const parsed = parseQuantity(amount, mode === 'packages' ? 'unit' : (product?.unit ?? 'unit'))
  const qty = parsed.ok && product
    ? mode === 'packages' ? packagesToBase(parsed.value, Number(product.presentation_qty)) : parsed.value
    : 0
  const valid = Boolean(branchId && product && parsed.ok && qty > 0 && qty <= Number(product.max_movement_qty))
  const proposedBalance = Number(row?.balance ?? 0) + qty
  const visibleProducts = (products.data ?? []).filter((item) => item.id === productId ||
    `${item.sku} ${item.name}`.toLocaleLowerCase('es-UY').includes(productSearch.toLocaleLowerCase('es-UY')))

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!valid || !product) return setError('Elegí sucursal, producto y una cantidad válida.')
    const input = { branchId, productId, qty, reference: reference.trim() || null }
    const signature = JSON.stringify(input)
    if (retry.current.signature && retry.current.signature !== signature) retry.current.key = crypto.randomUUID()
    retry.current.signature = signature
    const key = retry.current.key
    const finish = (result: AssignStockResult) => {
      void qc.invalidateQueries({ queryKey: ['inventory'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.push({ kind: 'success', text: `${result.kind === 'initial' ? 'Saldo inicial' : 'Ingreso'} registrado. Nuevo saldo: ${formatQuantity(Number(result.balance), product.unit)}.` })
      onClose()
    }
    try {
      finish(await mutation.mutateAsync({ key, ...input }))
    } catch (err) {
      const lookup = await supabase.from('operations').select('result').eq('idempotency_key', key).maybeSingle()
      if (lookup.data?.result && (lookup.data.result as { source?: string }).source === 'quick_assign') {
        finish(lookup.data.result as AssignStockResult)
      } else {
        setError(messageFor(err))
      }
    }
  }

  return <Dialog open={open} onClose={onClose} title="Asignar stock a una sucursal">
    <p className="mb-4 text-sm text-muted">Elegí el producto y cuánto entra. Si todavía no tiene stock en ese local, se habilita y se registra su saldo inicial.</p>
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Select label="Sucursal" value={branchId} onChange={(e) => setBranchId(e.target.value)} placeholder="Elegí una sucursal"
        options={activeBranches.map((branch) => ({ value: branch.id, label: branch.name }))} />
      <Input label="Buscar producto" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Nombre o SKU" />
      <Select label="Producto" value={productId} onChange={(e) => { setProductId(e.target.value); setMode('quantity') }}
        placeholder={products.isPending ? 'Cargando productos…' : 'Elegí un producto'}
        options={visibleProducts.map((item) => ({ value: item.id, label: `${item.sku} · ${item.name}` }))} />
      {products.isError && <p role="alert" className="text-sm text-carmine-fg">{messageFor(products.error)}</p>}
      {branches.isError && <p role="alert" className="text-sm text-carmine-fg">{messageFor(branches.error)}</p>}
      {product && <>
        {canUsePackages && <fieldset className="flex gap-4 text-sm"><legend className="sr-only">Forma de carga</legend>
          <label className="flex items-center gap-2"><input type="radio" checked={mode === 'quantity'} onChange={() => setMode('quantity')} /> Cantidad</label>
          <label className="flex items-center gap-2"><input type="radio" checked={mode === 'packages'} onChange={() => setMode('packages')} /> Envases</label>
        </fieldset>}
        <Input label={mode === 'packages' ? `Envases (${formatQuantity(Number(product.presentation_qty), product.unit)} cada uno)` : `Cantidad (${UNIT_LABEL[product.unit]})`}
          value={amount} onChange={(e) => setAmount(e.target.value)} inputMode={mode === 'packages' || product.unit === 'unit' ? 'numeric' : 'decimal'}
          hint={mode === 'packages' || product.unit === 'unit' ? 'Solo enteros.' : 'Hasta dos decimales; por ejemplo 25,50.'} />
        <Input label="Proveedor o referencia (opcional)" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} />
        {branchId && <div className="rounded-control border border-hairline bg-canvas p-3 text-sm" aria-live="polite">
          <p>{availability.isPending ? 'Consultando saldo…' : isInitial ? 'Primera carga en esta sucursal' : 'Se suma al saldo existente'}</p>
          {mode === 'packages' && parsed.ok && <p>{amount} envases = {formatQuantity(qty, product.unit)}</p>}
          {!availability.isPending && <p className="mt-1">Saldo actual: <strong>{formatQuantity(Number(row?.balance ?? 0), product.unit)}</strong>
            {' · '}Saldo después: <strong>{parsed.ok ? formatQuantity(proposedBalance, product.unit) : '—'}</strong></p>}
        </div>}
      </>}
      {error && <p role="alert" className="text-sm text-carmine-fg">{error}</p>}
      <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
        <Button type="submit" disabled={!online || mutation.isPending || availability.isPending || availability.isError || !valid}>
          {mutation.isPending ? 'Guardando…' : 'Asignar stock'}
        </Button></div>
    </form>
  </Dialog>
}
