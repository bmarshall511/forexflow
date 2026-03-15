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

## Filtering and Pagination

When you have lots of trades, you can narrow things down:

- **Filter by instrument** — Show only trades for a specific currency pair
- **Filter by source** — Show only manual trades, or only automated ones
- **Filter by tags** — Show trades with specific labels you've applied (see [Tags](./05-tags.md))
- **Search** — Type to find trades by instrument name

If you have many trades, the list is split into **pages** (like pages in a book). Use the page navigation at the bottom to move forward and backward through your trade history.

> [!TIP]
> Use the Closed tab regularly to review your trades. Looking at what went right and what went wrong is one of the best ways to improve as a trader.
