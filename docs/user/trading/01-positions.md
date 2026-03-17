---
title: "Positions"
description: "View and manage all your trades — waiting, live, and closed"
category: "trading"
order: 1
---

# Positions

The Positions page is where you see all your trades. Every trade you've ever placed (or that was placed for you by automation) shows up here. The page is split into three tabs so you can quickly find what you're looking for.

## The Three Tabs

### Waiting (Pending Orders)

These are orders you've placed that haven't been filled yet. They're _waiting_ for the price to reach a specific level before the trade actually starts.

Think of it like ordering something online — you've placed the order, but it hasn't shipped yet. The order is "pending" until the price hits your target, and then it becomes a live trade.

From this tab, you can:

- See what price each order is waiting for
- **Cancel** an order if you change your mind (this removes it before it ever becomes a trade)

> [!FOREX]
> A "pending order" is like setting a trap at a specific price. You're saying "I want to buy EUR/USD, but only if the price drops to 1.0850." The order sits there waiting, and if the price reaches 1.0850, it automatically triggers and your trade begins.

### Live (Open Trades)

These are trades that are currently active. Real money is on the line, and the profit or loss changes in real time as prices move.

Each trade shows:

- The **currency pair** (like EUR/USD or GBP/JPY)
- Whether it's a **Buy** or **Sell** trade
- The **current P/L** (profit or loss) updating live
- Your **Stop Loss** and **Take Profit** levels

From this tab, you can:

- **Modify** a trade's Stop Loss or Take Profit
- **Partially close** a trade (sell some but keep the rest)
- **Fully close** a trade (exit completely)

> [!TIP]
> The P/L number on live trades changes constantly — that's normal! It reflects the current market price. The number only becomes "final" when you close the trade.

### Closed (Trade History)

These are trades that are finished. Either you closed them, they hit your Stop Loss or Take Profit, or they were cancelled. They're done and the profit or loss is locked in.

Each closed trade shows a badge:

- **Win** (green) — You made money on this trade
- **Loss** (red) — You lost money on this trade
- **Breakeven** (gray) — You came out roughly even, no significant gain or loss
- **Cancelled** (dimmed, strikethrough) — The order was placed but never filled. It was either cancelled by you, by the system, or it expired before the market reached the order price. Cancelled orders don't count toward your win rate or other performance statistics.

The badge also shows _how_ the trade was closed when applicable. For example, "Loss (Stop Loss)" means you lost money because your stop loss was hit, "Breakeven (Manual)" means you manually closed the trade at roughly your entry price, and "Win (Take Profit)" means your take profit target was reached.

This tab is great for reviewing your trading history and learning from past trades.

## Source Badges

Every trade has a small colored badge showing _how_ it was created. This helps you tell apart trades you placed yourself from ones that were placed automatically.

| Badge                 | Color   | Meaning                                                          |
| --------------------- | ------- | ---------------------------------------------------------------- |
| **FXFlow**            | Amber   | You placed this trade manually inside FXFlow                     |
| **TradingView Alert** | Emerald | An automated signal from TradingView placed this trade           |
| **Trade Finder**      | Purple  | The Trade Finder scanner found and placed this trade             |
| **AI Trade**          | Indigo  | The AI Trader system decided to place this trade                 |
| **OANDA**             | Blue    | Placed directly on the OANDA broker platform, not through FXFlow |

> [!NOTE]
> All trades ultimately live on OANDA (your broker). The source badge just tells you _who_ or _what_ created the trade. FXFlow tracks this so you can compare performance across different methods.

## Trade Detail View

Click on any trade to open the **detail drawer** on the right side. This shows the full picture of the trade:

- **Chart** — A candlestick chart showing the trade from entry to exit (or live for open trades). You can switch timeframes and, for open/pending trades, drag the SL/TP lines directly on the chart.
- **Trade Details** — Pair, direction, entry price, units, and timeframe.
- **Protection** — Stop Loss, Take Profit, distances in pips, and R:R ratio.
- **Performance** — P/L, duration, MFE/MAE, financing, and margin.
- **Tags** — Assign colored labels to organize trades.
- **Notes** — Add personal notes about your reasoning or lessons learned.
- **Events** — A timeline of everything that happened (fills, modifications, partial closes).

### Trade Finder Setup Analysis

When viewing a trade that was placed by **Trade Finder**, the detail drawer shows additional context from the original setup analysis:

- **Chart overlays** — The supply/demand zone that triggered the trade is displayed on the chart, along with the MTF trend (swing points, segments, controlling swing) and HTF curve bands. Toggle each overlay on or off with the pills below the chart.
- **Setup Analysis section** — Shows a circular score gauge, a natural-language "trade thesis" explaining why the setup was detected, market context (zone type, trend direction, curve position, R:R ratio), and setup metadata (detection time, placement time, timeframe set, risk/reward in pips, position size).
- **Score Breakdown** — Expand to see all 7 scoring dimensions: Strength, Time, Freshness, Trend, Curve, Profit Zone, and Commodity Correlation.

> [!TIP]
> Reviewing the setup analysis on closed trades is a great way to evaluate Trade Finder's performance. You can see exactly what the scanner detected at the time and compare it to the trade's actual outcome.

## Filtering and Pagination

When you have lots of trades, you can narrow things down:

- **Filter by instrument** — Show only trades for a specific currency pair
- **Filter by source** — Show only manual trades, or only automated ones
- **Filter by tags** — Show trades with specific labels you've applied (see [Tags](./05-tags.md))
- **Search** — Type to find trades by instrument name

If you have many trades, the list is split into **pages** (like pages in a book). Use the page navigation at the bottom to move forward and backward through your trade history.

> [!TIP]
> Use the Closed tab regularly to review your trades. Looking at what went right and what went wrong is one of the best ways to improve as a trader.
