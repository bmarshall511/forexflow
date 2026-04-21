# ForexFlow

> A self-hosted forex trading platform that puts a layer of discipline, automation, and AI-assisted analysis on top of your OANDA account. Runs locally on your machine or as a desktop app — you own the code, you own the data, no servers in between.

**Status:** Actively rebuilding from the ground up. The codebase you see on the `v3` branch is a greenfield rewrite — the previous version lives on `main` as a reference and is slated to be replaced.

---

## What ForexFlow is

ForexFlow is a trading companion, not a broker. It connects to your OANDA account (practice or live) and adds:

- **Real-time position tracking** with mobile-first dashboards
- **Trade discipline** — circuit breakers, session gating, risk caps, correlation guards
- **AI-assisted trade analysis** — pre-trade evaluation, post-trade reflection, condition monitoring
- **Automated scanners** — supply/demand zones, smart-money concepts, multi-agent opportunity analysis
- **TradingView webhook integration** — route alerts to real orders with pre-execution safety checks
- **Self-hosted and local** — no cloud dependency, your API keys never leave your machine

## How it runs

Three deployment modes, all built from the same codebase:

| Mode | Who it's for | How |
|---|---|---|
| **Dev** | Contributors | `pnpm dev` |
| **Desktop app** | Non-technical traders | Download the DMG (macOS), open, done |
| **Self-hosted** | Traders who want remote access | Run the daemon on your own box (Docker or bare metal), point the web app at it |

## Repository layout

Each top-level directory gets its own `CLAUDE.md` documenting intent, patterns, and gotchas. Start with [`.claude/README.md`](./.claude/README.md) to understand how the AI agent is configured to develop this project.

## Getting started (contributors)

See [`docs/dev/GETTING_STARTED.md`](./docs/dev/GETTING_STARTED.md).

## Using the AI agents

This repository is developed with AI-assisted tooling (Claude Code and Cursor). The agent configuration is a first-class part of the project — see [`.claude/README.md`](./.claude/README.md) for how it works, what agents exist, and how contributors invoke them.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the contribution workflow, coding standards, and the pull request checklist.

All participation is governed by the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Security

ForexFlow handles credentials for real money trading. If you discover a vulnerability, please report it privately — see [`SECURITY.md`](./SECURITY.md). Do **not** open a public issue for security matters.

## License

[MIT](./LICENSE). Use it, fork it, ship it.
