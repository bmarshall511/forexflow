---
title: "Activity & History"
description: "Understanding the Activity feed and History tab in SmartFlow."
category: "smart-flow"
order: 4
---

# Activity & History

SmartFlow keeps a complete record of everything it does. The **Activity** tab shows a live log of events as they happen. The **History** tab shows completed trades with outcome summaries.

## The Activity Tab

The Activity tab is a real-time feed of SmartFlow actions, updated via WebSocket as each event occurs. Events are grouped by day (Today, Yesterday, and earlier dates).

### Filtering Events

Use the filter bar at the top to focus on what matters:

- **All** — every event, chronologically
- **Trades** — entry and exit events only (orders placed, filled, watching, expired)
- **Management** — protection actions (break-even set, trailing stop moved, partial close)
- **System** — engine status, plan activations/deactivations, market status

### Event Types

**Trade events** tell you what happened with order placement and filling:

- _Entry placed_ — SmartFlow sent an order to OANDA
- _Entry filled_ — the order became a live trade
- _Entry watching_ — smart entry plan is active, monitoring for your target price
- _Entry progress_ — price is getting close to your smart entry target (e.g., "75% of the way")
- _Entry triggered_ — price reached your target and SmartFlow is placing the order now
- _Entry expired_ — your smart entry time window ran out before price reached your level
- _Entry blocked_ — SmartFlow decided not to enter (e.g., spread too wide, max trades reached)
- _Trade closed_ — a live trade has been exited

**Management events** tell you what protections fired:

- _Break-even set_ — stop-loss moved to entry price; you can no longer lose on this trade
- _Trailing stop activated_ — the stop has started following price automatically
- _Trailing stop moved_ — the trailing stop advanced to a new level, locking in more profit
- _Partial close_ — SmartFlow took some profit while keeping the rest of the position running
- _Safety net triggered_ — a protection rule closed the trade early (e.g., max drawdown hit, max hold time reached)

**System events** tell you about SmartFlow's status:

- _Engine started_ — SmartFlow started up; shows which pairs it's watching
- _Monitoring update_ — a periodic summary (every 5 minutes) showing active trades and watching status
- _Market status_ — market open/close events

### Clearing the Log

Click **Clear** to empty the activity log. This only removes it from your view — the underlying trade data is not affected.

### Real-Time Updates

The Activity tab listens for `smart_flow_activity` WebSocket messages and adds events without a page refresh. You can leave the tab open and watch SmartFlow work in real time.

## The History Tab

The History tab shows all completed SmartFlow trades — trades that have been closed and are no longer active.

### Summary Bar

At the top of the History tab, a summary bar shows aggregate statistics across all completed SmartFlow trades:

- **Total trades** — how many SmartFlow trades have closed
- **Targets hit** — trades that closed at or near their take-profit (successful exits)
- **Safety exits** — trades closed by a safety rule rather than a profit target
- **Success rate** — percentage of trades that hit their target
- **Average duration** — mean trade hold time across all closed trades

### Trade Cards

Each closed trade is shown as a card with:

- **Pair and direction** — which pair and whether it was a buy or sell
- **Strategy** — which strategy was used
- **Outcome icon** — a visual indicator of how the trade closed (target hit vs safety exit)
- **Management summary** — which protections fired during the trade's lifetime (break-even, trailing, partial close)
- **Duration** — how long the trade was open

> [!TIP]
> Reviewing your History tab regularly helps you understand which strategies are working best for your chosen pairs and market conditions.
