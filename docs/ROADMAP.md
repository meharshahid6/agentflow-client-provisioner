# Roadmap

## Phase 0 — Foundation (current)

- [x] Initialize Next.js with TypeScript and App Router
- [x] Configure Tailwind CSS
- [x] Configure ESLint
- [x] Add project documentation and environment template
- [x] Verify linting and production build

## Phase 1 — Product skeleton

- Define the first end-to-end provisioning workflow.
- Add the client and provisioning domain models.
- Create the initial dashboard and workflow screens.
- Add form validation and clear workflow states.

## Phase 2 — Secure application infrastructure

- Choose authentication and authorization requirements.
- Choose persistence and an audit-history strategy.
- Add server-side configuration validation.
- Add structured logging and error reporting.

## Phase 3 — Provider integrations

- Add provider adapters one at a time behind typed interfaces.
- Introduce credential handling through deployment-safe secret storage.
- Add provider health checks, timeouts, retries, and actionable errors.
- Test integration behavior with mocks and provider sandbox accounts where available.

## Phase 4 — Operational readiness

- Add idempotent provisioning and safe re-runs.
- Add role-aware approvals for sensitive actions.
- Add observability for workflow duration and failure rates.
- Document deployment, recovery, and support procedures.

The roadmap is intentionally sequenced so product workflow and security decisions are established before external APIs or real credentials are introduced.
