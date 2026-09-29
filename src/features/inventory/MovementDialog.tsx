import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { useOnline } from '@/components/ui/OfflineBanner'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toast'
import { supabase } from '@/lib/supabase'
import { messageFor } from '@/lib/errors'
import { formatQuantity, packagesToBase, parseQuantity, UNIT_LABEL } from '@/lib/quantity'
import type { InventoryStatus, Product } from '@/types/models'
import { useRegisterMovement, type MovementResult, type MovementType } from './movementsApi'

type Props = { open: boolean; onClose: () => void; product: Product; row: InventoryStatus; isAdmin: boolean }

const TYPE_OPTIONS = [
  { value: 'purchase', label: 'Ingreso de proveedor' },
  { value: 'consumption', label: 'Consumo interno' },
  { value: 'sale', label: 'Salida por venta' },
  { value: 'shrinkage', label: 'Merma' },
  { value: 'adjustment', label: 'Ajuste de inventario' },
]

export function MovementDialog({ open, onClose, product, row, isAdmin }: Props) {
  const online = useOnline()
  const toast = useToast()
  const mutation = useRegisterMovement()
  const [type, setType] = useState<MovementType>(isAdmin ? 'purchase' : 'consumption')
  const [mode, setMode] = useState<'qty' | 'packages'>('qty')
  const [direction, setDirection] = useState<'add' | 'subtract'>('add')
  const [qtyText, setQtyText] = useState('')
  const [reason, setReason] = useState('')
  const [reference, setReference] = useState('')
  const [key, setKey] = useState(() => crypto.randomUUID())
  const [error, setError] = useState<string | null>(null)
  const [lastSignature, setLastSignature] = useState('')
  const canUsePackages = Number(product.presentation_qty ?? 0) > 0 && type === 'purchase'
  const unit = product.unit

  useEffect(() => {
    if (!open) return
    setKey(crypto.randomUUID())
    setType(isAdmin ? 'purchase' : 'consumption')
    setMode('qty')
    setDirection('add')
    setQtyText('')
    setReason('')
    setReference('')
    setLastSignature('')
    setError(null)
  }, [open, row.id, isAdmin])

  const parsed = parseQuantity(qtyText, mode === 'packages' && canUsePackages ? 'unit' : unit)
  const qty = parsed.ok ? (mode === 'packages' && canUsePackages ? packagesToBase(parsed.value, Number(product.presentation_qty)) : parsed.value) : 0
  const delta = type === 'adjustment' ? (direction === 'subtract' ? -qty : qty) :
    type === 'purchase' ? qty : -qty
  const nextBalance = Number(row.balance) + delta
  const valid = parsed.ok && qty > 0 && qty <= Number(product.max_movement_qty) && nextBalance >= 0 &&
    (type !== 'shrinkage' && type !== 'adjustment' || Boolean(reason.trim()))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!valid) return setError(nextBalance < 0 ? 'La cantidad supera el saldo disponible.' : 'Revisá la cantidad y el motivo.')
    const input = { type, branchId: row.branch_id as string, productId: product.id,
      qty: type === 'adjustment' ? delta : qty, reason: reason.trim() || null, reference: reference.trim() || null }
    const signature = JSON.stringify(input)
    const submitKey = lastSignature && lastSignature !== signature ? crypto.randomUUID() : key
    if (submitKey !== key) setKey(submitKey)
    setLastSignature(signature)
    const complete = (result: MovementResult) => {
      toast.push({ kind: 'success', text: `Operación ${result.operation_id} · nuevo saldo ${formatQuantity(Number(result.balance), unit)}.` })
      onClose()
    }
    try {
      complete(await mutation.mutateAsync({ key: submitKey, ...input }))
    } catch (err) {
      // Si el servidor confirmó y la respuesta se perdió, recuperar por la misma clave.
      const lookup = await supabase.from('operations').select('result').eq('idempotency_key', submitKey).maybeSingle()
      if (lookup.data?.result) {
        complete(lookup.data.result as MovementResult)
      } else {
        setError(messageFor(err))
      }
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Movimiento · ${row.branch_name}`}>
      <p className="mb-4 text-sm text-muted">{product.name} · {product.sku} · saldo actual {formatQuantity(Number(row.balance), unit)}</p>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Select label="Tipo" value={type} onChange={(e) => setType(e.target.value as MovementType)}
          options={TYPE_OPTIONS.filter((option) => isAdmin || !['purchase', 'adjustment'].includes(option.value))} />
        {canUsePackages && (
          <fieldset className="flex gap-4 text-sm">
            <legend className="sr-only">Modo de carga</legend>
            <label><input type="radio" checked={mode === 'qty'} onChange={() => setMode('qty')} /> Cantidad</label>
            <label><input type="radio" checked={mode === 'packages'} onChange={() => setMode('packages')} /> Envases</label>
          </fieldset>
        )}
        {type === 'adjustment' && (
          <Select label="Ajuste" value={direction} onChange={(e) => setDirection(e.target.value as 'add' | 'subtract')}
            options={[{ value: 'add', label: 'Sumar al saldo' }, { value: 'subtract', label: 'Restar del saldo' }]} />
        )}
        <Input label={mode === 'packages' && canUsePackages ? `Envases (${formatQuantity(Number(product.presentation_qty), unit)} cada uno)` : `Cantidad (${UNIT_LABEL[unit]})`}
          value={qtyText} onChange={(e) => setQtyText(e.target.value)} inputMode={unit === 'unit' || mode === 'packages' ? 'numeric' : 'decimal'}
          hint={unit === 'unit' || mode === 'packages' ? 'Solo enteros.' : 'Hasta dos decimales, por ejemplo 25,50.'} autoFocus />
        <Input label={type === 'shrinkage' || type === 'adjustment' ? 'Motivo (obligatorio)' : 'Motivo (opcional)'}
          value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
        <Input label="Proveedor o referencia (opcional)" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} />
        <div className="rounded-control border border-hairline bg-canvas p-3 text-sm" aria-live="polite">
          {mode === 'packages' && canUsePackages && parsed.ok && <p>{qtyText} envases = {formatQuantity(qty, unit)}</p>}
          <p>Saldo propuesto: <strong>{parsed.ok ? formatQuantity(nextBalance, unit) : '—'}</strong></p>
          {parsed.ok && nextBalance < 0 && <p className="text-carmine-fg">La salida supera el saldo disponible.</p>}
          {parsed.ok && nextBalance >= 0 && nextBalance <= Number(row.min_qty) && <p className="text-amber-fg">Quedará bajo mínimo.</p>}
        </div>
        {error && <p role="alert" className="text-sm text-carmine-fg">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
          <Button type="submit" disabled={mutation.isPending || !online || !valid}>{mutation.isPending ? 'Registrando…' : 'Confirmar movimiento'}</Button>
        </div>
      </form>
    </Dialog>
  )
}
