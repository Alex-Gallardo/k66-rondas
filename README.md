# K66 Rondas

MVP de rondas de seguridad con QR. El guardia inicia sesión y entra directamente a `/app`: un botón abre la cámara, identifica el punto, inicia turno y ronda automáticamente cuando solo tiene una garita y una plantilla, y guarda la visita con hora del servidor. Puede añadir observación o foto y consultar su historial. La [guía del proyecto](docs/GUIA_MVP.md) conserva el plan completo.

## Arranque de la web

Requisitos: Node.js 22+, pnpm 12+.

```bash
pnpm install
pnpm dev
```

Abrir `http://localhost:3000` (redirige a `/login`) y `/styleguide`. Copiar `.env.example` a `.env.local`, completar la clave publicable y la clave secreta desde Supabase y mantener ese archivo fuera de Git. La clave secreta solo se usa en el servidor. Configurar `APP_BASE_URL` con el dominio HTTPS definitivo **antes de imprimir QR para la planta**; `localhost` sirve únicamente para desarrollo.

## Demostración inmediata

Con las migraciones aplicadas, ejecutar `pnpm bootstrap:demo` una vez. Crea la cuenta personal `DEMO-001`, una garita, una ronda predeterminada y tres puntos QR. La contraseña aleatoria aparece solo al crear la cuenta; guardarla fuera del repositorio. Si se ejecuta de nuevo, el script conserva la contraseña y los registros existentes.

1. Abrir `/app/demo-qr` en una computadora con la cuenta demo para mostrar o imprimir las tres etiquetas.
2. Abrir la aplicación en el teléfono por HTTPS, ingresar con `DEMO-001` y tocar **Escanear QR**.
3. Escanear las etiquetas. Cada confirmación muestra el punto, el área, la hora y el avance. La observación y la foto son opcionales.
4. Revisar **Mi historial** y cerrar sesión antes de entregar el teléfono a otra persona.

Cada visita guarda la hora del servidor, las coordenadas y precisión GPS cuando el dispositivo las entrega, y la IP pública que observa Vercel. Si el guardia deniega la ubicación o el teléfono no responde a tiempo, la visita se guarda igualmente y muestra “GPS: permiso denegado” o “GPS: no disponible”. La IP no equivale a la ubicación física del guardia. Los registros anteriores al despliegue de T-17 no tienen IP histórica.

La cámara y la geolocalización requieren un origen seguro (`https://` o `localhost`). Si se abre un QR con la cámara nativa, `/scan/{codigo}` conserva el destino tras iniciar sesión.

### QR del PDF de seguridad (2021)

Los 12 QR existentes del PDF se han importado a la planta demo como **Punto 01** a **Punto 12**, en orden de lectura (izquierda a derecha y de arriba abajo). El documento no indica áreas, por lo que todos figuran en “QR existentes · ubicación por definir”. La ronda predeterminada de `DEMO-001` contiene estos 12 puntos. Abre la aplicación y toca **Escanear QR** para leer las etiquetas impresas: contienen un código de 16 caracteres, no un enlace web, así que la cámara nativa del teléfono no abre la aplicación. La vista `/app/demo-qr` muestra versiones equivalentes y sus códigos.

El PDF y sus códigos no se guardan en este repositorio público. Para repetir la importación en otro entorno, prepara un archivo JSON local con un arreglo de códigos en el mismo orden y ejecuta `pnpm import:demo-qrs RUTA_AL_JSON` después de `pnpm bootstrap:demo`. El importador valida unicidad y formato, y no cambia una asignación existente por otra.

## Publicación en Vercel

Importar el repositorio en Vercel con el preset Next.js. Configurar `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` y `APP_BASE_URL=https://DOMINIO-VERCEL` en las variables de entorno del proyecto, sin exponer la clave secreta con `NEXT_PUBLIC_`. Configurar el dominio de Vercel como **Site URL** y URL de redirección permitida en Supabase Auth. Desplegar y comprobar login, cámara, lectura de QR, historial y foto en un teléfono real. El manifiesto `/manifest.webmanifest` y los iconos permiten añadir la web al inicio.

## Primer administrador

La cuenta inicial **no se crea automáticamente**. Cuando se conozca la persona responsable, aplicar las migraciones y ejecutar este comando una vez con su nombre y código de empleado:

```powershell
$env:BOOTSTRAP_ADMIN_CODE = 'CODIGO-REAL'
$env:BOOTSTRAP_ADMIN_NAME = 'Nombre Apellido'
pnpm bootstrap:admin
```

El comando genera una contraseña temporal, la muestra una sola vez en la terminal y exige cambiarla en el primer ingreso. Entregarla en persona. Después, el panel `/admin/users` permite dar de alta las demás cuentas personales y asignarlas a varias garitas. El alta pública de usuarios permanece desactivada.

En `/admin/visits`, el administrador filtra registros por sede, garita, guardia, punto y fechas locales, abre el detalle con ubicación y evidencia, o exporta los mismos filtros a CSV. Los supervisores solo consultan visitas de sus garitas asignadas. En instalaciones con varias sedes, se debe seleccionar una sede antes de filtrar fechas para respetar su zona horaria.

En `/admin/rounds`, administrador y supervisor consultan rondas completas con filtros por sede, garita, guardia, estado y fecha local de inicio. El detalle conserva el orden y nombre original de cada punto, muestra visitados y pendientes, duración y motivo de cierre incompleto. Cada punto visitado enlaza a su registro con GPS e IP. Los supervisores solo ven rondas de sus garitas asignadas.

El inicio `/admin` muestra un dashboard por sede, garita y período local (hasta 90 días): visitas, rondas por estado, cobertura de puntos obligatorios, disponibilidad GPS, duración mediana/p90 y adopción de guardias actualmente asignados. Cada porcentaje muestra numerador y denominador; la gráfica usa los últimos 14 días del rango y una tabla permite revisar todos los días. El tiempo desde tocar «Escanear QR» y la tasa de guardado aparecen como métricas sin medición porque todavía no se registran todos los intentos del dispositivo.

## Base de datos

Las migraciones están en `supabase/migrations/` y los datos ficticios locales en `supabase/seed.sql`. El proyecto remoto es `jabzdyiaagrygcqwbzxv`. El MCP de Codex permanece en modo de solo lectura; los despliegues de migraciones se realizan con Supabase CLI.

En Windows, `supabase start` requiere Docker Desktop o un runtime compatible. Con el CLI y Docker disponibles:

```bash
pnpm exec supabase start
pnpm exec supabase db reset
pnpm exec supabase seed buckets --yes
pnpm exec supabase db query --file supabase/tests/phase1.sql
node scripts/prepare-ci-env.mjs RUTA_AL_ARCHIVO_DE_STATUS_ENV
node scripts/seed-ci-users.mjs
pnpm exec supabase db query --file supabase/tests/phase2.sql
pnpm exec supabase db query --file supabase/tests/phase3_t11.sql
pnpm exec supabase db query --file supabase/tests/phase3_t12.sql
pnpm exec supabase db query --file supabase/tests/t17.sql
pnpm exec supabase db query --file supabase/tests/t18.sql
pnpm exec supabase db query --file supabase/tests/t19.sql
```

Los datos operativos no usan RLS en este MVP. Las migraciones retiran los permisos de Data API de `anon` y `authenticated` a tablas y funciones operativas; las rutas Next.js son la entrada a los datos. El repositorio GitHub es público, pero las claves secretas y los datos de la planta no lo son. Los scripts `prepare-ci-env` y `seed-ci-users` se niegan a apuntar a un Supabase remoto. `bootstrap:demo` sí actúa sobre el proyecto configurado para preparar una presentación.

## Comprobaciones

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

GitHub Actions ejecuta estas comprobaciones y recrea la base local en un runner Linux con Docker. En esta estación Windows no hay Docker instalado, por lo que la verificación local del esquema depende de ese runner. El esquema remoto sí se verificó tras la migración: 16 tablas operativas, RLS desactivado y acceso directo revocado para `anon` y `authenticated`.
