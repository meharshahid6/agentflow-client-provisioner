# Project Brief

## Overview

Agentflow Client Provisioner will become a focused workspace for setting up and managing client environments through repeatable provisioning workflows.

The initial release establishes the application foundation only. It does not connect to external services, create client resources, or store credentials.

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

This foundation includes the Next.js application shell, TypeScript, App Router, Tailwind CSS, ESLint, environment-variable documentation, and project documentation.

The following are intentionally out of scope for now:

- OpenAI integration
- Hostinger integration
- Cloudflare integration
- Meta integration
- Any other API integration
- Authentication and authorization
- Persistent data storage
- Real API keys or secrets
