# Roadmap

## Phase 0 — Foundation

- [x] Initialize Next.js with TypeScript and App Router
- [x] Configure Tailwind CSS and ESLint
- [x] Add project documentation and environment template
- [x] Verify linting and production build

## Phase 1 — Client storage milestone (current)

- [x] Build the responsive Client Business Details Form
- [x] Add server-side payload validation
- [x] Configure OpenNext for Cloudflare Workers
- [x] Configure the local D1 `DB` binding
- [x] Add the initial `clients` migration
- [x] Persist clients through the API into D1
- [x] Add the D1-backed Clients page
- [x] Verify invalid requests, save/read persistence, lint, and builds locally
- [ ] Replace the local-only D1 placeholder with a remote production database during deployment setup

## Phase 2 — Secure application infrastructure

- Choose authentication and authorization requirements.
- Add role-aware access to client records.
- Add structured logging and error reporting.
- Add audit history for changes to client data.
- Add server-side configuration validation for deployment environments.

## Phase 3 — Provider integrations

- Add provider adapters one at a time behind typed interfaces.
- Add Hostinger and domain workflows only after the product workflow is defined.
- Add OpenAI, Meta, and WhatsApp integrations only when their use cases are approved.
- Introduce deployment-safe credential handling and provider sandbox tests.

## Phase 4 — File storage and operations

- Add R2 for logo and other client asset storage.
- Add idempotent provisioning and safe re-runs.
- Add observability for workflow duration and failure rates.
- Document deployment, recovery, and support procedures.

The roadmap intentionally keeps provider integrations and remote infrastructure setup out of this milestone.
