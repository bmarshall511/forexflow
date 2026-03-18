---
title: "Trade Plans"
description: "How to create, manage, pause, and delete SmartFlow trade plans."
category: "smart-flow"
order: 3
---

# Trade Plans

A **trade plan** is the set of rules SmartFlow follows for a specific trade. It tells SmartFlow which currency pair to trade, which direction (buy or sell), when to enter, and which strategy to use for managing the trade.

## Creating a Trade Plan

Click **New Plan** at the top of the SmartFlow page to open the trade builder wizard. The wizard walks you through four steps:

### Step 1 — Currency Pair

Select the currency pair you want to trade (e.g., EUR/USD, GBP/USD). SmartFlow supports all OANDA-available pairs.

### Step 2 — Direction

Choose **Buy** (long — you expect the price to go up) or **Sell** (short — you expect the price to go down).

### Step 3 — Entry Timing

Choose when SmartFlow should enter:

- **Right Now** — places a market order at the current price immediately
- **Wait for My Price** — SmartFlow watches and enters when price reaches your target. You set the target price and an expiry time (how many hours SmartFlow should wait before cancelling the plan if price never reaches your level)

### Step 4 — Strategy

Pick one of the five strategies (Steady Growth, Momentum Catch, Swing Capture, Trend Rider, Recovery Mode). Each card shows the strategy's risk level, typical hold time, and a summary of what SmartFlow will do. Expand "What this means" for a step-by-step explanation.

If AI analysis has been run on your account, SmartFlow may suggest a recommended strategy based on current market conditions. This suggestion is advisory — you always make the final choice.

### Step 5 — Review

A summary screen shows your complete plan before activation. Review the pair, direction, entry mode, and strategy. When you're happy, click **Activate Plan**.

## The Trade Plans Tab

All your plans are listed on the **Trade Plans** tab. Each plan card shows:

- **Status badge** — TRADING (green), WATCHING (blue, waiting for smart entry), PAUSED (grey), or READY (amber, active but no trade placed yet)
- **Pair and direction** — e.g., EUR/USD with a BUY badge
- **Strategy name and icon**
- **Plain English status** — a human-readable description of what SmartFlow is currently doing with this plan, e.g., "Managing your trade — break-even protection is active" or "Watching for EUR/USD to reach 1.0920"
- **Protection badges** — icons showing which protections are enabled. A green checkmark means that protection has already fired on the current trade
- **Latest activity** — the most recent thing SmartFlow did for this plan

## Pausing and Activating a Plan

Each plan card has a **Pause** / **Activate** button:

- **Pause** — the plan stays in your list but SmartFlow won't place any new trades from it. Any trade already running for this plan continues to be managed until it closes.
- **Activate** — a paused plan becomes active again. If it was waiting for a smart entry price, it resumes watching.

## Deleting a Plan

Click the trash icon on any plan card to delete it. A confirmation dialog appears to prevent accidental deletion.

> [!WARNING]
> Deleting a plan with an active trade will cancel that trade. SmartFlow will close the live trade on OANDA. Make sure you actually want to exit the trade before confirming.

## Multiple Plans

You can have multiple trade plans active at the same time. SmartFlow manages each one independently. The header shows a tile counting how many trade plans are active and how many trades are currently live.

> [!NOTE]
> The maximum number of concurrent SmartFlow trades is controlled by your settings (Settings → SmartFlow → Max Concurrent Trades). If all slots are taken, new plans will queue until a trade closes.
