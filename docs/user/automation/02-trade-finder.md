---
title: "Trade Finder"
description: "An automated scanner that finds supply and demand zones and can place trades for you."
category: "automation"
order: 2
---

# Trade Finder

Trade Finder is like having a tireless assistant who stares at charts all day looking for good trading opportunities. It scans currency pairs for **supply and demand zones** — areas on the chart where price is likely to reverse — and can automatically place orders when it finds strong setups.

## Supply and Demand Zones

### Demand Zone (Price Likely to Bounce Up)

Imagine a shop sells a popular toy for $20. Every time the price drops to $15, parents rush in and buy so many that the price goes back up. That $15 area is a **demand zone** — there are lots of eager buyers waiting there.

In forex, a demand zone is a price level where buyers stepped in aggressively before. When price returns to that level, there is a good chance buyers will step in again and push the price up.

### Supply Zone (Price Likely to Drop)

Now imagine the same toy at $30 — at that price, nobody wants it, so the shop has to drop the price. That $30 area is a **supply zone** — sellers overwhelm buyers and price falls.

In forex, a supply zone is where sellers took over before. When price returns there, selling pressure often pushes it back down.

> [!NOTE]
> Supply and demand trading is about finding these "bounce points" on the chart. Trade Finder does this scanning automatically across all your selected pairs.

## Setup Scores

When Trade Finder identifies a zone, it gives it a **score from 1 to 12**. This score reflects how strong and reliable the setup looks:

| Score Range | Quality  | What It Means                             |
| ----------- | -------- | ----------------------------------------- |
| 1–4         | Weak     | Zone exists but signals are not strong    |
| 5–8         | Moderate | Decent zone with reasonable confirmation  |
| 9–12        | Strong   | High-quality zone, multiple factors align |

> [!TIP]
> Higher scores do not guarantee success, but they have better historical probability. Most traders set their auto-trade threshold at 7 or above.

## Setup Lifecycle

Every setup goes through a series of stages:

1. **Active** — a zone has been identified and price is some distance away
2. **Approaching** — price is getting close to the zone (heads up!)
3. **Placed** — a limit order has been sent to OANDA, waiting at the zone's edge
4. **Filled** — price reached the order and the trade is now open
5. **Invalidated** — something changed that made the zone unreliable (e.g., price blasted through it)
6. **Expired** — price never reached the zone before the setup became too old

> [!NOTE]
> You can watch setups move through these stages on the Trade Finder dashboard in real time.

## Auto-Trade Mode

When auto-trade is enabled, Trade Finder does not just find setups — it **places orders for you**. Here is how it works:

1. Scanner finds a setup with a score above your minimum threshold
2. It calculates the entry price, stop loss, and take profit based on the zone
3. A pending order (limit order) is placed on OANDA
4. If price reaches the order, the trade fills automatically
5. If the setup becomes invalid before filling, the order is cancelled

You can also run Trade Finder in manual mode, where it shows you the setups but you decide which ones to trade.

## Risk Controls

Auto-trading without limits is dangerous, so Trade Finder has several safety settings:

- **Max daily trades** — how many orders it can place per day (e.g., 3)
- **Max concurrent orders** — how many pending orders can exist at once
- **Max risk per trade** — maximum percentage of your account to risk on each setup
- **Minimum R:R** — minimum reward-to-risk ratio (e.g., 2:1 means the potential profit must be at least twice the potential loss)

> [!WARNING]
> Always set these limits before enabling auto-trade. Without them, the scanner could place too many orders during a busy market session.

## Setup Badges

When auto-trade is enabled, each setup card shows a badge indicating its auto-trade status:

- **Eligible** (teal) — the setup passes all checks and will be placed when price reaches the entry zone
- **Queued #N** (blue) — the setup is eligible but waiting for a cap slot to open (e.g., daily limit reached). The number shows its priority position — when a slot opens, the highest-priority queued setup is placed first
- **Blocked** (amber) — the setup will not auto-place (e.g., score too low, R:R below minimum, or same-instrument conflict)

The reason for queuing or blocking is shown as a subtitle below the badge.

## Cap Utilization

When auto-trade is on, the dashboard status bar shows three additional tiles:

- **Concurrent** — how many auto-placed pending orders exist vs the maximum (e.g., "3/5")
- **Daily** — how many auto-trades have been placed today vs the daily limit (e.g., "5/5")
- **Risk** — total risk percentage of auto-placed orders vs the max risk cap (e.g., "4.2%/6%")

These tiles turn amber when a cap is reached, helping you understand why setups are queued.

## Auto-Trade Queue

When all caps are met but eligible setups still exist, they enter a priority queue. The queue is ordered by:

1. **Score** (highest first) — stronger setups get priority
2. **Distance to entry** (closest first) — as a tiebreaker, setups closer to their entry zone go first

When a slot opens (an order fills, gets cancelled, or a zone is invalidated), the top queued setup is placed automatically — you do not have to wait for the next scan cycle.

## Activity Log

The Activity tab on the Trade Finder dashboard shows every auto-trade event in real time:

- **Order placed** — which pair, at what price, with what score
- **Order filled** — a pending order became a live trade
- **Order cancelled** — setup was invalidated, order removed
- **Order failed** — something went wrong (e.g., insufficient margin)

This log is your audit trail. Check it regularly to understand what Trade Finder is doing on your behalf.

## Getting Started

1. Go to the Trade Finder page
2. Select which currency pairs to scan
3. Set your minimum score threshold
4. Configure risk controls (max trades, risk %, min R:R)
5. Start in **manual mode** first — watch the setups and verify they match your expectations
6. Once comfortable, enable auto-trade

> [!TIP]
> Run Trade Finder in manual mode for at least a week before enabling auto-trade. This lets you see the quality of setups it finds without risking real money.
