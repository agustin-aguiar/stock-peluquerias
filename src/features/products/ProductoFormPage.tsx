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
