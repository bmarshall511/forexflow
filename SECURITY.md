# Security Policy

ForexFlow handles credentials for real-money forex trading. We take security seriously and welcome responsible disclosure of vulnerabilities.

## Reporting a Vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report privately through GitHub's Private Vulnerability Reporting:

👉 **[Open a private security advisory](https://github.com/bmarshall511/forexflow/security/advisories/new)**

You will receive:

- An acknowledgement within **72 hours**
- A triage assessment (severity, scope, reproducibility) within **7 days**
- A fix or mitigation plan within **30 days** for accepted reports
- Credit in the release notes when the fix ships, unless you request otherwise

## Scope

In scope:

- The ForexFlow application code on this repository (`v3` branch and the legacy `main` branch)
- Build scripts, CI workflows, and the packaged desktop app
- Documentation that instructs users to configure credentials insecurely

Out of scope:

- Vulnerabilities in upstream dependencies (report those to the upstream project; we track advisories via Dependabot)
- Vulnerabilities in OANDA, TradingView, Cloudflare, or any third-party service ForexFlow integrates with
- Issues that require the attacker to have already compromised the user's device
- User-owned credentials (OANDA API keys, webhook tokens) — these are the user's responsibility to rotate if exposed

## Supported Versions

During the `v3` rebuild, only the active development branch receives security fixes. Once `v3` ships as the new `main`, this table will be updated with a formal support window.

| Version | Supported |
|---------|-----------|
| `v3` (in progress) | ✅ |
| legacy `main` | ⚠️ critical fixes only |

## Safe Harbor

We will not pursue legal action against researchers who:

- Make a good-faith effort to follow this policy
- Do not access data belonging to other users
- Do not disrupt the service or other users
- Give us reasonable time to respond before public disclosure

Thank you for helping keep ForexFlow and its users safe.
