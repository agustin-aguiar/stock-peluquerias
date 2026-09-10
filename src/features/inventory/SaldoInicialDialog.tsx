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
