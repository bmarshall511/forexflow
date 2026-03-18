---
title: "SmartFlow Settings"
description: "Global defaults, safety limits, and AI budget for SmartFlow."
category: "settings"
order: 10
---

# SmartFlow Settings

SmartFlow settings control the global behaviour of the automated trading assistant — how many trades it can run at once, what the default safety limits are, and how much you're willing to spend on optional AI features.

To open SmartFlow settings, go to **Settings → SmartFlow**.

> [!NOTE]
> These are global defaults. When you create a new trade plan, these defaults are applied. Some settings can be overridden per plan in the trade builder wizard.

## General

### Enable SmartFlow

The master on/off switch for SmartFlow. When off:

- No new SmartFlow trades will be placed
- Existing open trades continue to be protected by their stop-loss on OANDA, but SmartFlow will no longer actively manage them (no trailing, no break-even, no partial close)

### Max Concurrent Trades

The maximum number of SmartFlow trades that can be open at the same time. If this limit is reached, new trade plans queue until an existing trade closes.

**Recommended starting value:** 1–3 while you're learning how SmartFlow behaves.

### Max Margin Usage (%)

The maximum percentage of your available account balance that SmartFlow can commit to trades. Think of it as a total spending cap. If you set this to 40%, SmartFlow will not open a new trade if doing so would exceed 40% of your balance in open positions.

> [!NOTE]
> Professional traders typically use 20–40%. Setting this too high risks large losses if multiple trades go against you simultaneously.

### Default Strategy

The strategy that is pre-selected when you open the trade builder wizard. You can always change it per trade, but this saves time if you primarily use one approach.

| Strategy                    | Best For                    |
| --------------------------- | --------------------------- |
| Steady Growth (Recommended) | Most traders                |
| Momentum Catch              | Short-term, same-day trades |
| Swing Capture               | Multi-day trades            |
| Trend Rider                 | Strong trending markets     |
| Recovery Mode               | Experienced traders only    |

### Correlation Warnings

Some currency pairs move in the same direction — for example, EUR/USD and GBP/USD both tend to move with the Euro. Holding both at once effectively doubles your exposure. When correlation warnings are enabled, SmartFlow alerts you before opening a trade on a pair that moves similarly to one already open.

**Max Correlated Pairs:** how many similar pairs can be open simultaneously before SmartFlow blocks the next one.

## Safety Defaults

These limits apply to every new SmartFlow trade unless the trade builder's advanced settings override them.

### Max Drawdown (%)

If a trade loses more than this percentage of your account value, SmartFlow closes it automatically. This is your emergency safety net.

**Example:** account balance $10,000, max drawdown 5% → SmartFlow closes the trade if it reaches a −$500 loss.

**Recommended range:** 1–5%. Most professional traders risk no more than 2% per trade.

### Max Hold Time (hours)

The longest a SmartFlow trade can remain open. Once this time expires, SmartFlow closes the trade regardless of its current profit/loss. Prevents trades from sitting open indefinitely if the market stalls.

The settings page shows a human-readable conversion (e.g., "168 hours = ~7.0 days").

### Max Overnight Fees ($)

Holding a trade overnight incurs a financing charge ("swap"). If the cumulative overnight fees on a single trade exceed this dollar amount, SmartFlow closes the trade. Prevents slow-burning costs from eroding your profits on long-running trades.

### Spread Protection

When enabled, SmartFlow monitors the live spread (buy–sell price gap) for each pair. If the spread is unusually wide — more than the configured multiple of the pair's normal spread — SmartFlow delays entry until conditions normalise.

**Spread Trigger Multiple:** how many times the normal spread triggers a delay. For example, 3× means SmartFlow waits if the current spread is more than 3 times the average.

## AI Budget

SmartFlow can use Claude AI to analyse trade conditions and suggest improvements. This is optional. AI features cost money per use, so these settings let you control spending.

### Daily Budget (USD)

Maximum AI spend per day. Once reached, AI features pause until the next day.

$1/day is enough for roughly 50 analyses using the fast model.

### Monthly Budget (USD)

A hard monthly cap. Once the monthly budget is spent, all AI features are paused until the following month.

> [!TIP]
> If you don't plan to use AI features, leave both budgets at $0. SmartFlow works fully without AI — the strategies and protections run entirely on the daemon without any AI involvement.

## Recovery Mode Warning

The settings page includes a prominent warning about Recovery Mode. This strategy adds money to losing positions (position averaging), which **multiplies your maximum possible loss**. It is only appropriate for traders who fully understand the risks and have sufficient account balance to absorb multiple losing levels.
