# K66 Rondas

MVP de rondas de seguridad con QR. Este repositorio reúne la base Next.js, el sistema visual y el esquema inicial de Supabase. El flujo operativo completo se implementará en las fases siguientes de la [guía del proyecto](docs/GUIA_MVP.md).

## Arranque de la web

Requisitos: Node.js 22+, pnpm 12+.

```bash
pnpm install
pnpm dev
```

Abrir `http://localhost:3000` y `/styleguide`. Copiar `.env.example` a `.env.local` cuando se conecten las rutas de autenticación y datos; completar las claves desde Supabase sin subir ese archivo a Git.

## Base de datos

La migración inicial está en `supabase/migrations/` y los datos ficticios locales en `supabase/seed.sql`. El proyecto remoto es `jabzdyiaagrygcqwbzxv`. La migración y el bucket privado `visit-photos` ya se aplicaron al proyecto remoto con Supabase CLI. El MCP de Codex permanece en modo de solo lectura.

En Windows, `supabase start` requiere Docker Desktop o un runtime compatible. Con el CLI y Docker disponibles:

```bash
pnpm exec supabase start
pnpm exec supabase db reset
pnpm exec supabase seed buckets --yes
pnpm exec supabase db query --file supabase/tests/phase1.sql
```

Los datos operativos no usan RLS en este MVP. La migración retira los permisos de Data API de `anon` y `authenticated`; las futuras rutas Next.js serán la única entrada a las tablas. El repositorio GitHub es público, pero las claves secretas y los datos de la planta no lo son.

## Comprobaciones

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

GitHub Actions ejecuta estas comprobaciones y recrea la base local en un runner Linux con Docker. En esta estación Windows no hay Docker instalado, por lo que la verificación local del esquema depende de ese runner. El esquema remoto sí se verificó tras la migración: 16 tablas operativas, RLS desactivado y acceso directo revocado para `anon` y `authenticated`.
