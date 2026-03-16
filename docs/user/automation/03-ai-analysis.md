---
title: "AI Analysis"
description: "Use Claude AI to analyze your trades, get recommendations, and set automated conditions."
category: "automation"
order: 3
---

# AI Analysis

AI Analysis brings artificial intelligence directly into your trading workflow. It uses **Claude** (made by Anthropic) to look at your open trades and give you advice — similar to having a knowledgeable trading mentor available any time you need a second opinion.

## What It Does

When you trigger an analysis on a trade, the AI examines:

- The current price and where it is relative to your entry, stop loss, and take profit
- Technical indicators (tools that analyze price patterns and momentum)
- The broader market context (what is happening globally that might affect your trade)
- Your risk exposure (how much you could win or lose)

It then gives you a plain-English summary with specific recommendations.

## Triggering an Analysis

There are two ways to get an AI analysis:

### Manual

On any trade table (Open Trades, Pending Orders, or Trade History), click the dropdown menu on a trade and look for the **sparkles icon** labeled "AI Analysis." Click it and a panel slides open.

### Automatic

In **Settings > AI**, you can enable auto-analysis. This triggers analysis automatically when:

- A new trade opens
- At regular intervals (e.g., every 4 hours)
- When market conditions change significantly

## Analysis Depth

You can choose how thorough the analysis should be:

| Depth    | Time     | Best For                               |
| -------- | -------- | -------------------------------------- |
| Quick    | ~30 sec  | Fast check — "is my trade still okay?" |
| Standard | ~60 sec  | Balanced review with recommendations   |
| Deep     | ~120 sec | Full breakdown with multiple scenarios |

> [!TIP]
> Use Quick for routine check-ins and Deep when you are unsure about a trade or the market is moving fast.

## Reading the Results

The analysis panel shows results in several sections:

1. **TLDR** — one sentence summary ("This trade is on track" or "Consider tightening your stop loss")
2. **Summary** — a few paragraphs explaining the overall picture
3. **Technical** — what the indicators are saying (trend direction, momentum, support/resistance levels)
4. **Risk Assessment** — how much you stand to gain or lose, and the probability estimate
5. **Market Context** — news events, economic data, or broader trends that might affect the trade
6. **Recommendations** — specific actions the AI suggests

## Immediate Actions

Based on its analysis, the AI may suggest action buttons you can click:

- **Adjust SL** — move your stop loss to a better level
- **Close Trade** — exit the trade entirely
- **Partial Close** — close part of your position to lock in some profit
- **Adjust TP** — move your take profit target

> [!WARNING]
> These buttons execute real actions on your OANDA account. Always read the AI's reasoning before clicking. The AI is a tool, not a guarantee.

## Trade Conditions

Trade Conditions are automated rules that monitor your trade and take action when something happens. The AI can suggest conditions, or you can create them yourself.

### Condition Types

- **Price reaches level** — e.g., "if EUR/USD drops below 1.0800"
- **P/L hits target** — e.g., "if this trade is up $150"
- **Time-based** — e.g., "if this trade has been open for 24 hours"
- **Trailing stop** — moves the stop loss up as price moves in your favour

### Action Types

When a condition triggers, it can:

- **Close the trade** — exit completely
- **Partial close** — close a portion (e.g., 50%)
- **Move SL/TP** — adjust stop loss or take profit
- **Just notify** — send you an alert without taking action

### Safety Features

- **Grace period** — destructive actions (closing a trade or cancelling an order) are blocked for 60 seconds after a trade opens or a condition is created, whichever is later. This prevents a condition from immediately closing a trade before you have had a chance to review it. Stop-loss modification conditions have an additional 30-second grace period after trade open or condition creation before they can fire.
- **30-second sustain check** — PnL-based conditions that move your stop loss (e.g., "at +10 pips profit, move SL to breakeven") must sustain their trigger level for 30 continuous seconds before firing. This prevents brief price spikes from triggering a premature SL move.
- **Smart breakeven buffer** — when a condition moves your stop loss to breakeven, a small buffer based on spread and volatility is automatically added. Instead of placing the SL at the exact entry price (where spread alone could stop you out), the SL is placed slightly beyond entry to account for real market conditions.
- **Trailing stop floor** — when a trailing stop is chained to a breakeven condition, the trail can never move your stop loss below your entry price. This preserves the breakeven protection.
- **Tiered automatic expiry** — AI-created conditions expire based on their type: stop-loss moves expire after 48 hours, trailing stops after 72 hours, and other conditions after 7 days. This stops stale conditions from triggering on market moves that no longer match the original analysis. You can always create fresh conditions with a new analysis.
- **Priority order** — when multiple conditions exist on the same trade, they are evaluated in priority order (highest priority first). If a condition closes or cancels the trade, remaining conditions are skipped for that tick.
- **AI breakeven intelligence** — the AI follows strict rules before suggesting breakeven moves: the trade must have captured at least 40% of its take-profit distance, been open for at least 15 minutes, and volatility conditions must be suitable. This prevents premature breakeven moves on trades that need room to develop.
- **Close context tracking** — when an AI condition moves your SL to breakeven and that SL is later hit, the trade's outcome badge shows "SL (AI Breakeven)" in amber instead of the generic "Stop Loss" in red, so you can see exactly what happened.

> [!NOTE]
> Conditions keep running even when you are not looking at FXFlow. They are like a watchdog that monitors your trade 24/7.

## Cost

AI analysis uses API tokens, which cost real money. Each analysis shows an estimated cost before you confirm, and the actual cost after it completes. Typical costs:

- Quick: a few cents
- Standard: around 5–10 cents
- Deep: 10–25 cents

You can track your total AI spending in **Settings > AI > Usage**.

> [!TIP]
> Set a monthly budget cap in AI Settings to avoid surprise costs. FXFlow will warn you when you are approaching your limit.

## Summary

AI Analysis is your on-demand trading advisor. Use it to validate your decisions, catch things you might miss, and set up automated conditions that protect your trades while you sleep. Start with manual analyses to build trust in the system, then explore auto-analysis once you are comfortable.
