# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in ForexFlow, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please email **security@forexflow.dev** or use [GitHub Security Advisories](https://github.com/bmarshall511/forexflow/security/advisories/new) to report the issue privately.

### What to include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response timeline

- **Acknowledgment:** Within 48 hours
- **Initial assessment:** Within 1 week
- **Fix and disclosure:** Coordinated with reporter

## Scope

### In scope

- All application source code in `apps/` and `packages/`
- Authentication and credential handling
- Encryption implementation (`packages/db/src/encryption.ts`)
- WebSocket communication security
- API route authorization

### Out of scope

- OANDA's API and infrastructure
- Cloudflare's platform and Workers runtime
- TradingView's webhook infrastructure
- Third-party npm dependencies (report to the upstream maintainer)

## Security Design

ForexFlow handles sensitive financial data. Key security measures include:

- **Credential encryption:** OANDA API tokens are encrypted at rest using AES-256-GCM (`packages/db/src/encryption.ts`)
- **Environment isolation:** All secrets stored in `.env.local` files, never in source code
- **Webhook validation:** TradingView webhooks are validated by IP whitelist and token authentication
- **Sandbox controls:** The `.claude/` governance system prevents AI tooling from accessing secrets or `.env` files
