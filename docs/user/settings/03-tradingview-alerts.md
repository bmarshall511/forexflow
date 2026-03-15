---
title: "TradingView Alerts"
description: "Configure automated trading from TradingView alert signals"
category: "settings"
order: 3
---

# TradingView Alerts

TradingView is a popular website where traders look at charts and set up alerts. When a chart pattern happens (like a price crossing a line), TradingView can send a message to FXFlow, and FXFlow can automatically place a trade. This page controls how that works.

## Cloudflare Worker URL

This is the web address of a relay service that sits between TradingView and your FXFlow. TradingView sends alerts to this address, and the relay passes them along to your FXFlow.

> [!NOTE]
> You do not need to change this unless you have set up your own Cloudflare Worker. The default value is filled in for you.

## Webhook Token

A webhook token is a secret code that proves an alert really came from your TradingView setup and not from a stranger. You paste this token into TradingView when setting up your alert.

- Click **Regenerate** to create a new token if you think the old one was compromised
- After regenerating, you must update the token in TradingView too, or alerts will stop working

> [!WARNING]
> Anyone who knows your webhook token could send fake trade signals to your account. Keep it private and never share it publicly.

## Position Size %

This controls how big each automated trade is, as a percentage of your total account balance.

For example, if your account has $10,000 and you set this to 2%, each auto-trade will use about $200.

> [!FOREX]
> Most experienced traders risk between 1% and 3% per trade. Going higher means bigger wins but also bigger losses. Start small.

## Cooldown Seconds

After placing a trade on a currency pair, FXFlow will wait this many seconds before placing another trade on the same pair. This prevents a flood of trades if your alert fires multiple times quickly.

For example, a cooldown of 60 seconds means FXFlow will ignore any duplicate signals on EUR/USD for one minute after placing a EUR/USD trade.

## Max Open Positions

This is a safety limit. If you already have this many trades open, FXFlow will stop placing new ones until some close.

Think of it as a circuit breaker — it cuts off the power before things get out of control.

## Daily Loss Limit

If your automated trades lose more than this amount (in USD) in a single day, FXFlow stops placing new auto-trades for the rest of the day.

> [!TIP]
> Setting a daily loss limit is one of the best things you can do to protect your account. Even the best strategies have bad days.

## Dedup Window

"Dedup" is short for "deduplication," which means preventing duplicates. If the exact same alert fires twice within this many seconds, FXFlow ignores the second one.

This is different from the cooldown — the cooldown applies to any signal on the same pair, while dedup catches the exact same signal sent twice (which sometimes happens due to internet glitches).

## Market Hours Filter

Currency markets are open 24 hours on weekdays, but some hours are better for trading than others. This filter lets you restrict auto-trades to specific time windows.

> [!FOREX]
> The busiest trading hours are when the London and New York sessions overlap (roughly 1pm-5pm UK time). More activity usually means better prices.

## Test Signal

The **Test Signal** button sends a fake alert through the entire system to make sure everything is wired up correctly. It will:

1. Send a fake "buy" signal
2. Wait for it to reach your FXFlow
3. Send a fake "close" signal
4. Show you whether each step succeeded or failed

> [!TIP]
> Always run a test signal after changing any settings on this page. It takes about 10-15 seconds and can save you from discovering a problem during real trading.
