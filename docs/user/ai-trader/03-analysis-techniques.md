---
title: "Analysis Techniques"
description: "All 14 analysis techniques the AI uses to find trades, explained in plain English"
category: "ai-trader"
order: 3
---

# Analysis Techniques

The AI Trader uses 14 different techniques to analyze the market. Think of each technique as a different tool in a toolbox. A carpenter wouldn't build a house with just a hammer — they need saws, drills, levels, and more. The same idea applies here.

These techniques are split into three groups.

---

## Smart Money Concepts (SMC) — What the Big Players Do

These techniques try to figure out what large banks and hedge funds are doing. Why? Because they move the market. If you can figure out their game plan, you can follow along.

### Market Structure

**What it does:** Looks at the overall pattern of price movement to determine if the market is going up, going down, or moving sideways.

**The analogy:** Imagine watching a bouncing ball. If each bounce goes higher than the last one, the ball is trending upward. If each bounce is lower, it's trending downward. Market structure tracks these "bounces" (called highs and lows) to figure out the direction.

### Fair Value Gap (FVG)

**What it does:** Finds spots where price moved so fast it left a "gap" in the chart.

**The analogy:** Imagine running up a staircase so fast that you skip a step. That skipped step is the gap. Price often comes back down to "fill" that step before continuing, which creates a trading opportunity.

### Order Block

**What it does:** Identifies zones where big institutions (banks, hedge funds) placed massive buy or sell orders in the past.

**The analogy:** Like an invisible wall in a video game. You can't see it, but when your character runs into it, they bounce off. Price behaves the same way around order blocks — it often bounces when it hits these zones.

### Liquidity Sweep

**What it does:** Detects when price briefly breaks past an important level to trigger stop losses before reversing direction.

**The analogy:** Like a fake-out in basketball. The player drives hard to the left, the defender commits, then the player spins right and scores. Big players push price past a level to shake out smaller traders, then reverse. The AI watches for this trick.

### Supply and Demand Zones

**What it does:** Finds areas where a LOT of buying or selling happened in the past.

**The analogy:** Think of a popular store that always sells out of a product at $10. Every time the price drops to $10, people rush in and buy (demand zone). Every time it rises to $20, people sell because they think it's expensive (supply zone). These zones tend to hold again and again.

### Fibonacci OTE (Optimal Trade Entry)

**What it does:** Uses mathematical ratios to find the ideal "sweet spot" for entering a trade during a pullback.

**The analogy:** These ratios show up everywhere in nature — in the spiral of a seashell, the arrangement of flower petals, the branches of a tree. Traders discovered that markets often reverse at these same ratios. The "Optimal Trade Entry" zone is between 62% and 79% of a price pullback, where the best entries tend to happen.

> [!FOREX]
> A **pullback** is when price temporarily moves against the trend. If a currency is going up and dips for a bit before continuing up, that dip is a pullback. Buying during the dip (instead of at the top) gives you a better entry price.

---

## Trend and Momentum — Which Way and How Fast?

These techniques figure out the market's direction and whether it has enough energy to keep going.

### EMA Alignment

**What it does:** Checks if three moving averages (20-period, 50-period, and 200-period) are stacked in order.

**The analogy:** Imagine asking three weather forecasters if it will rain tomorrow. If all three say "yes," you can be pretty confident it will rain. The three moving averages are like three forecasters — when they all agree on the direction (all pointing up, or all pointing down), the trend is strong.

> [!FOREX]
> A **moving average** is the average price over a certain number of time periods. A 20-period average reacts quickly to new prices (short-term view). A 200-period average is much slower (long-term view). When fast, medium, and slow all agree, that's a powerful signal.

### Trend Detection

**What it does:** Classifies the current market as **trending up**, **trending down**, or **moving sideways** (ranging).

**The analogy:** Before you start a hike, you look at the trail and ask: "Is this path going uphill, downhill, or is it flat?" Trend detection answers that basic question for the market. Everything else builds on this foundation.

### ADX Regime

**What it does:** Measures **how strong** a trend is on a scale from 0 to 100.

**The analogy:** Think of measuring wind speed before going sailing. Knowing the wind direction is useful, but you also need to know how strong it is. ADX does exactly that:

- **Below 20** = barely any wind (no real trend, choppy market — avoid)
- **20-25** = light breeze (trend may be forming)
- **Above 25** = strong wind (solid trend worth trading)
- **Above 50** = gale force (very powerful trend)

### Divergence

**What it does:** Detects when the price is moving one direction but an indicator is moving the other way.

**The analogy:** Imagine a car's speedometer going up while the engine starts making sputtering noises. The speed says everything is fine, but the engine says something is wrong. When price and indicators disagree like this, it's a warning that the current direction might be about to change.

---

## Oscillators — Is the Market Stretched Too Far?

These techniques measure whether a currency has moved too far in one direction and might be due to snap back.

### RSI (Relative Strength Index)

**What it does:** Gives a score from 0 to 100 showing whether the price has risen or fallen too much too quickly.

**The analogy:** Like a rubber band. The more you stretch it, the harder it snaps back.

- **Below 30** = "oversold" — price has dropped a lot and might bounce up
- **Above 70** = "overbought" — price has risen a lot and might drop
- **Between 30 and 70** = normal range

### MACD (Moving Average Convergence Divergence)

**What it does:** Shows when momentum is shifting from bearish (going down) to bullish (going up), or vice versa.

**The analogy:** Imagine two runners on a track — a fast one and a slow one. When the fast runner overtakes the slow one, momentum is building in that direction. That crossover moment is the signal.

### Williams %R

**What it does:** Similar to RSI, but measured on a scale from -100 to 0.

- **Below -80** = oversold (potential buying opportunity)
- **Above -20** = overbought (potential selling opportunity)

**The analogy:** Think of it as a depth gauge. When the needle drops close to -100, the price has "sunk" as deep as it typically goes and might float back up.

### Bollinger Bands

**What it does:** Creates a "band" around the average price that shows the normal range. When price touches the outer edges, it's at a statistical extreme.

**The analogy:** If you measured the height of 100 people, most would be between 5'0" and 6'5". Someone who is 7'0" is an outlier — way outside the normal range. Bollinger Bands do the same thing with price. When price hits the outer band, it's unusually far from average and might come back toward the middle.

---

## How They Work Together (Confluence)

No single technique is reliable on its own. A rubber band CAN stay stretched for a long time. A trend CAN exist without a good entry point. That's why the AI looks at all 14 together.

**Confluence** means multiple techniques agreeing at the same time. The more that agree, the higher the confidence score.

**Example of a strong buy signal (4 techniques agreeing):**

1. RSI says "oversold" (price dropped a lot)
2. Price is sitting right on a demand zone (people bought here before)
3. EMAs are all aligned bullish (trend is up)
4. MACD just crossed upward (momentum is shifting up)

Four different techniques, using completely different math, all saying the same thing: "buy." That's powerful.

> [!TIP]
> You can enable or disable individual techniques in **Settings > AI Trader**. But more techniques means more data points for the AI, which generally leads to better decisions. It's usually best to leave them all on.

> [!NOTE]
> You don't need to memorize any of this. The AI handles all 14 techniques automatically. This page is here so you can understand WHY the AI made a particular decision when you review its analysis.
