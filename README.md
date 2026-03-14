# ForexFlow

**A self-hosted, real-time forex trading platform built with AI — as both development tool and runtime feature.**

[![CI](https://github.com/bmarshall511/forexflow/actions/workflows/ci.yml/badge.svg)](https://github.com/bmarshall511/forexflow/actions/workflows/ci.yml)
[![Security](https://github.com/bmarshall511/forexflow/actions/workflows/security.yml/badge.svg)](https://github.com/bmarshall511/forexflow/actions/workflows/security.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22-green.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D10-orange.svg)](https://pnpm.io/)

> **Disclaimer:** ForexFlow is provided as-is for educational and personal use. It is **not financial advice**. Trading forex involves significant risk of loss. The authors are not responsible for any trading losses incurred through the use of this software. Use at your own risk. Always trade with money you can afford to lose.

---

## What is ForexFlow?

ForexFlow is a self-hosted forex trading platform that connects to your [OANDA](https://www.oanda.com/) broker account and gives you a real-time command center for managing positions, automating trades, and analyzing every decision with AI.

It was built solo in ~3 weeks using [Claude Code](https://claude.ai/claude-code) as an AI pair programmer — and then Claude was integrated as a runtime feature for live trade analysis. ~58,000 lines of hand-written TypeScript across 400+ files.

The project demonstrates two things:

1. **Building with AI at scale** — A governance system (`.claude/` directory) that makes AI-generated code production-quality and consistent across a large codebase
2. **AI as a runtime feature** — Claude analyzes trades with rich context, suggests executable conditions, and generates periodic performance digests

---

## Features

### Real-Time Dashboard

Account balance, equity, margin, and drawdown — all updating in real time over WebSocket. Open positions with live P&L, pending orders, today's closed trades, AI insights, and system notifications in one view.

### Live Position Management

Sub-second price updates via persistent OANDA streaming connections. Every trade tracks MFE and MAE (Maximum Favorable/Adverse Excursion). Close trades, modify stop-losses, cancel orders, or close everything with one click. Full trade history with filtering by instrument, direction, outcome, source, date range, and tags.

### TradingView Alert Automation

Receive TradingView webhook alerts and automatically execute trades through a multi-stage safety pipeline:

```
TradingView Alert
  -> Cloudflare Worker (IP validation, dedup, queuing)
    -> Daemon WebSocket
      -> SignalProcessor (9 safety checks)
        -> OANDA order execution
```

Safety checks include: kill switch, market hours filter, per-instrument cooldowns, max open positions, daily loss circuit breaker, pair whitelist, duplicate detection, connectivity verification, and conflicting position detection.

### Trade Finder — Automated Zone Detection

An automated supply/demand zone scanner that:

- Detects zones across multiple timeframes using candle classification (leg/base/neutral)
- Scores zones on 7 "Odds Enhancers" (strength, time, freshness, trend alignment, curve position, profit zone, commodity correlation)
- Watches for price approaching high-scoring zones
- Auto-places limit orders with calculated SL/TP when enabled
- Dual-path fill detection: event-driven (instant) + periodic fallback

### AI Trader — Autonomous Trade Discovery

An AI-powered autonomous scanner that discovers and executes trades using a 3-tier analysis pipeline:

- **Tier 1 (Technical):** Scans all configured currency pairs across multiple timeframes using 14 analysis techniques (SMC structure, fair value gaps, order blocks, Fibonacci OTE, RSI, MACD, EMA alignment, and more)
- **Tier 2 (Fast filter):** Claude Haiku validates each candidate signal with a quick pass/fail assessment
- **Tier 3 (Deep decision):** Claude Sonnet performs full trade analysis including fundamental data, sentiment, historical performance, position sizing, and risk assessment
- **Operating modes:** Manual (review all), Semi-Auto (auto-execute high confidence), Full Auto (fully autonomous)
- **4 trading profiles:** Scalper, Intraday, Swing, News — each with different timeframes and strategies
- **Risk gates:** Budget caps (daily/monthly AI cost), max concurrent trades, kill switch integration, market hours awareness
- **Real-time visibility:** Live progress bar during scans, activity log showing every decision, WebSocket-powered status updates
- **Configurable:** Currency pair whitelist, technique toggles, confidence thresholds, AI model selection

### AI Trade Analysis

Every trade can be analyzed by Claude with rich, structured context:

- **Input context:** Candle data across 3 timeframes, RSI/ATR/EMA indicators, your historical win rate on the pair, live news events, correlated pair analysis, account state, previous analyses
- **Structured output:** TLDR (beginner-friendly), trade quality score, win probability, technical breakdown, risk assessment, portfolio risk, immediate action buttons, condition suggestions
- **Executable conditions:** AI-suggested rules ("if price drops below 1.0850, close trade") that you activate with one click — evaluated on every price tick with sub-millisecond latency
- **Auto-analysis:** Configurable triggers on order fill, trade close, or periodic intervals
- **Performance digests:** Weekly/monthly AI-generated summaries of your trading patterns, mistakes, and improvements

### Multi-Panel Charts

Built-in candlestick charts (TradingView Lightweight Charts) with supply/demand zone overlays, trend detection visualization, and real-time price updates. Configurable grid layouts (1x1 through 2x2).

### MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io/) server that exposes live trading data as tools for Claude Code. The AI that helped build the app can query and interact with the running system — development tool meets runtime tool.

---

## Architecture

ForexFlow is a TypeScript monorepo with 4 apps and 3 shared packages:

```
apps/
  web/           Next.js 15 App Router — frontend + 50+ API routes
  daemons/       Node.js daemon — 13+ subsystems, port 4100
  cf-worker/     Cloudflare Worker + Durable Objects — webhook relay
  mcp-server/    MCP server — Claude Code integration

packages/
  types/         Shared TypeScript contracts (DTOs, WebSocket messages)
  shared/        Pure utilities (market hours, pip math, zone detection)
  db/            Prisma ORM + SQLite, 22+ models, 24 service files
```

### How it connects

```
                                    +------------------+
  TradingView ----webhook---->     | Cloudflare Worker |
                                    | (Durable Object)  |
                                    +--------+---------+
                                             |
                                         WebSocket
                                             |
  +-------------+    WebSocket    +----------v---------+    REST API    +-------+
  |  Next.js    | <-------------> |   Node.js Daemon   | <-----------> | OANDA |
  |  Web App    |    (real-time)  |   (port 4100)      |   (streams)   |  API  |
  +------+------+                 +----------+---------+               +-------+
         |                                   |
         +-----------> SQLite <--------------+
         |             (Prisma)
         |
  +------v------+
  |  Cloudflare  |    (optional — for remote/mobile access)
  |    Tunnel    |-----> Phone / Remote Device (PWA)
  +--------------+
```

The daemon is the central hub — it maintains persistent streaming connections to OANDA for prices and transaction events, reconciles state into the database every 2 minutes, processes signals from the Cloudflare Worker, runs AI analyses, monitors trade conditions on every price tick, and broadcasts everything to connected web clients via WebSocket.

---

## Prerequisites

| Requirement        | Version | Notes                                                               |
| ------------------ | ------- | ------------------------------------------------------------------- |
| **Node.js**        | >= 22   | [Download](https://nodejs.org/)                                     |
| **pnpm**           | >= 10   | `npm install -g pnpm`                                               |
| **OANDA account**  | —       | [Sign up for a free practice account](https://www.oanda.com/apply/) |
| Cloudflare account | —       | _Optional_ — only needed for TradingView alert automation           |
| Anthropic API key  | —       | _Optional_ — only needed for AI trade analysis features             |

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/bmarshall511/forexflow.git
cd forexflow
pnpm install
```

### 2. Generate Prisma client

```bash
pnpm --filter @fxflow/db db:generate
```

### 3. Configure environment

```bash
# Copy example env files
cp apps/daemons/.env.example apps/daemons/.env.local
cp apps/web/.env.example apps/web/.env.local

# Generate an encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste the generated encryption key into **both** `.env.local` files as the `ENCRYPTION_KEY` value.

### 4. Initialize the database

```bash
mkdir -p data
pnpm --filter @fxflow/db db:migrate
```

### 5. Start development

```bash
pnpm dev
```

This starts:

- **Web app** at `http://localhost:3000`
- **Daemon** at `http://localhost:4100`

### 6. Connect your OANDA account

Open `http://localhost:3000/settings/oanda` and enter your OANDA API token and account ID. The app will test the connection and begin syncing your account data.

---

## Configuration

### Daemon Environment Variables (`apps/daemons/.env.local`)

| Variable                          | Required | Default  | Description                                              |
| --------------------------------- | -------- | -------- | -------------------------------------------------------- |
| `DATABASE_URL`                    | Yes      | —        | Prisma database URL (e.g., `file:../../data/fxflow.db`)  |
| `ENCRYPTION_KEY`                  | Yes      | —        | 64-char hex string for AES-256-GCM credential encryption |
| `CF_WORKER_WS_URL`                | No       | —        | Cloudflare Worker WebSocket URL for TradingView alerts   |
| `CF_WORKER_DAEMON_SECRET`         | No       | —        | Secret for daemon-to-Worker authentication               |
| `DAEMON_PORT`                     | No       | `4100`   | HTTP + WebSocket server port                             |
| `DAEMON_TRADE_RECONCILE_INTERVAL` | No       | `120000` | OANDA reconciliation interval (ms)                       |
| `DAEMON_PRICE_THROTTLE`           | No       | `500`    | Price broadcast throttle (ms)                            |

See [`apps/daemons/.env.example`](apps/daemons/.env.example) for the full list of tuning variables.

### Web App Environment Variables (`apps/web/.env.local`)

| Variable                      | Required | Default                 | Description                        |
| ----------------------------- | -------- | ----------------------- | ---------------------------------- |
| `DATABASE_URL`                | Yes      | —                       | Must match daemon's DATABASE_URL   |
| `ENCRYPTION_KEY`              | Yes      | —                       | Must match daemon's ENCRYPTION_KEY |
| `NEXT_PUBLIC_DAEMON_REST_URL` | Yes      | `http://localhost:4100` | Daemon REST API URL                |
| `NEXT_PUBLIC_DAEMON_URL`      | Yes      | `ws://localhost:4100`   | Daemon WebSocket URL               |

### Cloudflare Worker (optional)

If you want TradingView alert automation:

1. Copy `apps/cf-worker/.dev.vars.example` to `apps/cf-worker/.dev.vars`
2. Set `WEBHOOK_TOKEN` and `DAEMON_SECRET`
3. Deploy: `pnpm --filter @fxflow/cf-worker deploy`
4. Set matching values in the daemon's `CF_WORKER_WS_URL` and `CF_WORKER_DAEMON_SECRET`

### AI Features (optional)

AI features require an Anthropic API key. Configure at **Settings > AI** (per-trade analysis) or **Settings > AI Trader** (autonomous scanner). Keys are encrypted at rest using AES-256-GCM.

The AI Trader can optionally use FRED and Alpha Vantage API keys for macroeconomic data context — configure them in **Settings > AI Trader > API Keys**.

### Remote Access (optional)

Access FXFlow from your phone or any device — zero configuration needed:

```bash
pnpm dev    # Starts app + Cloudflare Quick Tunnel automatically
```

The remote URL is printed in the terminal and shown in **Settings > Security**. Open it on your phone. The URL changes each restart — that's fine for personal use.

Use `pnpm dev:local` to skip the tunnel and run locally only.

**Security layers:**

- **PIN authentication** — app-level 6-digit PIN with lockout protection
- **HTTPS encryption** — via Cloudflare tunnel
- **Unguessable URL** — random subdomain on each start
- **Security headers** — X-Frame-Options, HSTS, etc. via Next.js
- **Rate limiting** — brute-force protection on auth endpoints

For a persistent URL, set up a [named tunnel](docs/ai/remote-access.md#named-tunnels-advanced).

### PWA Support

FXFlow is installable as a Progressive Web App on mobile devices:

1. Open the app in your mobile browser
2. Tap "Add to Home Screen" (iOS Safari) or install prompt (Android Chrome)
3. The app launches in standalone mode — looks and feels like a native app

Features: offline fallback page, app icons, standalone display mode, theme-color integration.

---

## Development

### Commands

| Command             | Description                          |
| ------------------- | ------------------------------------ |
| `pnpm dev`          | Start all apps in dev mode           |
| `pnpm build`        | Production build                     |
| `pnpm lint`         | ESLint across all workspaces         |
| `pnpm typecheck`    | `tsc --noEmit` across all workspaces |
| `pnpm test`         | Run test suites (Vitest)             |
| `pnpm format`       | Prettier format                      |
| `pnpm format:check` | Check formatting                     |
| `pnpm knip`         | Find unused exports and dependencies |
| `pnpm docs:api`     | Generate TypeDoc API documentation   |
| `pnpm changelog`    | Generate changelog from commits      |

### Git hooks

Pre-commit hooks run automatically via [Lefthook](https://github.com/evilmartians/lefthook):

- **Commit:** Auto-format (Prettier) + auto-fix (ESLint) staged files
- **Commit message:** [Conventional Commits](https://www.conventionalcommits.org/) enforced via commitlint
- **Push:** TypeScript type checking + test suite must pass

### CI/CD

GitHub Actions runs on every pull request:

| Check        | Description                   |
| ------------ | ----------------------------- |
| lint-format  | ESLint + Prettier             |
| typecheck    | `tsc --noEmit`                |
| test         | Vitest with coverage          |
| build        | Full production build         |
| audit        | Dependency vulnerability scan |
| knip         | Unused export detection       |
| prisma-drift | Schema/migration sync         |
| danger       | Automated PR review           |

Additional workflows: CodeQL + Gitleaks security scanning, bundle size analysis on web changes, auto-changelog generation on merge to main.

### Running individual apps

```bash
pnpm --filter @fxflow/web dev        # Web app only
pnpm --filter @fxflow/daemons dev    # Daemon only
pnpm --filter @fxflow/cf-worker dev  # CF Worker (local)
```

### Database management

```bash
pnpm --filter @fxflow/db db:migrate  # Run migrations
pnpm --filter @fxflow/db db:studio   # Open Prisma Studio
pnpm --filter @fxflow/db db:generate # Regenerate Prisma client
```

---

## AI Governance System

This project includes a complete AI governance system in the [`.claude/`](.claude/) directory that makes [Claude Code](https://claude.ai/claude-code) effective on the codebase from the first session. It's designed as a reusable pattern for any AI-assisted project.

### CLAUDE.md — Project Constitution

[`.claude/CLAUDE.md`](.claude/CLAUDE.md) is loaded into every Claude Code session. It defines the monorepo layout, strict import boundaries, coding standards, and critical domain concepts. The AI reads this before writing a single line of code.

### 8 Path-Scoped Rules

[`.claude/rules/`](.claude/rules/) contains context-specific rules that auto-load based on which files the AI is editing:

| Rule                       | Scope                                                                         |
| -------------------------- | ----------------------------------------------------------------------------- |
| `00-foundation.md`         | Core principles (plan first, no duplication, respect boundaries)              |
| `01-typescript-quality.md` | Strict TS patterns (discriminated unions, branded types, exhaustive switches) |
| `02-web-patterns.md`       | Next.js conventions (App Router, component size limits, data fetching)        |
| `03-daemon-patterns.md`    | Daemon architecture (startup sequence, StateManager, per-instrument mutexes)  |
| `04-cf-worker-patterns.md` | Cloudflare Worker patterns (Durable Objects, webhook handling)                |
| `05-db-patterns.md`        | Database conventions (service files, upsert patterns, encryption)             |
| `06-accessibility.md`      | AAA accessibility baseline (semantic HTML, keyboard nav, focus management)    |
| `07-dependencies.md`       | Dependency management (justification required, no overlaps)                   |
| `08-trading-domain.md`     | Trading domain rules (source enrichment, pip calculations, market hours)      |

### 8 Reusable Skills

[`.claude/skills/`](.claude/skills/) provides task templates for common operations. When the AI needs to add an API route, daemon endpoint, database service, or WebSocket event, it follows a defined pattern — ensuring every instance looks the same across the entire codebase.

### Automated Hooks

- **format-on-edit** — Prettier runs automatically on every file the AI edits or creates
- **guard-bash** — Blocks destructive shell commands (`rm -rf /`, `dd if=`, fork bombs) at execution time

### Sandbox Controls

The AI operates in a constrained environment: it cannot read `.env` files or secrets, cannot access arbitrary network endpoints, and destructive git operations require explicit approval.

### Why this matters

The productivity gain from AI isn't "it writes code faster." It's that you can build a system where AI writes code that _fits the project_ — every time, without re-explaining the project every time. The governance system is what turns AI from a demo into a tool you can trust on production code.

---

## Tech Stack

| Layer          | Technology                                                             |
| -------------- | ---------------------------------------------------------------------- |
| Frontend       | Next.js 15 (App Router), React 19, Tailwind CSS 4, shadcn/ui, Radix UI |
| Charts         | TradingView Lightweight Charts 5                                       |
| Backend        | Node.js daemon (custom HTTP + WebSocket server)                        |
| Edge           | Cloudflare Workers + Durable Objects                                   |
| Database       | SQLite via Prisma ORM (LibSQL adapter)                                 |
| AI Runtime     | Claude API (Anthropic SDK)                                             |
| AI Development | Claude Code with governance system                                     |
| Monorepo       | pnpm workspaces + Turborepo                                            |
| Testing        | Vitest                                                                 |
| Language       | TypeScript 5.7 (strict mode)                                           |

---

## Project Stats

- **~58,000 lines** of hand-written TypeScript
- **401 files** across 4 apps and 3 packages
- **~3 weeks** of development
- **50+ API routes** in the web app
- **13+ daemon subsystems** orchestrated in dependency order
- **50+ WebSocket message types** for real-time communication
- **22+ Prisma models** with 24 service files
- **7 Odds Enhancer** scoring dimensions for zone quality
- **Solo developer** + Claude Code

---

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, code standards, and PR guidelines.

The `.claude/` governance system means you can use Claude Code effectively on this project from day one — the rules, skills, and standards are all there.

Areas especially welcoming contributions:

- Additional broker integrations (currently OANDA only)
- More technical indicators for AI context
- Testing coverage
- Zone detection algorithm refinements
- Mobile responsiveness improvements

---

## Security

For security concerns, see [SECURITY.md](.github/SECURITY.md).

ForexFlow encrypts all stored credentials using AES-256-GCM. API tokens are never stored in plain text or source code. The `.claude/` sandbox prevents AI tooling from accessing secrets.

---

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).

---

**ForexFlow** is open source at [github.com/bmarshall511/forexflow](https://github.com/bmarshall511/forexflow).
