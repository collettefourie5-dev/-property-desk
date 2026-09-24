# The Property Desk

Booking + intake website for the Pre-Sale Property Strategy Session offering: ad-angle landing
pages, a multi-step intake wizard whose completed booking request is emailed to the attorney, and
Meta Pixel/Conversions API tracking so ad spend is measurable. There is no online payment — the
session fee is arranged directly, and the admin marks it paid on the booking.

Status: in progress. This README documents what exists today and is updated as each build stage
lands (see the implementation plan for the full stage list).

## Architecture

- **Next.js 16** (App Router, TypeScript strict) — Server Components by default, business logic
  kept out of UI components.
- **Better Auth** + **Prisma 7** + **PostgreSQL** — protects only the internal/admin area (staff
  login, roles, audit log). The public booking flow is anonymous/tokenized, not behind a login.
- **Docker-first**: the same application image runs in local dev, TEST, and PRODUCTION. Only
  environment variables differ between them — nothing environment-specific is hard-coded.

```
UI (src/app, src/components)
  -> Server Actions / Route Handlers (Zod validation, requireAuth/requireRole)
    -> src/server/services (business logic)
      -> Prisma -> PostgreSQL
```

## Local development

Prerequisites: Node.js 24+, npm, and either a local PostgreSQL 18 instance or Docker.

1. `cp .env.example .env` and fill in `BETTER_AUTH_SECRET` (`openssl rand -base64 32`) and a
   `DATABASE_URL` you can reach.
2. Start Postgres: `docker compose up postgres -d` (or point `DATABASE_URL` at your own instance).
3. `npm install` (also runs `prisma generate` via `postinstall`).
4. `npm run prisma:migrate:dev` to create the database schema.
5. `npm run dev` and open http://localhost:3000.

Alternatively, `docker compose up` runs Postgres **and** the app (in dev mode, with your working
directory bind-mounted) together — closest to how TEST/PRODUCTION run, without a full image build.

## Environment variables

See [`.env.example`](.env.example), [`.env.test.example`](.env.test.example), and
[`.env.production.example`](.env.production.example) for the full, documented list. All required
variables are validated at server startup (`src/lib/env.ts`, invoked from
`src/instrumentation.ts`) — the server refuses to start with missing/invalid configuration rather
than falling back to insecure defaults. `APP_ENV=production` additionally requires the storage and
email variables needed for a real deployment (a real `EMAIL_DRIVER` and `ADMIN_NOTIFICATION_EMAIL`,
because booking requests are delivered by email); `next build` itself needs no secrets at
all (verified — a build with a completely empty environment succeeds).

## Booking request emails

When a client submits the booking form, the request is saved and then emailed to
`ADMIN_NOTIFICATION_EMAIL` (reply-to is the client, so you can answer straight from your inbox),
and the client gets a short receipt. The email contains every answer plus a link to the booking
in `/admin/bookings`, where uploaded documents are downloaded (admin-only, every download is
audit-logged). If delivery fails the booking is **not** lost: it shows as "Not sent" in the admin
list with a **Resend email** button.

- **Local development:** `docker compose up -d mailpit`, then open http://localhost:8026 — every email
  is caught there instead of being sent. Set `EMAIL_DRIVER=smtp`, `SMTP_HOST=localhost`, `SMTP_PORT=1026`.
- **TEST/PRODUCTION:** set `EMAIL_DRIVER=resend` (+ `RESEND_API_KEY` and a verified sending domain)
  **or** `EMAIL_DRIVER=smtp` (host/port/user/password — e.g. Gmail SMTP with an App Password), plus
  `EMAIL_FROM` and `ADMIN_NOTIFICATION_EMAIL`. Production refuses to start with `EMAIL_DRIVER=console`.

## Database

PostgreSQL via Prisma 7 (the pure-TypeScript, driver-adapter based client — no native query-engine
binary). Schema lives in [`prisma/schema.prisma`](prisma/schema.prisma); connection/migration
config lives in [`prisma.config.ts`](prisma.config.ts) (Prisma 7 moved datasource URLs out of the
schema file itself).

- `npm run prisma:migrate:dev` — create/apply a migration locally (dev only).
- `npm run prisma:migrate:deploy` — apply existing migrations without prompting (used by CI and
  both deploy scripts; **never** run `prisma migrate reset` or `db push` against TEST/PRODUCTION).
- `npm run prisma:studio` — browse the database locally.
- `npm run db:seed` — safe, idempotent dev/test seed data (never run against production).

## Authentication

Better Auth protects the internal/admin area only (`/admin/**`) — the public booking pages and
wizard never require an account. Roles are `USER`/`ADMIN`, stored as additional fields on Better
Auth's `User` model rather than a duplicate table. Authorization is enforced server-side via
`requireAuth()`/`requireRole()` helpers (`src/lib/permissions`) on every protected Server Action
and Route Handler — never by hiding UI alone.

## Testing

- `npm test` — Vitest unit/integration tests (`src/**/*.test.ts`).
- `npm run test:coverage` — with coverage.
- `npm run test:e2e` — Playwright end-to-end tests (`e2e/`), against a production build.

Tests never run against the production database — CI provisions its own disposable Postgres
service container, and local/E2E runs use `DATABASE_URL` from your own `.env`.

## Docker

- `Dockerfile` — multi-stage, `output: 'standalone'` Next.js build, non-root runtime user, no
  secrets baked into any layer (build-time env is empty by design; only non-secret version
  metadata — `APP_VERSION`/`GIT_COMMIT`/`GIT_TAG`/`BUILD_TIME` — is passed as build args).
- `docker-compose.yml` — local dev: Postgres + the app running `next dev` with your working
  directory bind-mounted.
- `docker-compose.test.yml` / `docker-compose.prod.yml` — build the production image, private
  Docker network, persistent named Postgres volume, health checks, `restart: unless-stopped`.
  Postgres is never exposed publicly in either.

## TEST deployment

On the TEST VM, inside a checkout of this repo with `.env.test` present (copy from
`.env.test.example` and fill in real values):

```bash
./scripts/deploy-test.sh <branch|tag|commit>
```

Builds the image, starts the stack, waits for Postgres, runs `prisma migrate deploy`, waits for
`/api/health/ready`, and prints the deployed version. The `postgres_test_data` volume is never
dropped or reset.

## Release process

1. Merge to `main` once CI is green and the change has been validated on TEST.
2. Tag a release: `git tag v1.2.0 && git push origin v1.2.0` (semantic versioning).
3. Promote that exact tag to production (see below).

## Production deployment

Requires an **explicit, existing Git tag** — never a branch or arbitrary commit. On the
PRODUCTION VM, inside a checkout of this repo with `.env.production` present:

```bash
./scripts/deploy-production.sh v1.2.0
```

The script validates the tag exists, requires you to re-type it to confirm, builds the image,
runs `prisma migrate deploy` (never a destructive operation), waits for readiness, and verifies
the deployed `/api/version` actually reports the requested tag. It never runs automatically from
a Git push — production is always an intentional, confirmed promotion of a known-tested version.

## Rollback

Application rollback is the same command with an older tag:

```bash
./scripts/deploy-production.sh v1.1.0
```

Database rollback is a separate concern — Prisma migrations are forward-compatible by design
(expand/contract pattern); this script never auto-reverses a migration.

## Database backups

TODO once the PRODUCTION VM is provisioned: document the actual backup mechanism (e.g. a nightly
`pg_dump` from inside the `postgres` container to off-machine storage), retention, and a tested
restore procedure. Losing the VM must never mean losing the database.

## Observability

- `GET /api/health` — liveness (process is up).
- `GET /api/health/ready` — readiness (verifies Postgres connectivity).
- `GET /api/version` — deployed version/commit/tag/environment (no secrets).
- Structured JSON logs (`src/lib/logging`) with a per-request correlation id (`x-request-id`, set
  in `src/proxy.ts` and propagated through `headers()`), redacting anything that looks like a
  credential before it's written. Centralized server error logging via Next's `onRequestError`
  instrumentation hook.

## Troubleshooting

- **Server won't start, "Invalid environment configuration"**: check the listed variables against
  `.env.example` — this is `src/lib/env.ts` failing fast on purpose rather than starting with
  broken config.
- **`/api/health/ready` returns 503**: Postgres isn't reachable — check `DATABASE_URL` and that
  the `postgres` container/service is healthy (`docker compose ps`).
- **Vitest prints an ESM/CommonJS config-loader warning**: harmless, from `vitest.config.ts` not
  being an `.mjs` file; does not affect test correctness.
