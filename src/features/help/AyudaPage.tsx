import { PageHeader } from '@/components/ui/PageHeader'

const steps = [
  ['1. Preparar productos', 'El administrador crea la cadena y los locales, invita a sus encargados y carga los productos. Puede asignar una primera cantidad desde Inventario.'],
  ['2. Registrar lo que pasa', 'Cada local anota entradas, ventas, consumo interno y pérdidas. El sistema actualiza la cantidad disponible.'],
  ['3. Pedir a otro local', 'Un local puede pedir incluso un producto que todavía no tiene cargado. El administrador elige qué otro local podría enviarlo. Si ese local no puede, el administrador puede elegir otro.'],
  ['4. Confirmar llegada', 'Cuando el local que envía acepta, la cantidad sale de su stock. El local que recibe confirma la llegada en “Envíos entre locales” y recién entonces se suma a su stock.'],
]

const terms = [
  ['Stock disponible', 'Cantidad que figura hoy en el local y que se puede usar o enviar.'],
  ['Stock mínimo', 'Cantidad que el local quiere mantener como reserva. Al llegar a ese valor aparece un aviso.'],
  ['Primera carga', 'Cantidad con la que se empieza a controlar un producto en un local. Se registra una sola vez.'],
  ['Consumo interno', 'Producto usado para trabajar en el salón, por ejemplo 25 ml de shampoo.'],
  ['Pérdida o merma', 'Producto que ya no se puede usar por derrame, daño u otra causa. Hay que anotar el motivo.'],
  ['Ajuste', 'Corrección de una cantidad equivocada. Solo puede hacerlo el administrador y queda registrada.'],
  ['Conteo físico', 'Cantidad que se encuentra al contar el producto en el local. El administrador revisa la diferencia con el sistema.'],
  ['Código del producto', 'Identificador interno que ayuda a distinguir productos parecidos. En archivos puede aparecer como SKU.'],
  ['Archivo CSV', 'Planilla de texto para cargar muchos productos o descargar el inventario de una vez.'],
]

export function AyudaPage() {
  return <>
    <PageHeader eyebrow="Guía rápida" title="Cómo usar el sistema" description="Los pasos principales y una explicación simple de las palabras que aparecen en las pantallas." />
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold">De la carga a la recepción</h2>
      <ol className="grid gap-3 md:grid-cols-2">{steps.map(([title, detail]) => <li key={title} className="rounded-lg border border-hairline bg-surface p-4">
        <h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm text-muted">{detail}</p>
      </li>)}</ol>
    </section>
    <section>
      <h2 className="mb-3 text-lg font-semibold">Qué significa cada cosa</h2>
      <dl className="grid gap-3 md:grid-cols-2">{terms.map(([term, meaning]) => <div key={term} className="rounded-lg border border-hairline bg-surface p-4">
        <dt className="font-semibold">{term}</dt><dd className="mt-1 text-sm text-muted">{meaning}</dd>
      </div>)}</dl>
    </section>
  </>
}
