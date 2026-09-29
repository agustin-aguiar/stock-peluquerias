# Guion de demo de 10 minutos

Estado: borrador para ensayar con cuentas de administrador y operador. No sustituye el piloto con personas ni la prueba de restauración.

## Preparación

1. Abrir [la aplicación publicada](https://stock-peluquerias.vercel.app) en dos sesiones distintas: administrador y operador de la sucursal destino. No mostrar contraseñas en pantalla.
2. Comprobar que ambas cuentas entran y que Supabase responde. Anotar los saldos de los dos productos que se usarán; los datos de la demo pueden haber cambiado desde el seed.
3. Elegir una materia prima con unidad ml o g y saldo suficiente para consumir. Elegir otro producto con saldo suficiente para transferir. Preparar una cantidad de salida superior al saldo para el error controlado.
4. Mantener abierto el historial de movimientos y el tablero en la sesión del administrador.

## Recorrido

| Tiempo | Acción | Qué mostrar |
|---|---|---|
| 0:00–1:00 | Presentar dos sucursales ficticias y el problema de controlar materias primas por local. | Cada local tiene su propio saldo; el catálogo es compartido. |
| 1:00–2:00 | Administrador abre Inventario y compara locales. | Saldos y mínimos por sucursal, sin sumar ml con unidades. |
| 2:00–3:00 | Pulsar **Asignar stock**, elegir sucursal, producto y cantidad o envases, revisar la vista previa y confirmar. | La carga ocurre desde Inventario. Primera carga habilita el producto; las siguientes suman un ingreso. |
| 3:00–4:00 | Operador registra un consumo fraccionado de 25,50 ml en su sucursal. | Nuevo saldo, alerta si corresponde e historial con número de operación. |
| 4:00–6:00 | Administrador crea y despacha una transferencia; operador destino la recibe. | El origen baja al despachar, la cantidad queda en tránsito y el destino sube al recibir. |
| 6:00–7:00 | Intentar una salida mayor que el saldo. | Rechazo claro y saldo intacto. |
| 7:00–8:30 | Administrador abre Tablero y Auditoría. | Faltantes, consumo por período y actor de los cambios. |
| 8:30–10:00 | Explicar transacciones, permisos por sucursal, pruebas y límites actuales. | 44 pruebas unitarias y 65 de integración verificadas; correo, piloto real, rendimiento y restauración siguen pendientes. |

## Si algo falla durante la presentación

- Si la red no responde, mostrar una captura o video del mismo recorrido y decir que es evidencia complementaria; no afirmar que la acción en vivo se completó.
- Si un saldo cambió desde la preparación, recalcular la cantidad antes de confirmar. No ejecutar el seed sobre la cadena publicada para recuperar valores sin revisar el impacto.
- Si una transferencia quedó abierta, resolverla desde el administrador antes de reutilizar el producto.

## Evidencia que falta recoger

- Tiempo real y resultado de un ensayo con ambos roles en dos sesiones.
- Recorrido por teclado y pantalla de 360 px con cuentas autenticadas.
- Capturas finales y enlace público verificado desde otro dispositivo.
- Resultado de restaurar una copia en otro entorno y medición de rendimiento con la carga definida en el plan.
