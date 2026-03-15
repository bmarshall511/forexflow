---
title: "Price Alerts"
description: "Get notified when a currency pair reaches a price level you care about."
category: "automation"
order: 5
---

# Price Alerts

Price alerts are the simplest automation tool in FXFlow. They watch a currency pair and **notify you when the price reaches a level you set**. No trades are placed — you just get a heads-up so you can decide what to do.

Think of it like setting an alarm clock, but instead of a time, you are setting it for a price.

## Why Use Price Alerts?

You cannot watch the markets every minute of the day. Price alerts let you:

- **Step away from the screen** — get notified when something interesting happens instead of staring at charts
- **Plan ahead** — set alerts at key levels and wait for the market to come to you
- **React to breakouts** — know immediately when price moves above resistance or below support
- **Monitor multiple pairs** — set alerts on 10 different pairs and only pay attention when one fires

> [!TIP]
> Professional traders use price alerts constantly. Instead of watching charts for hours, they identify key levels, set alerts, and only sit down to trade when the market is where they want it.

## Creating an Alert

### Step 1: Choose the Pair

Select which currency pair you want to monitor (e.g., EUR/USD, GBP/JPY).

### Step 2: Set the Price Level

Enter the exact price you want to be alerted at. For example, if EUR/USD is currently at 1.0850 and you want to know when it reaches 1.0900, enter 1.0900.

### Step 3: Choose the Condition

- **Crosses above** — alert fires when the price rises _above_ your level
- **Crosses below** — alert fires when the price drops _below_ your level

> [!NOTE]
> The condition matters. If EUR/USD is at 1.0850 and you set an alert for 1.0900 with "crosses above," it fires when price rises to 1.0900. If you accidentally set "crosses below," it would fire immediately since the current price is already below 1.0900.

## Managing Your Alerts

The Price Alerts page has three tabs:

### Active

Alerts that are waiting to fire. These are currently being monitored. You can edit or delete them from here.

### Triggered

Alerts that have already fired. This is your history — it shows when each alert was triggered and at what exact price. Useful for reviewing whether your levels were good.

### All

A combined view of every alert, both active and triggered.

## Repeating Alerts

By default, an alert fires **once** and then moves to the Triggered tab. But you can set an alert to **repeat**, which means it fires every time the price crosses your level.

This is useful for levels you care about long-term. For example, if 1.0800 is a major support level on EUR/USD, a repeating alert will notify you every time price returns to that area — not just the first time.

> [!TIP]
> Use repeating alerts for major support and resistance levels that you expect to be relevant for weeks or months. Use one-time alerts for specific trade setups.

## How You Get Notified

When a price alert fires, two things happen:

1. **Toast popup** — a notification appears in the corner of your screen (if FXFlow is open)
2. **Notification bell** — a badge appears on the bell icon in the header, and the alert is logged in your notification list

> [!NOTE]
> Price alerts require the FXFlow daemon to be running. If you close FXFlow completely, alerts will not fire until you reopen it. The desktop app keeps the daemon running in the background.

## Tips for Setting Good Alerts

- **Round numbers** — prices like 1.0800, 1.1000 often act as psychological levels where the market reacts
- **Previous highs and lows** — if price bounced off 1.0750 last week, it might react there again
- **Do not set too many** — 5 to 10 active alerts is plenty. Too many and you will start ignoring them
- **Clean up old alerts** — delete active alerts that are no longer relevant to keep your list tidy

## Quick Start

1. Go to the **Price Alerts** page
2. Click **New Alert**
3. Pick a pair, enter a price, choose above or below
4. Decide if it should repeat or fire once
5. Save and wait for the market to come to you
