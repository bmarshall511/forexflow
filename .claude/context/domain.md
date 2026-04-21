# Domain Context — ForexFlow

> Agents load this file when reasoning about what ForexFlow is, who uses it, and what the core concepts mean. It is the single source of truth for domain language — if a term appears here, agents use it consistently; if a term does not appear here, agents ask.

## What ForexFlow is

ForexFlow is a **self-hosted forex trading companion**. It is not a broker. It is not a market data aggregator. It is a disciplined layer on top of a user's existing OANDA account, running locally on their machine or bundled as a desktop app.

The core value it delivers:

1. **Real-time visibility** into positions, account state, and market conditions
2. **Enforced discipline** — risk caps, session gating, correlation guards, circuit breakers
3. **AI-assisted decision support** — pre-trade analysis, post-trade reflection, condition monitoring
4. **Automated scanners** that surface trade opportunities conforming to the user's strategy profile
5. **TradingView webhook integration** so alerts route to real orders through the same safety checks

Everything runs locally. Credentials never leave the user's machine. No shared servers. No vendor lock-in.

## Who uses it

Active retail forex traders, typically:

- Running an OANDA practice or live account
- Trading multiple currency pairs (majors, crosses, sometimes exotics)
- Operating on multiple timeframes (M15 through D1 most common)
- Combining technical analysis (zones, smart-money concepts, indicators) with discretion
- Wanting automation for mechanical parts of their process (risk sizing, breakeven, partial closes, scanning) while retaining control over entry/exit decisions
- Often running multi-monitor desktop setups but also checking from mobile during the day

They are not algorithmic-trading firms, not quant funds, not HFT. They are traders who want software discipline without handing their account to a black box.

## Deployment modes

Three ways ForexFlow runs, all from the same codebase:

| Mode | Audience | How it runs |
|---|---|---|
| **Dev** | Contributors | `pnpm dev` — all apps via Turbo |
| **Desktop** | Non-technical traders | Signed (or unsigned-with-instructions) DMG, wraps web + daemon |
| **Self-hosted** | Power users wanting remote access | Daemon as Docker or bare process; web hits it over LAN or tunnel |

## Core concepts

### OANDA as trade repository

OANDA is the **source of truth** for all position and order state. ForexFlow does not maintain a separate representation of "what is open" — it mirrors OANDA's truth into its local database on a short interval and via a live transaction stream.

Any write operation (place, close, modify) goes to OANDA first. Only once OANDA confirms does ForexFlow reflect the change locally.

Implication: agents must never construct or mutate position records as if they were authoritative. They are a cache.

### Source / metadata pattern

Every trade row in the database has a `source` field that is always `"oanda"`. The true origin of a trade (what caused it to be placed) lives in the trade's `metadata.placedVia` field:

- `"manual"` — user clicked a button in the ForexFlow UI
- `"tv_alert"` — TradingView webhook routed through the CF Worker
- `"trade_finder"` — the zone/pattern scanner surfaced and placed it
- `"trade_finder_auto"` — trade-finder placed automatically without user approval
- `"ai_trader"` — the multi-tier AI scanner chose it
- `"smart_flow"` — SmartFlow's autonomous management placed or managed it

UI badges map `placedVia` to human-readable labels and colors. Exact label mappings will be defined by the `.claude/rules/15-trading-domain.md` rule when application code lands.

### Signal flow (TradingView alerts)

```
TradingView → Cloudflare Worker POST /webhook/{token}
           → Durable Object AlertRouter validates + queues
           → Daemon WebSocket relay
           → SignalProcessor validates + places order
           → OANDA (source of truth)
           → transaction stream notifies daemon
           → daemon broadcasts update to web/desktop clients
```

### Three trading automation surfaces

| System | What it does | Key primitive |
|---|---|---|
| **TradingView Alerts** | Route external signals to real orders | Webhook token + signal schema |
| **Trade Finder** | Scan charts for supply/demand zones, BOS, FVG, OB — surface setups | Zone scorer + confluence |
| **AI Trader (EdgeFinder)** | Multi-tier LLM pipeline: local TA → Haiku filter → Sonnet decision | Tiered cost/quality ladder |
| **SmartFlow** | Autonomous 4-mode scanner + AI-monitored trade management | Strategy presets + management engine |

All four share primitives from a `trading-core` module: circuit breakers, correlation guards, risk sizing, R:R multipliers, news gates, breakeven/trailing rules.

### Price precision (pips)

Pip size is instrument-dependent:

- Most pairs: `0.0001` (four decimal places; the fourth is the pip)
- JPY quote pairs (`*_JPY`): `0.01` (two decimal places; the second is the pip)
- Some precious metals and indices have their own conventions

Agents must **never hardcode pip sizes**. Always route through the shared pip utilities that will live in `packages/shared/pip-utils.ts`. Hardcoding causes ~160× errors on JPY pairs.

### Risk sizing

Position size is derived from risk, not specified directly. The formula:

```
units = floor(riskAmount / (riskPips × pipValuePerUnit))
```

Where:

- `riskAmount` = `accountEquity × riskPercent / 100`
- `riskPips` = distance from entry to stop loss, in pips
- `pipValuePerUnit` = pip value in account currency (differs for JPY quote pairs, cross-pairs)

The agent-driven systems (TradingView, Trade Finder, AI Trader, SmartFlow) must all go through the same shared `calculatePositionSize()` primitive.

### Circuit breakers

A circuit breaker pauses automated placement when things go wrong. Triggers:

- **N consecutive losses** (configurable per system, e.g. 3 → 4-hour pause, 5 → 24-hour pause)
- **Daily drawdown** exceeds threshold (typically 3% → 50% sizing reduction, 5% → full pause)
- **External pause** invoked by the user via the kill-switch

Every automated system has its own circuit breaker state, but they share the same primitive (in trading-core). Circuit breaker state is observable via REST and WebSocket.

### Market hours and session gating

Forex runs ~24/5. Key sessions:

- **Asian** (Tokyo) — ~23:00–08:00 UTC
- **London** — ~07:00–16:00 UTC
- **New York** — ~12:00–21:00 UTC
- **Kill zones** (high-liquidity overlaps): London open (07:00–10:00 UTC), NY open (12:00–15:00 UTC)

Trading rolls over at **17:00 ET** (not midnight UTC, not midnight local). The "forex trading day" is 17:00 ET → 17:00 ET.

Session gating rules live in the domain rule (`.claude/rules/15-trading-domain.md`) and are enforced by the session-util primitives in `packages/shared`.

## Glossary

| Term | Meaning |
|---|---|
| **Pip** | Smallest standard price move. `0.0001` for most pairs, `0.01` for JPY quote pairs |
| **Spread** | Difference between bid and ask. Cost of entering/exiting |
| **SL / TP** | Stop Loss / Take Profit — exit prices |
| **R:R** | Risk-to-reward ratio. E.g. `1:2` means reward is 2× risk |
| **MFE / MAE** | Maximum Favorable / Maximum Adverse Excursion — how far a trade went in/against your direction |
| **OB** | Order Block — a candle before a strong move, often acts as support/resistance on retest |
| **FVG** | Fair Value Gap — a three-candle imbalance where the middle candle skips price |
| **BOS** | Break of Structure — when price breaks a prior swing high/low |
| **S/D Zone** | Supply / Demand Zone — consolidation areas that preceded strong moves |
| **OTE** | Optimal Trade Entry — Fibonacci 0.62–0.79 retracement zone |
| **RSI / MACD / EMA / BB / ATR** | Standard indicators: Relative Strength, MA Convergence, Exponential MA, Bollinger Bands, Average True Range |
| **SMC** | Smart Money Concepts — a trading methodology centered on OB, FVG, BOS, liquidity |
| **Scalper / Intraday / Swing** | Strategy profiles by hold time (minutes / hours / days) |
| **Kill zone** | High-liquidity session overlap windows |
| **Confluence** | Multiple independent signals agreeing — more confluence = higher conviction |
| **Divergence** | Price makes new high/low but indicator doesn't (or vice versa) — reversal hint |
| **Correlation** | How much two pairs move together. High correlation between open trades compounds risk |

## What ForexFlow is **not**

Agents should decline requests that would turn ForexFlow into:

- A broker, exchange, or order-routing service for third parties
- A crypto-trading platform (forex only; crypto integrations deferred indefinitely)
- A copy-trading or signal-selling marketplace
- A hosted SaaS with multi-tenant accounts (it is self-hosted by design)
- A backtesting engine (the focus is live/forward execution with discipline; backtesting may come later but is not core)
- An algorithmic trading fund manager (it supports discretionary traders, not fully autonomous systems)

If a user requests work that would push ForexFlow toward any of these, stop and ask. This is an "unknown territory" signal.
