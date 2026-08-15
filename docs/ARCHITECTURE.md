# Architecture

## Current foundation

The project is a single Next.js application using the App Router:

- `app/` contains routes, layouts, page-level UI, and global styles.
- `public/` is reserved for static assets.
- `docs/` contains product and technical context.
- `.env.example` documents future configuration without containing secrets.

The application is server-first by default. Client components should be introduced only for interactions that require browser state or event handlers.

## Planned boundaries

As integrations are added, keep external service concerns behind small, typed modules rather than calling providers directly from page components. A likely future shape is:

```text
app/                 Routes and UI composition
components/          Reusable presentation and interaction components
lib/
  integrations/      Provider-specific adapters
  validation/        Input and workflow validation
  provisioning/      Domain workflow orchestration
```

The exact structure can evolve with the first workflow. The important boundary is that provider-specific APIs remain replaceable and testable independently from the UI.

## Configuration and secrets

Environment variables will be read only on the server unless a value is explicitly safe for the browser. Secret values must live in local or deployment environment configuration and must never be committed. `.env.example` should contain names and safe placeholders only.

## Quality expectations

- TypeScript remains strict.
- ESLint runs cleanly before changes are merged.
- Production builds must pass.
- Integration code should have explicit error handling, timeouts, and safe retry behavior when it is introduced.
