# Modelo entidad–relación (MER)

Este directorio documenta el esquema PostgreSQL del proyecto según las migraciones de `supabase/migrations` en el commit `270a045e965ee6c3653f35fde4b7dffd381124e8`.

| Archivo | Contenido |
| --- | --- |
| [`mer-stock.html`](mer-stock.html) | Diagrama interactivo creado con Archify. Presenta las 14 entidades (13 tablas propias y `auth.users`), las relaciones principales y las restricciones que completan su lectura. |
| [`mer-stock.archify.json`](mer-stock.archify.json) | Especificación editable del diagrama Archify, con referencias a las migraciones SQL. |
| [`mer-detallado.html`](mer-detallado.html) | Modelo físico complementario con las 39 claves foráneas, cardinalidades y atributos principales. |
| [`MER-stock-peluquerias.svg`](MER-stock-peluquerias.svg) | Vista vectorial del modelo detallado. |
| [`MER-stock-peluquerias.dot`](MER-stock-peluquerias.dot) | Fuente Graphviz de la vista vectorial. |

El diagrama Archify simplifica las conexiones repetidas hacia `chains` y las referencias por rol de `transfers` para que el mapa sea legible. La tabla del modelo detallado enumera todas las FK físicas. Las relaciones de `inventory` con alertas y conteos que aparecen en Archify son vínculos de negocio por sucursal y producto; no existe una FK directa a `inventory.id`.

Para ver cualquiera de los archivos HTML, descargalo o abrilo localmente en un navegador. No requieren servidor ni acceso a Supabase.

Para regenerar el diagrama Archify desde la raíz del repositorio, con la skill instalada:

```text
node <ruta-a-archify>/bin/archify.mjs finalize architecture docs/mer/mer-stock.archify.json docs/mer/mer-stock.html --repo-root . --quality showcase --json
```
