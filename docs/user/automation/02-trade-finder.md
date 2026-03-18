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

When Trade Finder identifies a zone, it gives it a **score from 1 to 16**. This score reflects how strong and reliable the setup looks across 10 dimensions:

| Score Range | Quality  | What It Means                             |
| ----------- | -------- | ----------------------------------------- |
| 1–5         | Weak     | Zone exists but signals are not strong    |
| 6–10        | Moderate | Decent zone with reasonable confirmation  |
| 11–16       | Strong   | High-quality zone, multiple factors align |

The 10 scoring dimensions are:

1. **Strength** (0–2) — how explosively price left the zone
2. **Time** (0–1) — how few candles the base has (fewer = better)
3. **Freshness** (0–2) — has the zone been tested? (untested = best)
4. **Trend** (0–2) — is the medium-timeframe trend aligned?
5. **Curve** (0–1) — is price in the right area of the higher-timeframe curve?
6. **Profit Zone** (0–3) — risk-to-reward ratio to the nearest opposing zone
7. **Commodity** (0–1) — does the correlated commodity confirm?
8. **Session** (0–1) — is this pair optimal for the current trading session?
9. **Key Level** (0–2) — is entry near a round number or previous day/week high-low?
10. **Volatility** (0–1) — is the market in a favorable regime for zone trading?

> [!TIP]
> Higher scores do not guarantee success, but they have better historical probability. Most traders set their auto-trade threshold at 9 or above.

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

- **Max concurrent orders** — how many pending orders can exist at once
- **Max daily auto-trades** — how many auto-trades can be placed per day (0 = unlimited)
- **Max risk per trade** — maximum percentage of your account to risk on each setup
- **Max total risk %** — stop auto-trading if total risk across all auto-orders exceeds this % of your balance
- **Minimum R:R** — minimum reward-to-risk ratio (e.g., 2:1 means the potential profit must be at least twice the potential loss)

> [!WARNING]
> Always set these limits before enabling auto-trade. Without them, the scanner could place too many orders during a busy market session.

## Setup Badges

When auto-trade is enabled, each setup card shows a badge indicating its auto-trade status:

- **Eligible** (teal) — the setup passes all checks and will be placed when price reaches the entry zone
- **Queued #N** (blue) — the setup is eligible but waiting for a cap slot to open (e.g., max concurrent orders reached). The number shows its priority position — when a slot opens, the highest-priority queued setup is placed first
- **Blocked** (amber) — the setup will not auto-place (e.g., score too low, R:R below minimum, or same-instrument conflict)

The reason for queuing or blocking is shown as a subtitle below the badge.

## Cap Utilization

When auto-trade is on, the dashboard status bar shows two additional tiles:

- **Concurrent** — how many auto-placed pending orders exist vs the maximum (e.g., "3/5")
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

## Performance Tab

The Performance tab shows how your Trade Finder trades are performing over time. It tracks:

- **Win rate** — percentage of trades that were profitable
- **Total P&L** — cumulative profit/loss across all Trade Finder trades
- **Profit Factor** — ratio of gross wins to gross losses (above 1.5 is good)
- **Average R:R** — actual risk-reward achieved vs what was expected at placement

Performance is broken down by:

- **Score range** — do higher-score setups actually win more often?
- **Timeframe** — which timeframe sets perform best?
- **Instrument** — which currency pairs produce the best results?

Use the period selector (7d, 30d, 90d, All) to zoom in on recent or long-term performance.

> [!TIP]
> If a specific score range or instrument consistently underperforms, the adaptive tuner will suggest raising thresholds or disabling those pairs.

## Trade Management

Once a Trade Finder trade is filled (open), the system can actively manage it to protect profits and cut losses faster. These features are configured in Settings > Trade Finder > Trade Management.

### Breakeven Move

When your trade reaches **1:1 risk-reward** (it has moved in your favor by the same amount it could have lost), the stop loss is automatically moved to your entry price plus a small buffer. This means you can no longer lose money on this trade.

### Partial Profit

After the breakeven move, when the trade reaches a configurable R:R target (default 1.5:1), a portion of the position is closed to lock in profits. The remaining position continues to run toward the full take profit.

### Trailing Stop

After partial profit is taken, the stop loss trails behind the current price. As price moves further in your favor, the stop loss follows — locking in more profit. It never moves backward.

### Time-Based Exit

If a trade hasn't made meaningful progress after a configurable number of candles, it is closed at market. Good supply/demand zones produce immediate reactions — if price stalls, the zone thesis may be weakening.

> [!NOTE]
> Each management action is shown as a badge on the setup card: "BE Locked" (breakeven), "Partial Taken", etc.

## Reviewing Trade Finder Trades

When a Trade Finder setup becomes a live trade (or closes), you can view the full setup context from the **Positions** page. Click on any trade with a "Trade Finder" source badge to open the detail drawer, which includes:

- **Chart overlays** — The trigger zone, MTF trend, and HTF curve are overlaid on the trade chart, showing exactly what the scanner saw when it detected the setup.
- **Setup Analysis** — A dedicated section with the setup's score gauge, trade thesis narrative, market context, and timing metadata.
- **Score Breakdown** — All 7 scoring dimensions (Strength, Time, Freshness, Trend, Curve, Profit Zone, Commodity Correlation) with progress bars.

This makes it easy to review why Trade Finder took a trade and evaluate its decision quality against the actual outcome.

> [!TIP]
> Use the overlay toggle pills below the chart to show or hide zones, trend lines, and curve bands independently.

## Getting Started

1. Go to the Trade Finder page
2. Select which currency pairs to scan
3. Set your minimum score threshold
4. Configure risk controls (max concurrent orders, risk %, min R:R)
5. Start in **manual mode** first — watch the setups and verify they match your expectations
6. Once comfortable, enable auto-trade

> [!TIP]
> Run Trade Finder in manual mode for at least a week before enabling auto-trade. This lets you see the quality of setups it finds without risking real money.
