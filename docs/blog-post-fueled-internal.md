# How I Used AI to Build a 58,000-Line Trading Platform in 3 Weeks

I recently built a side project — a full-stack forex trading platform called FXFlow — and I wanted to share what I learned about AI-assisted development, because the lessons apply directly to how we work at Fueled.

This isn't a "look what ChatGPT can do" post. It's about what happens when you treat AI as a *governed co-developer* rather than a code generator, and how that changes the math on what a single engineer can ship.

---

## The Project

FXFlow is a self-hosted platform that connects to OANDA (a forex broker) and provides:

- **Real-time position management** — live P&L, WebSocket price streaming, stop-loss/take-profit management
- **TradingView alert automation** — webhooks from TradingView flow through a Cloudflare Worker to a Node.js daemon that validates and executes trades
- **Automated zone detection** — a scanner identifies supply/demand zones across multiple timeframes, scores them on 7 quality dimensions, and auto-places limit orders
- **AI-powered trade analysis** — Claude analyzes trades with full market context and suggests actionable conditions
- **An MCP server** — lets Claude Code query live trading data from the running system

The stack: Next.js 15 frontend, Node.js daemon (13+ subsystems), Cloudflare Worker + Durable Objects, Prisma/SQLite, pnpm + Turborepo monorepo.

**The numbers:** 58,000 lines of hand-written TypeScript, 401 files, 50+ API routes, built in about 3 weeks as a solo developer.

That last part is the point of this post.

---

## How I Used AI to Build It

I used Claude Code (Anthropic's CLI tool) as my primary development tool. But the key wasn't the AI itself — it was the *governance system* I built around it.

### The Problem with Naive AI Coding

We've all seen it: you ask an AI to write code, it produces something that works in isolation but doesn't match your project's patterns. Different error handling. Wrong file location. Inconsistent naming. Over-engineered abstractions. You spend as much time fixing the AI's output as you would have spent writing it yourself.

That's the naive approach. Here's what the governed approach looks like.

### The `.claude/` Directory

FXFlow has a `.claude/` directory with four categories of governance:

#### 1. CLAUDE.md — The Project Constitution

A single file that defines the monorepo layout, import boundaries (apps can import packages, never the reverse), coding standards, and critical domain concepts. Claude Code reads this automatically at the start of every session.

Think of it as onboarding documentation — but for the AI. It means session #50 starts with the same project understanding as session #1.

#### 2. Eight Path-Scoped Rule Files

Each rule file is scoped to a specific part of the codebase:

| Rule | Scope | What It Enforces |
|------|-------|-----------------|
| `00-foundation.md` | Everywhere | Plan first, no duplication, respect boundaries |
| `01-typescript-quality.md` | All `.ts/.tsx` | Strict types, discriminated unions, no `any` |
| `02-web-patterns.md` | `apps/web/` | App Router, components <150 LOC, mobile-first |
| `03-daemon-patterns.md` | `apps/daemons/` | Startup order, StateManager, per-instrument mutexes |
| `04-cf-worker-patterns.md` | `apps/cf-worker/` | Durable Object conventions, idempotency |
| `05-db-patterns.md` | `packages/db/` | Service pattern, encryption, source enrichment |
| `06-accessibility.md` | Components | AAA baseline, semantic HTML, keyboard nav |
| `07-dependencies.md` | `package.json` | No overlapping libs, justified additions only |

When the AI works in `apps/daemons/`, it automatically loads rules 00, 01, 03, and 08 (trading domain). When it works in `apps/web/src/components/`, it loads 00, 01, 02, and 06. Context-appropriate constraints, every time.

#### 3. Eight Reusable Skills

Skills are task templates. `add-api-route` defines exactly how to create an API route — file location, error handling, typing, logging conventions. `add-ws-event` defines the four-step process for adding a new WebSocket message type. `verify` runs lint, typecheck, and tests across the monorepo.

The result: every API route in the app follows the same pattern. Not because I was disciplined about it — because the skill enforces it.

#### 4. Automated Hooks

Two hooks run on every AI action:
- **format-on-edit** — Prettier runs automatically on every file the AI touches
- **guard-bash** — Blocks destructive shell commands (`rm -rf /`, `dd if=`, fork bombs)

Plus filesystem and network sandboxing — the AI can't read `.env` files, can't access secrets, and can't hit arbitrary endpoints.

### What This Produces

The code is consistent. The patterns are uniform. Reviewing AI-generated code is about logic and design, not about fixing formatting, renaming variables, or moving files to the right directory. The governance layer eliminates the entire category of "AI wrote it differently than we would have" problems.

**The velocity impact:** I shipped features that would normally take days in hours. Not because the AI types faster — because the feedback loop is near-instant and the output is immediately usable without cleanup.

---

## AI Inside the App

Beyond using AI to *build* the app, AI is a core *feature* of the app.

### Trade Analysis Engine

Every trade can be analyzed by Claude. The daemon's Context Gatherer assembles a comprehensive snapshot:

- Candle data across 3 timeframes (M15, H1, H4)
- Technical indicators (RSI, ATR, EMAs, support/resistance)
- Historical win rate on the specific currency pair
- Live economic calendar events with impact ratings
- Correlated pair analysis (flags concentrated risk if you're long EUR/USD and GBP/USD simultaneously)
- Previous analysis history (so it can assess whether prior recommendations played out)

This goes to Claude with a structured system prompt that demands specific price levels (not vague ranges), honest probability assessments, beginner-accessible language, and structured JSON output matching a TypeScript interface.

The response includes a TLDR ("close this trade — price is moving against you"), trade quality score, win probability, technical breakdown, risk assessment, and — critically — **executable condition suggestions**.

### From Analysis to Automation

The AI suggests conditions like "if price drops below 1.0850, close the trade." Users can activate these as live rules that the daemon evaluates on *every price tick* — sub-millisecond latency. The AI's recommendation becomes an automated trading rule.

The condition system supports price triggers, P&L triggers, time triggers, trailing stops, and parent-child chains (condition B only activates after condition A fires).

### Auto-Analysis and Digests

The system can automatically analyze every new order, every fill, every close. Weekly and monthly digest reports summarize trading patterns and performance trends. It's a continuous AI-powered feedback loop.

### MCP Server — The Bridge

An MCP (Model Context Protocol) server exposes FXFlow's data as tools that Claude Code can call. You can open Claude Code and ask "what are my open positions?" and it fetches live data from the running daemon.

The AI that helped *build* the app can now *query* the app. Development tool meets runtime tool.

---

## Lessons for Our Work at Fueled

### 1. AI governance is the multiplier

The productivity gain from AI coding isn't the AI itself — it's the governance layer around it. For client projects, this means: invest in CLAUDE.md files, rules, and skills before you start generating code. The upfront cost is an hour. The payoff is consistent, reviewable AI output for the life of the project.

If you're starting a new project and plan to use Claude Code, set up the governance layer first. Define the patterns. Write the rules. The AI will follow them.

### 2. Context quality drives output quality

The trade analysis feature works because the Context Gatherer is thorough, not because Claude is smart. The same principle applies to our development workflow: the more context the AI has about the project, the better the output. CLAUDE.md, rules, and well-documented code are all forms of context.

### 3. AI features should produce structured output, not text

The analysis returns typed JSON matching a TypeScript interface — not a paragraph of text. This makes it programmatically useful: the TLDR drives UI buttons, the condition suggestions are one-click activatable, the quality score feeds into dashboard cards. If you're building AI features for clients, push for structured output that your UI can consume directly.

### 4. The scope of what one engineer can ship has changed

58,000 lines of hand-written TypeScript in 3 weeks, solo, with production-quality patterns. A year ago, that would have been a 3-4 person team over 2-3 months. The tools have gotten good enough that the bottleneck is architectural thinking and product decisions, not implementation speed.

This matters for how we estimate, how we staff, and how we think about what's possible in a sprint.

### 5. MCP is worth exploring for client projects

The MCP server pattern — exposing your app's data as tools that Claude can call — is powerful for internal tools, admin dashboards, and any system where power users want to query data conversationally. It's a relatively small investment (FXFlow's MCP server is ~700 lines) that adds a fundamentally new interface to your application.

---

## Try It Yourself

The project is open source at [REPO_URL]. The `.claude/` directory means you can clone it, open Claude Code, and start contributing immediately — the governance layer will guide the AI to produce code that fits the project.

If you want to see it in action or talk about applying any of these patterns to a client project, grab me anytime.
