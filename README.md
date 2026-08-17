# Agentflow Client Provisioner

Agentflow Client Provisioner is an internal Next.js 16 application for managing clients, generating and publishing factual business websites, and coordinating domain setup through Hostinger and Cloudflare. It uses the App Router, TypeScript, Tailwind CSS, Cloudflare D1, OpenNext, and Wrangler.

## Implemented workflow

- Create, list, view, and edit clients in D1 without changing client IDs.
- Generate persisted website content with a deterministic, category-aware fallback.
- Optionally request content through the existing generic AI provider boundary. AgentRouter support is implemented, but live use is currently externally blocked by provider authentication; deterministic generation remains fully usable.
- Switch among `modern_business`, `professional_corporate`, and `local_service` without replacing saved content.
- Preview websites, readiness, logos, policies, FAQs, social links, SEO, and Open Graph data.
- Route live hostnames through one shared Worker to `/`, `/privacy`, and `/terms`; additional paths return 404.
- Track domain availability, ownership, purchase, Cloudflare, HTTPS, and Meta TXT state.
- View aggregate state in `/dashboard`, all clients in `/clients`, domains in `/domains`, and provider configuration in `/settings`.

## Local development

Requirements: Node.js 20.9+ and npm 10+.

```bash
npm install
npm run d1:migrations:list
npm run d1:migrate:local
npm run dev
```

Open `http://localhost:3000`. Local D1 data is retained under ignored `.wrangler/` state. Provider credentials are optional for client management, website generation, templates, previews, and deterministic content.

Worker-compatible local preview:

```bash
npm run preview
```

Wrangler normally serves the OpenNext build at `http://127.0.0.1:8787`.

## Database

The `DB` binding points to Cloudflare D1. Ordered SQL migrations in `migrations/` define:

- `clients`: business, contact, social, preferred-domain, logo metadata, and website status.
- `websites`: persisted configuration, selected template, readiness, and content source.
- `domains`: availability, ownership/purchase, zone, nameserver, Worker domain, HTTPS, and Meta DNS state.
- `integration_runs`: safe provider/system operation status without credentials or secret payloads.

Apply local migrations with `npm run d1:migrate:local`. Before production deployment, create a remote D1 database, replace the placeholder production database ID in `wrangler.jsonc`, and apply the same migrations remotely.

## Domain setup sequence

The setup panel enforces this order:

```text
Business details -> Website generated -> Domain availability
-> Domain ownership or explicit paid purchase
-> Cloudflare zone -> Hostinger nameservers -> Cloudflare zone active
-> Worker custom domain -> HTTPS ready -> Meta TXT -> Complete
```

Paid registration is never part of automatic Continue Setup. It requires the exact domain confirmation, provider purchase inputs, and a second explicit approval. A domain already found in the Hostinger portfolio follows the owned-domain path. Automated tests mock all provider writes and never buy a domain or create production resources.

Meta status distinguishes a TXT record saved in Cloudflare from the exact value being publicly resolvable. `dns_detected` means "DNS detected. Ready to verify in Meta" and never claims Meta approval.

## Provider configuration

Copy placeholder names from `.env.example` into ignored `.dev.vars` for local provider testing or configure Worker secrets in production. `/settings` reports only status and never returns credential values.

| Variable | Purpose |
| --- | --- |
| `HOSTINGER_API_TOKEN` | Availability, portfolio/WHOIS lookup, explicit registration, and nameserver updates |
| `CLOUDFLARE_API_TOKEN` | Zone, DNS, and Worker custom-domain operations |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account used for Worker custom domains |
| `CLOUDFLARE_WORKER_NAME` | Shared deployed Worker service name |
| `AI_PROVIDER`, `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` | Optional generic AI content provider |

Production also requires a deployed Worker, custom domains, a real remote D1 ID, and an R2 bucket bound as `LOGO_ASSETS`. `ASSETS` remains reserved for OpenNext static assets. The repository intentionally contains only an R2 placeholder in the production environment; local logo handling safely retains metadata when `LOGO_ASSETS` is absent.

## Quality gates

```bash
npm test
npm run lint
npm run build
npm run preview
```

Tests cover validation, deterministic copy, policy routing, setup ordering, provider request shapes and errors, Cloudflare DNS/zone behavior, public TXT parsing, and secret-safe status reporting.

Useful scripts also include `npm run cf-typegen`, `npm run deploy`, and `npm run upload`. Deployment commands require real Cloudflare resources and credentials.

## Security

Provider calls use server-side credentials only. D1 queries are prepared and bound. Integration history stores constrained operation names and truncated safe messages, not authorization headers, API tokens, payment credentials, or secret provider payloads. `.env*` (except `.env.example`), `.dev.vars*`, `.next/`, `.wrangler/`, `.open-next/`, and `node_modules/` are ignored.

See [Architecture](docs/ARCHITECTURE.md), [Project brief](docs/PROJECT_BRIEF.md), and [Roadmap](docs/ROADMAP.md).
