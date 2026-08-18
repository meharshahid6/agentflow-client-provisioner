# Project Brief

## Overview

Agentflow Client Provisioner will become a focused workspace for setting up and managing client environments through repeatable provisioning workflows.

The current non-AI milestone provides the owner-only application, persistent production Cloudflare D1 state, deterministic website generation, publication controls, and the shared Worker domain pipeline. Provider credentials remain server-side runtime configuration and are never stored in D1.

## Problem

Client setup can become inconsistent when each environment is configured manually across multiple tools. The product should provide a clear, auditable flow for collecting client details, validating inputs, provisioning required resources, and reporting the result.

## Intended users

- Internal operators who prepare client environments
- Technical account or implementation teams who need repeatable setup steps
- Future administrators who need visibility into provisioning status and history

## Initial principles

- Keep provisioning steps explicit and observable.
- Treat credentials and external integrations as isolated capabilities.
- Prefer safe retries and clear failure states over hidden automation.
- Start with a small, maintainable application surface.

## Current scope

This milestone includes the Next.js application shell, TypeScript, App Router, Tailwind CSS, ESLint, the Client Business Details Form, server-side validation, production D1 persistence, deterministic website generation and templates, preview/publication workflow, policy pages, domain ownership and setup state, Hostinger integration, Cloudflare zone/DNS/Worker custom-domain integration, apex/www support, and optional public Meta TXT detection.

The following remain intentionally out of scope for now:

- AgentRouter AI live integration
- R2/logo asset storage
- Billing, subscriptions, teams, and client login portals
- Full application-managed authentication; admin protection uses Cloudflare Access configuration
- Automatic domain purchasing without explicit human confirmation
