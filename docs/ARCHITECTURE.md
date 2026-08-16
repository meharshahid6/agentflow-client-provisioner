# Architecture

## Application foundation

The project is a Next.js App Router application configured for Cloudflare Workers through the official OpenNext adapter:

- `app/page.tsx` is the interactive client business form.
- `app/api/clients/route.ts` is the server API boundary for create/list operations.
- `app/clients/page.tsx` is the D1-backed saved clients page.
- `lib/clients/validation.ts` contains server-side input normalization and validation.
- `lib/clients/repository.ts` contains prepared D1 reads and writes.
- `migrations/` contains SQL migrations applied by Wrangler.
- `wrangler.jsonc` defines the Worker, asset, and `DB` D1 binding.
- `open-next.config.ts` configures the Cloudflare adapter.

The application remains server-first where possible. The form is a Client Component because it owns controlled inputs, dynamic services, file selection, and submit feedback.

## Request and data flow

```text
Client form state
  -> POST /api/clients
  -> validateClientInput()
  -> getCloudflareContext().env.DB
  -> prepared INSERT into clients
  -> created client + ID
```

The Clients page uses the same repository to read from D1. The GET API route is also available for programmatic reads.

## D1 data model

The `clients` table uses a text UUID primary key and ISO timestamps. Required business fields are constrained by application validation and SQLite `NOT NULL` columns. `services` is stored as JSON text so the current dynamic list remains simple without introducing a second table. Logo fields store metadata only (`name`, `type`, and `size`); file bytes are not persisted.

## Local and production configuration

Wrangler runs local D1 in `.wrangler/state`, separate from any remote database. The current `database_id` is an explicit all-zero placeholder so this milestone does not require a Cloudflare account or remote resource. Before deployment, replace it with a real D1 database ID and apply the migration remotely.

`initOpenNextCloudflareForDev()` enables binding access during `next dev`. `npm run preview` uses OpenNext plus Wrangler to exercise the Worker-compatible `workerd` runtime.

## Boundaries and security

- All writes pass through server-side validation; client validation is only user feedback.
- D1 writes use prepared statements and bound parameters.
- No provider API credentials are used.
- `.dev.vars`, `.env.local`, `.wrangler`, `.open-next`, and dependency folders are ignored.
- No logo storage service is configured; R2 remains a future milestone.

## Quality expectations

- TypeScript remains strict.
- ESLint runs cleanly.
- `next build` and the OpenNext preview build must pass.
- Integration code should keep explicit error handling and safe retry behavior as providers are introduced later.
