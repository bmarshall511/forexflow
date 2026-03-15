---
title: "Trade Finder Settings"
description: "Configure the automatic trade setup scanner and auto-trading"
category: "settings"
order: 4
---

# Trade Finder Settings

Trade Finder is like a robot assistant that constantly scans the currency markets looking for good trading opportunities. It scores each opportunity and can even place trades automatically if you want.

## Enable / Disable

The toggle at the top turns the entire Trade Finder on or off. When disabled, it stops scanning and will not find new setups.

## Minimum Score

Every setup Trade Finder discovers gets a score from 1 to 12. Higher scores mean the setup looks more promising.

- **Default: 7** — a good balance between seeing enough setups and filtering out weak ones
- Set it higher (like 9 or 10) to only see the best-looking setups
- Set it lower (like 5 or 6) to see more setups, including less certain ones

> [!FOREX]
> A high score does not guarantee a trade will be profitable. It just means more factors line up in its favour. Even score-12 setups can lose money.

## Max Enabled Pairs

This limits how many currency pairs Trade Finder scans at the same time. The default is **10**.

Scanning more pairs means more opportunities but uses more computer resources. If FXFlow feels slow, try reducing this number.

## Pair Selection

Here you choose exactly which currency pairs to scan. For each pair, you can also pick which timeframes to analyse:

- **Hourly** — looks at hour-by-hour price movement
- **Daily** — looks at day-by-day movement (most common)
- **Weekly** — looks at week-by-week trends
- **Monthly** — looks at long-term trends

> [!TIP]
> If you are just starting out, stick with major pairs like EUR/USD, GBP/USD, and USD/JPY on the daily timeframe. These have the most predictable behaviour.

## Auto-Trade Settings

This is where things get serious. When auto-trade is enabled, Trade Finder will automatically place orders when it finds setups that meet your criteria.

### Enable Auto-Trade

Flip this toggle to let Trade Finder place real orders on your behalf. When disabled, it only shows you setups — you decide whether to trade them.

> [!WARNING]
> Auto-trade places real orders with real money (in live mode). Make sure you understand and trust the settings below before enabling this.

### Auto-Trade Min Score

This is a separate, higher threshold just for automatic trades. The default is **9** (out of 12).

Even if your display minimum is 7, auto-trade will only act on setups scoring 9 or above. This extra filter keeps auto-trading conservative.

### Max Concurrent Auto-Orders

The maximum number of auto-placed orders that can be open at the same time. Default is **3**.

If the limit is reached, additional eligible setups are queued by priority (score, then distance to entry). When a slot opens (order fills, cancels, or zone invalidates), the top queued setup is placed automatically.

### Max Total Risk %

The maximum percentage of your account that all auto-trades combined can put at risk. Default is **6%**.

> [!NOTE]
> This is calculated from the stop-loss levels. If each trade risks 2% and you have 3 open, that is 6% total risk — hitting the limit.

### Cap Visibility

When auto-trade is enabled, the dashboard header shows utilization tiles for each cap (Concurrent, Risk). Tiles turn amber when a cap is reached, so you can quickly see why setups are being queued instead of placed.

### Min Risk:Reward

The minimum ratio of potential profit to potential loss. Default is **1.5:1**.

A ratio of 1.5:1 means the trade must have the potential to earn at least $1.50 for every $1.00 it could lose. Higher ratios mean you need to win less often to stay profitable.

### Auto-Cancel on Zone Invalidation

When enabled, if the price moves in a way that "breaks" the reason the setup existed, FXFlow automatically cancels the pending order.

### Cancel All Button

Clicking **Cancel All** immediately cancels every auto-placed pending order. Use this if you want to stop all auto-trading activity right now.

> [!TIP]
> Think of Cancel All as an emergency stop button. It does not close trades that have already been filled — only pending orders waiting to be filled.
