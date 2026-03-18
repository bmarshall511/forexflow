---
title: "How SmartFlow Works"
description: "SmartFlow is your automated trading assistant — create a trade plan and it handles entry, protection, and exit for you."
category: "smart-flow"
order: 1
---

# How SmartFlow Works

SmartFlow is your automated trading assistant. You tell it what you want to trade and which strategy to use, and it takes care of the rest — watching the market around the clock, entering at the right moment, protecting your money as the trade progresses, and closing when it should.

Think of it like hiring a co-pilot who never sleeps. You set the destination and the rules; SmartFlow flies the plane.

## The Five Steps

Every SmartFlow trade goes through the same five steps:

### 1. Create a Trade Plan

You pick a currency pair and a direction (buy or sell), choose a strategy, and decide when to enter. The whole setup takes about a minute using the trade builder wizard.

### 2. SmartFlow Watches the Market

Once your plan is active, SmartFlow monitors live price feeds 24 hours a day, 5 days a week. If you chose to enter at a specific price, it watches and waits. If you chose to enter immediately, it places the trade right away and moves on to managing it.

### 3. It Enters When the Time Is Right

SmartFlow handles the order placement for you. It calculates the correct position size based on your account balance and the trade's risk settings, then places the trade on OANDA with stop-loss and take-profit levels already set.

### 4. It Protects Your Money

This is where SmartFlow really earns its place. While the trade is live, the management engine monitors every price tick and applies your chosen protections automatically:

- **Break-even** — once the trade is in profit, the stop-loss moves to your entry price so the worst case is breaking even
- **Trailing stop** — the stop-loss follows price upward (or downward on short trades), locking in profits as they accumulate
- **Partial close** — at defined profit milestones, SmartFlow takes some profit off the table while keeping the rest running
- **Session awareness** — stop distances adjust based on market session (Asian/London/NY overlap) to avoid getting stopped out by normal session noise
- **News protection** — trading can pause automatically around major economic events

### 5. It Closes the Trade

SmartFlow closes the trade when the take-profit target is reached, when a trailing stop is hit, or when a safety rule triggers (like a max hold time or drawdown limit). You see the result in the History tab.

## Trade Plans vs Active Trades

There are two concepts to understand:

**Trade Plans** (the "Configurations" in the system) define the rules: which pair, which direction, which strategy, what protections. A plan is reusable — SmartFlow can run the same plan over and over.

**Active Trades** are the live instances of your plan. When SmartFlow places a trade based on a plan, that trade appears in the Active Trades tab until it closes.

## Entry Modes

When creating a plan, you choose how SmartFlow should enter:

### Right Now (Market Entry)

SmartFlow places a market order at the current price immediately when the plan is activated. Use this when you want to start trading without delay.

### Wait for My Price (Smart Entry)

SmartFlow watches the market and enters only when price reaches your target level. You set a target price and an expiry window (e.g., "enter when EUR/USD reaches 1.0920, or cancel after 48 hours"). This is useful when you believe price will pull back to a better level before moving in your favor.

> [!TIP]
> Smart Entry is great for traders who have a specific price in mind. Instead of watching the chart yourself, you tell SmartFlow the price you want and let it take the shot.

## The Health Bar

At the top of the SmartFlow page, a single-line health bar tells you what SmartFlow is doing right now. For example:

> Watching EUR/USD, GBP/USD — prices updating 3×/sec

This confirms SmartFlow is connected, receiving live prices, and actively monitoring your trades. If it shows "SmartFlow is stopped," go to Settings to check if SmartFlow is enabled.

## Getting Started

1. Go to **SmartFlow** in the sidebar
2. Click **New Plan**
3. Follow the four-step wizard (pair → direction → entry timing → strategy → review)
4. Activate the plan — SmartFlow starts working immediately

> [!NOTE]
> If you have no trade plans yet, the SmartFlow page shows an onboarding screen explaining the five steps above. Your first click on "Create Your First Trade Plan" opens the wizard.
