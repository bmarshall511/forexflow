---
title: "Risk Management"
description: "Tools that help you protect your account from large or concentrated losses."
category: "analytics"
order: 2
---

# Risk Management

Risk management is the art of **protecting your money from big losses**. It might sound boring compared to finding the perfect trade, but here is the truth: even the best traders in the world lose regularly. What separates professionals from beginners is not finding more winners — it is making sure the losers do not wipe out the account.

Think of it this way: a football goalkeeper who lets in one goal per game is fine. A goalkeeper who lets in ten goals in one game gets the team relegated. Risk management keeps you from having that catastrophic ten-goal game.

## Why Risk Management Matters More Than Finding Good Trades

Imagine two traders:

- **Trader A** finds amazing trades 70% of the time but bets half their account on each one. One bad streak and they are broke.
- **Trader B** only wins 45% of the time but never risks more than 1% per trade. After 100 trades, they are still in the game and slowly growing.

Trader B wins in the long run. Every tool on this page is designed to help you be Trader B.

## Correlation Matrix

### What Is Correlation?

Correlation means two things tend to move in the same direction at the same time. In forex, certain currency pairs are closely linked. For example:

- **EUR/USD** and **GBP/USD** often move in the same direction because both are "the dollar versus a European currency."
- **USD/JPY** and **USD/CHF** also tend to move together.

### Why It Matters

If you have a buy trade on EUR/USD _and_ a buy trade on GBP/USD, you might think you have two separate bets. But because these pairs are highly correlated, you really have **one big bet that the US dollar will weaken**. If the dollar suddenly gets stronger, _both_ trades lose at the same time.

> [!WARNING]
> High correlation doubles your risk without doubling your reward. It is like betting on two football teams that always win or lose on the same day — you are not actually spreading your risk at all.

### Reading the Matrix

The Correlation Matrix shows a grid of your traded pairs. Each cell contains a number from **-1.0 to +1.0**:

| Value        | Meaning                                       |
| ------------ | --------------------------------------------- |
| +0.8 to +1.0 | Very high — pairs move together               |
| +0.5 to +0.8 | Moderate — some overlap                       |
| 0 to +0.5    | Low — fairly independent                      |
| -0.5 to 0    | Slight inverse — mildly opposite              |
| -1.0 to -0.5 | Strongly inverse — they move in opposite ways |

> [!TIP]
> Try to avoid having multiple trades open on pairs with correlation above +0.7. If you do, treat them as one combined position when calculating your risk.

## Drawdown Tracker

### What Is Drawdown?

Drawdown measures **how far your account has fallen from its highest point**. Picture a roller coaster: the drawdown is the distance from the top of the hill to the bottom of the dip.

If your account peaked at $10,000 and is currently at $9,400, your drawdown is **$600 (6%)**. Once your account makes a new high, the drawdown resets to zero.

### Why Track It?

- **Emotional check**: big drawdowns hurt and lead to bad decisions. Knowing your number keeps you honest.
- **Warning system**: if drawdown exceeds a level you are comfortable with (many traders use 10–15% as a red line), it is time to stop trading and review.
- **Recovery math**: a 10% loss needs an 11% gain to recover. A 50% loss needs a 100% gain. Small drawdowns are _much_ easier to recover from.

> [!NOTE]
> The Drawdown Tracker shows both your current drawdown and your maximum historical drawdown (the worst dip ever). Keep that maximum number as low as possible.

## Portfolio Heat Gauge

The Portfolio Heat Gauge combines everything above into one visual indicator. It answers the question: **"Right now, how much total risk do I have on?"**

It considers:

- **Number of open trades** — more trades = more exposure
- **Correlation between those trades** — correlated trades amplify risk
- **Size of each trade** — bigger positions create more heat
- **Current drawdown** — already being in a dip means less room for error

The gauge displays as a colour-coded bar:

- **Green**: low risk, plenty of room
- **Yellow**: moderate risk, be cautious about adding new trades
- **Red**: high risk, consider reducing positions before opening anything new

> [!WARNING]
> If the heat gauge is red, do not open new trades. Wait for existing trades to close or reduce your position sizes first.

## Quick Rules of Thumb

1. Never risk more than 1–2% of your account on a single trade
2. Check the Correlation Matrix before opening a second trade on a similar pair
3. Set a personal max drawdown limit and respect it (e.g., stop trading at 10%)
4. Glance at the heat gauge before every new trade
