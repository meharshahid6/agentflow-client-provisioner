# Architecture

## Runtime and boundaries

The application is a server-first Next.js 16.3.1 App Router project deployed to Cloudflare Workers through OpenNext. `initOpenNextCloudflareForDev()` exposes bindings during Next development; `npm run preview` builds OpenNext output and runs it in Wrangler/workerd.

Primary boundaries:

- `app/`: internal pages, public site route, and JSON APIs.
- `components/clients/`: client editor, generation controls, and setup state machine UI.
- `components/websites/`: the three visual variants and policy rendering.
- `lib/clients/`, `lib/websites/`, `lib/domains/`: validation, configuration, and D1 repositories.
- `lib/integrations/`: Hostinger, Cloudflare, generic AI, provider status, HTTP error parsing, and safe run history.
- `migrations/`: additive D1 schema history.

## Owner control room

The private owner application uses one shared navigation shell for Dashboard, New Client, Clients, Domains, and Settings. Dashboard is the operational control room; the other pages provide focused workspaces and link back to it. The shell is pathname-gated so public `/sites/[hostname]` pages and custom-domain rewrites remain standalone client websites.

Domain registration availability is sourced only from Hostinger's availability endpoint. It is stored/displayed independently from Hostinger portfolio ownership and Agentflow client assignment. Explicit provider `is_available: true` means Available, `false` means Taken/Unavailable, and malformed or failed responses remain Unknown/Error and are never converted to Taken. Candidate searches check every candidate independently; local suggestions are not availability results.

## Data model

`clients` is the business source of truth. `websites` has one persisted configuration per client and stores template selection independently from generated content. `domains` has one current setup record per client and tracks availability, ownership (`available_not_owned`, `existing_owned_domain`, `purchase_pending`, `purchased`), purchase, zone activation, nameservers, apex and www custom domains, HTTPS, and separate Cloudflare/public Meta TXT states.

Repositories map snake-case SQLite columns to typed camel-case records. Writes use prepared statements and bound values. Migrations are additive so existing client and website records remain intact.

## Website generation

`POST /api/clients/[id]/website` builds factual deterministic content first, optionally attempts the configured generic AI provider, validates any returned structure, calculates readiness, and persists the complete configuration. Provider failure leaves deterministic content available and records a safe integration result.

Template selection (`modern_business`, `professional_corporate`, or `local_service`) updates only the selected template and preserves content. Configuration contains identity, services, contact details, social links, logo URL, policies, FAQs, SEO/Open Graph values, content source, and readiness.

AI integration is implemented but AgentRouter live calls remain externally blocked by provider authentication. This architecture deliberately preserves the provider boundary and deterministic fallback without special-case provider rewrites.

## Public routing

`middleware.ts` normalizes the request hostname, including mapping `www` to the canonical apex hostname. Internal hosts, localhost, and Workers preview hosts retain normal App Router behavior. A client hostname is rewritten to `/sites/{hostname}/{optional-path}`. Although Next.js 16 warns that middleware is deprecated, OpenNext deployment currently requires this Edge Middleware convention.

`app/sites/[hostname]/[[...path]]/page.tsx` resolves the normalized hostname through `domains`, joins it to a published website, and serves `/`, `/privacy`, and `/terms`. Draft/unreviewed websites are not public. All other paths return 404. One Worker and repository serve every client domain; unknown hostnames do not fall through to another client.

## Domain pipeline

The API and `getNextSetupOperation()` enforce:

```text
Business details -> Website generated -> Domain availability
-> Confirmed ownership OR two-step paid registration
-> Cloudflare zone -> Hostinger nameserver update
-> Explicit Cloudflare zone status check (active required)
-> HTTPS check -> Complete
```

Continue Setup cannot cross an ownership boundary and never invokes registration. Existing Hostinger portfolio domains are marked owned. Cloudflare `getZone()` must report `active` before Worker attachment. Checks are user-triggered and bounded; there is no infinite polling.

Meta TXT is an optional post-setup verification aid after the public website is working. It has two meanings: `meta_verification_status=record_created` confirms Cloudflare configuration, while `meta_public_dns_status=dns_detected` confirms an exact public DNS-over-HTTPS TXT answer. Neither state claims that Meta has approved the domain.

## Integrations and observability

Hostinger supports domain availability, portfolio and WHOIS queries, explicit registration, and nameserver updates. Cloudflare supports zone find/create/get, DNS list/create/update/upsert, and Worker custom-domain attachment. External writes are mocked in tests.

Provider HTTP failures are parsed into bounded safe messages. `integration_runs` does not store tokens, authorization headers, payment fields, confirmation tokens, or raw provider payloads. `/settings` reports configuration/runtime state only; values are never returned.

## Bindings and production

- `DB`: D1 application database.
- `ASSETS`: OpenNext static assets. This binding must not be repurposed.
- `LOGO_ASSETS`: optional, deferred client-logo R2 bucket.

The Wrangler configuration uses the production D1 database and leaves R2 disabled. Production provisioning requires setting Worker secrets/account inputs, applying migrations remotely, deploying the shared Worker, and attaching real domains. No secrets belong in `wrangler.jsonc` or tracked environment files.

When `LOGO_ASSETS` is unavailable locally, logo metadata remains safe and website rendering uses the monogram fallback. When configured, uploaded logo objects are served through the controlled client logo route.

## Internal application

`/dashboard` aggregates clients, generated/ready websites, configured/live domains, pending setup, and recent clients. `/clients` supports create/read/list/edit and regeneration. `/domains` is read-only operational state with links back to each client setup page. `/settings` reports D1, AgentRouter, R2, Hostinger, and Cloudflare status. Authentication, billing, and teams are outside NON-AI v1.

The internal Workers.dev/admin hostname requires a Cloudflare Access owner-only policy covering `/`, `/dashboard*`, `/clients*`, `/domains*`, `/settings*`, and `/api*`. Client custom hostnames remain public. This infrastructure policy must be configured and verified in Cloudflare before production security can be declared complete; the application intentionally does not trust spoofable identity headers or implement a parallel user system.

## Verification

The release gates are local migration status/application, Node integration tests, ESLint, Next production build, OpenNext/Wrangler preview boot, tracked-file secret scanning, and git diff review. Automated provider tests cannot perform paid registrations or mutate production Cloudflare resources.
