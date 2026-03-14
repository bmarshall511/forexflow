# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** open a public GitHub issue.
2. Email the maintainer directly or use [GitHub's private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability).
3. Include a description of the vulnerability, steps to reproduce, and potential impact.
4. You will receive a response within 48 hours acknowledging the report.

## Security Measures

- All API keys and tokens are encrypted at rest (AES-256-GCM).
- Environment secrets are never committed to the repository.
- TradingView webhook ingestion validates source IPs.
- Dependency vulnerabilities are monitored via Renovate and `pnpm audit`.
