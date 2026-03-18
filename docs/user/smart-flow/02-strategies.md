---
title: "Strategies"
description: "The five SmartFlow strategy presets — what they do, who they suit, and what to expect."
category: "smart-flow"
order: 2
---

# Strategies

When you create a SmartFlow trade plan, you choose a **strategy**. The strategy is the blueprint that determines how SmartFlow manages the trade: where it sets the stop-loss and take-profit, when it locks in profits, whether it trails the stop, and how long it holds.

Each strategy suits a different trading style and risk tolerance.

## Steady Growth (Recommended)

**Risk: Low — Typical hold: 2–3 days**

The best choice for most people. Steady Growth balances protecting your money with aiming for solid, repeatable gains. It uses a sensible stop-loss distance, moves to break-even once the trade shows profit, takes half your profit at the midpoint, then trails the stop to capture more.

**SmartFlow will:**

- Set a stop-loss based on the pair's normal price movement
- Move the stop to break-even once the trade is in profit
- Take 50% of the profit when halfway to the target
- Trail the stop as the trade continues moving in your favor
- Close after 3 days if the trade hasn't reached its target

> [!TIP]
> If you're not sure which strategy to pick, choose Steady Growth. It's designed to be robust across most market conditions.

## Momentum Catch

**Risk: Medium — Typical hold: ~8 hours**

For short-term trades that capture quick price moves within a single trading session. The target is smaller, but so is the hold time — the trade aims to be done within the same day. Break-even protection moves quickly, and the trade closes automatically before the weekend to avoid gap risk.

**SmartFlow will:**

- Set a stop-loss calibrated to current volatility
- Aim for a profit target ~1.6× the stop distance
- Move to break-even quickly once profit appears
- Close the trade if it hasn't resolved after ~8 hours
- Close before Friday market close to avoid weekend gaps
- Pause during major news events

> [!NOTE]
> Momentum Catch is best when there's a clear short-term move happening. It's less suited to choppy, directionless markets.

## Swing Capture

**Risk: Medium — Typical hold: 1–2 weeks**

Targets larger price moves over multiple days. Swing Capture uses wider stop-losses to give the trade more room to breathe, which means fewer false stop-outs — but also means a bigger potential loss if the trade goes wrong. Profits are taken at two levels before the rest rides with a trailing stop.

**SmartFlow will:**

- Use wider stops so normal price fluctuations don't close the trade
- Aim for 3× the risk as the reward
- Take 33% of the position at the first profit milestone
- Take another 33% at the second milestone
- Let the final third ride with a trailing stop
- Adjust the trailing stop for market volatility

> [!TIP]
> Swing Capture requires patience. The trade might look flat for a day or two before a big move happens. Trust the process and let SmartFlow manage it.

## Trend Rider

**Risk: Medium — Typical hold: up to 30 days**

Designed to ride major market trends for as long as they last. Unlike other strategies, Trend Rider has **no fixed profit target** — it keeps running until the trend reverses and the trailing stop is hit. This means the potential profit is unlimited, but the trade can also run for weeks.

**SmartFlow will:**

- Set a stop-loss based on volatility, then immediately move it to break-even
- Trail the stop using volatility-adaptive levels
- Take 25% profit every time the trade moves 2× the volatility in your favor
- Let the rest run until the trailing stop is hit
- Hold for up to 30 days if the trend continues

> [!NOTE]
> Trend Rider works best when there is a clear, sustained trend in the market. It underperforms in choppy or range-bound conditions. Check the higher timeframe trend before using this strategy.

## Recovery Mode

**Risk: Advanced — Hold time: varies**

Recovery Mode is an advanced strategy for experienced traders only. It adds to a losing position at regular intervals to lower your average entry price, making it easier to exit at break-even or profit when price bounces.

**SmartFlow will:**

- Open an initial trade in your chosen direction
- If the trade loses, add a second (smaller) position
- Add up to 3 more positions at defined intervals below entry
- Set a take-profit based on the averaged entry price
- Exit the entire position for a small profit once the bounce happens

> [!WARNING]
> Recovery Mode **significantly increases risk**. If price keeps moving against you through all 3 additional levels, your total loss is roughly 3–4× what a normal trade would lose. Only use this if you fully understand position averaging and have an account large enough to handle multiple losing levels.

---

## Choosing the Right Strategy

| Strategy       | Best For                          | Hold Time     | Risk     |
| -------------- | --------------------------------- | ------------- | -------- |
| Steady Growth  | Most traders, consistent approach | 2–3 days      | Low      |
| Momentum Catch | Short sessions, fast moves        | ~8 hours      | Medium   |
| Swing Capture  | Multi-day trends, patient traders | 1–2 weeks     | Medium   |
| Trend Rider    | Strong trends, long holds         | Up to 30 days | Medium   |
| Recovery Mode  | Experienced traders only          | Varies        | Advanced |

## Strategy Details in the Wizard

When creating a trade plan, each strategy card shows a "What this means" expandable section. Click it to see a step-by-step plain-English explanation of exactly what SmartFlow will do with your trade from entry to close. This is the best way to understand the mechanics before committing.
