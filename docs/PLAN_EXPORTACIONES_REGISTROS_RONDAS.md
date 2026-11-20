# Plan de implementación: filtros de evidencia y exportaciones Excel

Estado: **propuesta para revisión; implementación pendiente de `CONFIRMAR`**.

Rama: `codex/plan-exportaciones-registros-rondas`, basada en `develop`.

Fecha: 20 de noviembre de 2026.

## Objetivo y alcance

1. En **Administración → Registros**, filtrar visitas que tengan observación, fotografía o ambas y descargar **todos los resultados filtrados** en un archivo `.xlsx`.
2. En **Administración → Rondas**, descargar en `.xlsx` todas las rondas que cumplen los filtros visibles, con su resumen y el detalle de puntos esperados y visitados.
3. Mantener el CSV de Registros disponible para quienes ya lo usan. No se exportan los archivos de imagen dentro del libro; se indica si existe foto y se incluye un enlace autenticado al recurso cuando procede.
4. El acceso sigue limitado a admin y supervisor. Cada supervisor solo ve y exporta las garitas que tiene asignadas.

No se modificará el flujo de escaneo, ni la captura GPS, ni los permisos de la base de datos. No se requieren credenciales nuevas.

## Estado actual verificado

- `src/lib/admin/visits.ts` centraliza filtros de sede, garita, guardia, punto y fechas; la consulta obtiene observación y relación con `visit_photos`. Pagina 25 filas. Aún no filtra por presencia de evidencia.
- `src/app/(admin)/admin/visits/page.tsx` presenta esos filtros y enlaza a `src/app/api/admin/visits/export/route.ts`. La exportación existente es CSV y pagina el conjunto completo en lotes de 500.
- `src/lib/admin/rounds.ts` centraliza filtros de sede, garita, guardia, estado y fechas; consulta `patrols` y `patrol_progress`. Pagina 25 filas. `src/app/(admin)/admin/rounds/page.tsx` no ofrece exportación.
- `visit_photos.visit_id` es único. La foto se sirve por `GET /api/visits/[id]/photo`, que verifica sesión y alcance del supervisor. `patrol_expected_points` conserva nombres históricos de punto y área.
- No hay dependencia de creación de `.xlsx` instalada.

## Contrato de producto

### Registros

Nuevo selector **Evidencia** con cinco opciones:

| Valor | Texto visible | Regla |
| --- | --- | --- |
| `all` | Todos | Sin filtro de evidencia |
| `note` | Con observación | Observación no vacía tras quitar espacios |
| `photo` | Con fotografía | Existe foto asociada |
| `any` | Con observación o fotografía | Al menos una de las dos |
| `both` | Con observación y fotografía | Las dos |

El selector se combina con sede, garita, guardia, punto y fechas. Contador, paginación, CSV y Excel deben mostrar el mismo conjunto y orden (`recorded_at` descendente, `id` descendente). Cambiar el filtro reinicia a la primera página. El botón dirá **Exportar Excel** y el CSV seguirá como opción secundaria.

Hoja **Registros**: ID, fecha y hora local, zona horaria, sede, garita, código y nombre del guardia, punto, área, observación, foto adjunta (Sí/No), enlace autenticado a foto, estado GPS, latitud, longitud, precisión, fecha de captura GPS e IP pública. Una visita ocupa una fila. Se aplicarán cabeceras, autofiltro, primera fila inmóvil y anchos legibles. Las fechas tendrán contexto de zona horaria; los valores que empiezan por `=`, `+`, `-` o `@` se escribirán como texto para que Excel no los ejecute.

### Rondas

Se agrega **Exportar Excel** junto a los filtros actuales. El archivo contiene dos hojas:

- **Rondas**: ID, sede, garita, guardia/código, estado, inicio y cierre locales, duración en minutos (vacía si está en curso), motivo de cierre, puntos esperados/visitados, puntos obligatorios/visitados y porcentaje de cobertura. Para rondas abiertas la duración se calcula contra una hora de corte fija del archivo y se etiqueta como tiempo transcurrido.
- **Puntos**: ID de ronda, orden, nombre histórico de punto y área, obligatorio (Sí/No), visitado (Sí/No), fecha/hora de la visita y enlace a detalle de ronda. Se usa `patrol_expected_points` para que un cambio posterior del catálogo no altere el reporte histórico.

Ambas hojas representan **todas** las rondas que cumplen los filtros, no solo la página actual. Las fechas se interpretan igual que en pantalla: inicio de ronda en zona horaria de la sede. El libro incluye una pequeña hoja **Criterios** con filtros, zona horaria, momento de corte y cantidad de resultados. Si no hay resultados, descarga un libro con cabeceras y mensaje de cero filas, sin error de servidor.

## Diseño técnico propuesto

```text
Pantallas admin (Registros / Rondas)
  └─ URLSearchParams validados → consultas compartidas con alcance de actor
       ├─ pantalla: 25 filas + total
       ├─ CSV Registros actual: lotes de 500
       └─ rutas XLSX: lotes de 500 → generador Excel solo en servidor
            └─ respuesta .xlsx; Cache-Control: private, no-store
```

1. **Filtro en SQL, antes de paginar.** Agregar mediante migración a `visits` dos indicadores consultables: `has_observation`, calculado a partir de `nullif(btrim(note), '')`, y `has_photo`, retroalimentado por backfill y un trigger `AFTER INSERT/DELETE/UPDATE OF visit_id` en `visit_photos`. Esto evita filtrar solo las 25 filas cargadas y evita inconsistencias si se agrega una foto después del registro. La migración debe ser idempotente donde corresponda y preservar registros históricos. Evaluar índices parciales con `EXPLAIN` antes de añadirlos.
2. **Consulta única por módulo.** Extender `VisitFilters`, `parseVisitFilters`, `visitSearchParams` y `visitQuery` para el selector. Reutilizar `visitQuery` tanto en pantalla como en CSV/XLSX. Exponer internamente la construcción de consulta de rondas para que página y exportación usen exactamente los mismos predicados y orden. Los parámetros `page` se ignoran al exportar, pero el resto se conserva.
3. **Generación Excel.** Agregar `exceljs` como dependencia solo del servidor. Su API permite libros con varias hojas, estilos básicos y escritura `.xlsx`. Cargarlo únicamente desde rutas del servidor; no incluirlo en el bundle del guardia. Las consultas se paginan en lotes para respetar el límite de filas de Supabase. Definir un límite inicial de 10 000 registros o 2 000 rondas / 20 000 filas de puntos por archivo, medido sobre el conjunto filtrado antes de empezar a generar; si se excede, devolver un mensaje que pida acotar fechas o sede. Estos números son guardas de memoria de Vercel, no límites de datos en la base.
4. **Rutas y permisos.** Nueva ruta `GET /api/admin/visits/export/xlsx` y `GET /api/admin/rounds/export/xlsx` (nombre final consistente con las rutas actuales). Ambas usan `apiActor(["admin", "supervisor"])`, `getVisitScope`/`getRoundScope`, validan filtros y nunca aceptan IDs de garita fuera del alcance. El mismo enlace autenticado de foto se construye a partir de la URL de la aplicación y `/api/visits/[id]/photo`; abrirlo exige sesión vigente. Respuesta con MIME de XLSX, `Content-Disposition: attachment` y `private, no-store`.
5. **Interfaz.** Selector de evidencia accesible por teclado y táctil en Registros. Botones de exportación con estado claro cuando no hay resultados o filtros inválidos. En Rondas, botón en el encabezado o junto al resultado, visible en móvil y escritorio. Etiquetas claras para explicar que la descarga incluye todas las páginas filtradas.

## Tickets propuestos, en orden

| Ticket | Trabajo | Entregable y aceptación |
| --- | --- | --- |
| EX-01 | Migración de indicadores de evidencia, backfill y trigger de foto | Los registros antiguos quedan clasificados; agregar/quitar foto y editar observación actualiza los indicadores; sin duplicados por visita. |
| EX-02 | Filtro de evidencia en consulta y pantalla de Registros | Las cinco opciones combinan con los filtros existentes; total/páginas y resultados concuerdan; CSV conserva los mismos filtros. |
| EX-03 | Exportación XLSX de Registros | Archivo abre en Excel/LibreOffice; cabeceras y fechas correctas; incluye todas las páginas filtradas y marca foto; respeta rol/scope. |
| EX-04 | Consulta reutilizable y exportación XLSX de Rondas | Dos hojas más criterios, resumen/progreso y puntos históricos; todas las páginas filtradas; duraciones y cobertura correctas; respeta rol/scope. |
| EX-05 | Verificación integral y despliegue | Pruebas automatizadas, descarga manual en móvil/escritorio, lint/typecheck/test/build; migración aplicada antes del despliegue de la app y smoke test en Vercel. |

## Pruebas y criterios de salida

- Datos de prueba con visita sin evidencia, solo nota, solo foto y ambas; comprobar `all`, `note`, `photo`, `any`, `both`, nota con espacios, observación añadida después y fotografía subida después.
- Varios resultados y varias páginas: mismo número de filas en pantalla/CSV/XLSX para un filtro, sin omisiones ni duplicados, orden estable incluso con marcas de tiempo iguales.
- Supervisor con dos garitas asignadas y una no asignada: la tercera nunca aparece en pantalla ni en archivos, aunque manipule la URL. Guardia recibe 403 en ambas rutas.
- Fechas cerca de medianoche de Guatemala y sedes con otra zona horaria; filtros `from`/`to` y formato de exportación coinciden con la UI.
- Rondas completas, incompletas y abiertas; puntos obligatorios/opcionales; catálogo renombrado después de la ronda; progreso exportado coincide con `patrol_progress` y detalle actual.
- XLSX se abre, tiene 3 hojas en Rondas, cabeceras/autofiltro, celdas de observación tratadas como texto, enlaces a foto protegidos, archivo vacío válido y rechazo claro cuando supera el límite.
- Pasar `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` y las pruebas E2E relevantes de administración. Medir tiempo y memoria de una exportación cerca del límite antes de publicar.

## Orden de entrega y operación

1. Tras `CONFIRMAR`, implementar EX-01 a EX-05 en esta rama y actualizar el PR.
2. Revisar el SQL y aplicar la migración en Supabase. La app actual seguirá funcionando mientras se despliega la nueva versión.
3. Desplegar la versión de Vercel, verificar con admin y supervisor los filtros y dos descargas reales; comprobar que CSV sigue funcionando.
4. Hacer merge del PR a `develop` cuando código, datos y verificación estén completos. La publicación a `main`/producción se coordinará según el flujo existente.

## Fuentes técnicas consultadas

- [Supabase: filtros con `or`](https://supabase.com/docs/reference/javascript/using-filters-or): `.or()` no opera entre tablas distintas; los dos indicadores en `visits` permiten una sola consulta paginable.
- [Supabase: relaciones y `!inner`](https://supabase.com/docs/guides/database/joins-and-nesting): referencia para conservar el comportamiento de los joins actuales.
- [ExcelJS, repositorio oficial](https://github.com/exceljs/exceljs): API de creación de `.xlsx` y hojas múltiples.
