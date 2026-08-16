# Agentflow Client Provisioner

A client provisioning workspace built with Next.js, TypeScript, the App Router, Tailwind CSS, ESLint, OpenNext, and Cloudflare D1.

## Requirements

- Node.js 20.9 or newer
- npm 10 or newer

## Local development

Install dependencies, initialize the local D1 database, and start Next.js:

```bash
npm install
npm run d1:migrate:local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The local database state is persisted under `.wrangler/state` and is ignored by Git.

To run the app in the Cloudflare Workers-compatible runtime instead of the standard Next.js runtime:

```bash
npm run preview
```

The preview command builds with OpenNext and starts Wrangler locally, normally at [http://127.0.0.1:8787](http://127.0.0.1:8787).

## Available scripts

- `npm run dev` — start the Next.js development server
- `npm run lint` — run ESLint
- `npm run build` — create a production Next.js build
- `npm run start` — serve the Next.js production build
- `npm run preview` — build and preview with OpenNext/Wrangler
- `npm run d1:migrate:local` — apply local D1 migrations
- `npm run d1:migrations:list` — list local migration status
- `npm run cf-typegen` — regenerate Cloudflare binding types
- `npm run deploy` — build and deploy to Cloudflare Workers when a remote D1 database is configured
- `npm run upload` — build and upload a Worker version

## Persistence

The first persistent milestone stores clients in the D1 binding named `DB`.

1. The form sends JSON to `POST /api/clients`.
2. The route validates the payload on the server.
3. A prepared D1 statement inserts the record into `clients`.
4. The response returns the created client and its ID.
5. `/clients` reads and displays saved records from D1.

Services are stored as a JSON array in SQLite. Logo bytes are not stored yet; only selected file metadata is persisted temporarily. R2 is intentionally not configured.

## Cloudflare setup

`wrangler.jsonc` contains a local-only D1 placeholder configuration. No remote Cloudflare account or production D1 database is required for local development.

Before deploying, replace the placeholder `database_id` in `wrangler.jsonc` with the ID of a real Cloudflare D1 database named for this Worker, then apply the migration remotely with Wrangler. Do not commit credentials or local `.dev.vars` files.

## Environment variables

`.dev.vars` is a local, ignored file containing only `NEXTJS_ENV=development`. `.env.example` remains available for future non-secret configuration. No API keys or provider credentials are required by this milestone.

## Project documentation

- [Project brief](docs/PROJECT_BRIEF.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)

## Current scope

Included: client business details, server validation, local/Cloudflare D1 persistence, and a saved Clients page.

Not included: Hostinger, domain purchasing, OpenAI, Meta, WhatsApp, R2 file storage, authentication, or remote production database provisioning.
