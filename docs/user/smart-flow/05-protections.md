---
title: "Trade Protections"
description: "The automatic protections SmartFlow applies to keep your money safe while trades run."
category: "smart-flow"
order: 5
---

# Trade Protections

One of SmartFlow's most valuable jobs is protecting your open trades. While a trade is live, the management engine evaluates every price tick and applies safety rules automatically. You don't have to watch the chart.

## Break-Even Protection

Once a trade moves far enough in your favor, SmartFlow moves the stop-loss to your entry price. This means the **worst outcome becomes breaking even** — you can no longer lose money on that trade.

The exact trigger point depends on the strategy. For Steady Growth, break-even activates after the trade moves roughly one ATR (Average True Range — a measure of how much the pair normally moves) in your favor.

> [!NOTE]
> SmartFlow adds a small buffer when setting break-even. Rather than placing the stop-loss at the exact entry price (where even the normal buy/sell spread could immediately trigger it), it places it just beyond entry. This gives the trade a bit of breathing room.

On the trade plan card, the break-even badge turns **green with a checkmark** once break-even has been triggered for the current trade.

## Trailing Stop

A trailing stop follows the price as it moves in your favor, automatically locking in progressively more profit. When the price reverses by more than the trail distance, the stop is hit and the trade closes with its gains locked in.

**Session-aware trailing:** SmartFlow knows that different market sessions have different levels of activity. During quieter hours (Asian session), the trail distance is wider to avoid getting stopped out by session noise. During busy overlaps (London/New York), it's tighter.

Like break-even, the trailing stop badge on the plan card shows **green with a checkmark** once it's been activated.

## Partial Close

Some strategies automatically close part of your position at profit milestones. For example, Steady Growth closes 50% of the position when price reaches halfway to the take-profit. This locks in real money while leaving the other half to run.

Partial closes show up in the Activity tab as "Partial close" management events.

## News Protection

When enabled, SmartFlow avoids placing new trades (and can pause existing management actions) around major scheduled economic events (like central bank rate decisions or non-farm payroll releases). These events can cause sudden, unpredictable price spikes that can stop out even well-placed trades.

## Spread Protection

SmartFlow tracks the normal spread (the difference between buy and sell price) for each currency pair. If the current spread jumps to an unusual multiple of the normal spread — often during news events or off-peak hours — SmartFlow waits before entering a new trade.

This prevents you from entering a trade when transaction costs are much higher than normal.

## Safety Net Rules

Each strategy includes a set of hard safety rules that close the trade if things go badly:

- **Max drawdown** — if the trade loses more than a configured percentage of your account, it is closed. Prevents a single bad trade from doing major damage.
- **Max hold time** — if the trade hasn't resolved after the maximum hold period (configured per strategy), SmartFlow closes it. Prevents trades from sitting open indefinitely.
- **Max overnight fees** — if the cumulative overnight financing charges on the trade exceed a dollar threshold, the trade is closed. Prevents slow-burn costs from eating your profits.

Safety net closures are recorded in History as "safety exits" and in the Activity tab as "Safety net triggered" events.

## Rule Evaluation Order

The management engine evaluates rules in a specific order on each price tick:

1. Safety net checks (drawdown, hold time, financing) — these take priority; if triggered, the trade closes and no further rules run
2. Take-profit check (used by Trend Rider as a fallback)
3. Break-even check
4. Trailing stop check
5. Partial close check

This means safety nets always fire before profit-taking rules, ensuring your capital is protected first.

## Viewing Protection Status

The **Active Trades** tab shows your live SmartFlow trades with their current protection status. The plan card in the **Trade Plans** tab also shows protection badges — a plain icon means the protection is enabled; a **green checkmark** means it has already fired on the current trade.
