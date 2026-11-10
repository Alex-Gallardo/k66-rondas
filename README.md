# K66 Rondas

MVP de rondas de seguridad con QR. El repositorio contiene la base Next.js, el sistema visual, la configuración administrativa, turnos y rondas (T-11) y el registro transaccional de visitas por API (T-12). El lector de cámara y la evidencia opcional siguen en T-13 a T-16 de la [guía del proyecto](docs/GUIA_MVP.md).

## Arranque de la web

Requisitos: Node.js 22+, pnpm 12+.

```bash
pnpm install
pnpm dev
```

Abrir `http://localhost:3000`, `/login` y `/styleguide`. Copiar `.env.example` a `.env.local`, completar la clave publicable y la clave secreta desde Supabase y mantener ese archivo fuera de Git. La clave secreta solo se usa en el servidor. Configurar `APP_BASE_URL` con el dominio HTTPS definitivo **antes de imprimir QR para la planta**; `localhost` sirve únicamente para desarrollo.

## Primer administrador

La cuenta inicial **no se crea automáticamente**. Cuando se conozca la persona responsable, aplicar las migraciones y ejecutar este comando una vez con su nombre y código de empleado:

```powershell
$env:BOOTSTRAP_ADMIN_CODE = 'CODIGO-REAL'
$env:BOOTSTRAP_ADMIN_NAME = 'Nombre Apellido'
pnpm bootstrap:admin
```

El comando genera una contraseña temporal, la muestra una sola vez en la terminal y exige cambiarla en el primer ingreso. Entregarla en persona. Después, el panel `/admin/users` permite dar de alta las demás cuentas personales y asignarlas a varias garitas. El alta pública de usuarios permanece desactivada.

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
```

Los datos operativos no usan RLS en este MVP. Las migraciones retiran los permisos de Data API de `anon` y `authenticated` a tablas y funciones operativas; las rutas Next.js son la entrada a los datos. El repositorio GitHub es público, pero las claves secretas y los datos de la planta no lo son. Los scripts `prepare-ci-env` y `seed-ci-users` se niegan a apuntar a un Supabase remoto.

## Comprobaciones

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

GitHub Actions ejecuta estas comprobaciones y recrea la base local en un runner Linux con Docker. En esta estación Windows no hay Docker instalado, por lo que la verificación local del esquema depende de ese runner. El esquema remoto sí se verificó tras la migración: 16 tablas operativas, RLS desactivado y acceso directo revocado para `anon` y `authenticated`.
