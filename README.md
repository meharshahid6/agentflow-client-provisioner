# Agentflow Client Provisioner

The foundation for a client provisioning workspace built with Next.js, TypeScript, the App Router, Tailwind CSS, and ESLint.

## Requirements

- Node.js 20.9 or newer
- npm 10 or newer

## Getting started

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in a browser.

## Available scripts

- `npm run dev` — start the development server
- `npm run lint` — run ESLint
- `npm run build` — create a production build
- `npm run start` — serve the production build

## Environment variables

Copy `.env.example` to `.env.local` when environment configuration is needed. The project currently requires no API credentials or external service configuration.

## Project documentation

- [Project brief](docs/PROJECT_BRIEF.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)

## Current scope

This initial version intentionally contains only the application foundation. No OpenAI, Hostinger, Cloudflare, Meta, or other external APIs are integrated yet, and no secrets are committed.
