# Roadmap

## Phase 0 — Foundation

- [x] Initialize Next.js with TypeScript and App Router
- [x] Configure Tailwind CSS and ESLint
- [x] Add project documentation and environment template
- [x] Verify linting and production build

## Phase 1 — Client storage milestone (complete)

- [x] Build the responsive Client Business Details Form
- [x] Add server-side payload validation
- [x] Configure OpenNext for Cloudflare Workers
- [x] Configure the local D1 `DB` binding
- [x] Add the initial `clients` migration
- [x] Persist clients through the API into D1
- [x] Add the D1-backed Clients page
- [x] Verify invalid requests, save/read persistence, lint, and builds locally
- [x] Apply the additive schema migrations to the remote production D1 database
- [x] Persist generated websites, publication state, and domain setup state in D1
- [x] Route published client websites through one shared Cloudflare Worker
- [x] Integrate Hostinger portfolio/availability checks and nameserver operations
- [x] Integrate Cloudflare zone, DNS, Worker custom-domain, and HTTPS checks
- [x] Support apex/www custom-domain state and optional public Meta TXT detection

## Phase 2 — Operational hardening

- Configure and verify owner-only Cloudflare Access on the admin hostname.
- Add role-aware access to client records.
- Add structured logging and error reporting.
- Add audit history for changes to client data.
- Add server-side configuration validation for deployment environments.

## Phase 3 — Deferred integrations and operations

- Add provider sandbox tests where available.
- Introduce deployment-safe credential handling and provider sandbox tests.

## Phase 4 — File storage and operations

- Add R2 for logo and other client asset storage.
- Add idempotent provisioning and safe re-runs.
- Add observability for workflow duration and failure rates.
- Document deployment, recovery, and support procedures.

AgentRouter AI and R2/logo storage remain intentionally deferred from the current non-AI production milestone.
