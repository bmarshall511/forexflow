---
title: "Trade Management"
description: "How the AI protects and manages your trades after they're placed"
category: "ai-trader"
order: 6
---

# Trade Management

Finding a good trade is only half the job. What happens AFTER the trade is placed matters just as much. The AI Trader doesn't just open trades and walk away — it actively monitors and manages every position to protect your money and lock in profits.

Here are the tools it uses.

---

## Breakeven Move — Your Safety Net Upgrade

**What it does:** When your trade moves far enough in your favor, the AI moves your Stop Loss to your entry price. This means you can no longer lose money on this trade (other than the spread).

**The analogy:** Imagine you're climbing a tall building. You started on the ground floor (your entry price) with a safety net on the basement level (your original stop loss). As you climb higher (the trade moves in your favor), someone moves the safety net UP to the ground floor. Now, even if you fall, you land right where you started — not in the basement.

**How it works:**

1. You enter a trade at 1.1000 with a stop loss at 1.0950 (risking 50 pips)
2. Price moves to 1.1050 (50 pips in your favor)
3. The AI moves your stop loss from 1.0950 up to 1.1000 (your entry price)
4. Now your worst outcome is breaking even — zero loss

> [!FOREX]
> A **pip** is the smallest standard price movement in forex. For most currency pairs, one pip is 0.0001. If EUR/USD moves from 1.1000 to 1.1001, that's one pip. If your trade is 50 pips in profit, that's a good move.

> [!TIP]
> The breakeven move is one of the most powerful risk management tools. It turns a risky open position into a "free trade" — you have nothing to lose and everything to gain.

---

## Trailing Stop — Locking in Profits as Price Moves

**What it does:** Once a trade is profitable, the stop loss "follows" the price at a fixed distance. As price moves further in your favor, the stop loss moves with it. But it NEVER moves backwards.

**The analogy:** Imagine walking a dog on a leash. The dog (the stop loss) follows you (the price) at a fixed distance. If you walk forward 10 steps, the dog walks forward 10 steps. But if you walk backwards, the dog stands still and waits — the leash just goes slack.

**Example:**

| Price          | Stop Loss (30-pip trail) | Locked Profit         |
| -------------- | ------------------------ | --------------------- |
| 1.1000 (entry) | 1.0970                   | -30 pips (at risk)    |
| 1.1040         | 1.1010                   | +10 pips locked       |
| 1.1080         | 1.1050                   | +50 pips locked       |
| 1.1060 (dips)  | 1.1050 (stays)           | +50 pips still locked |
| 1.1100         | 1.1070                   | +70 pips locked       |

Notice how when price dipped to 1.1060, the stop loss stayed at 1.1050. It only moves forward, never backward.

---

## Partial Close — Take Some, Let the Rest Ride

**What it does:** Closes a portion of your trade at a profit target while letting the remaining portion continue running. This way you secure some profit while still having a chance at bigger gains.

**The analogy:** You bought 10 concert tickets for $50 each. The event sells out and the tickets are now worth $100. You sell 5 tickets at $100 (that's $250 profit secured), but you keep the other 5 hoping the price goes even higher. If it does, great — you make even more. If the price drops back, you already locked in profit on half.

**How it works:**

1. You open a trade with 10,000 units
2. Price reaches a 2:1 reward-to-risk level
3. The AI closes 50% (5,000 units) and takes the profit
4. The remaining 5,000 units stay open with a trailing stop
5. If price keeps going, you profit more. If it reverses, you still kept the first half's profit

> [!NOTE]
> The exact percentage and target for partial closes depend on your strategy profile. Scalper might take profit earlier (at 1.5:1), while Swing waits longer (at 2.5:1).

---

## Time Exit — No Trades Left Behind

**What it does:** Automatically closes a trade if it has been open for longer than a maximum hold time without reaching its target.

**The analogy:** Imagine setting a timer when you put food in the oven. If the food isn't done by the time the timer goes off, you take it out anyway rather than letting it sit there forever. A trade that's going nowhere is using up one of your concurrent trade slots and tying up your money.

**When it kicks in:**

| Profile  | Typical Max Hold Time |
| -------- | --------------------- |
| Scalper  | 30 minutes to 1 hour  |
| Intraday | 4-8 hours             |
| Swing    | 5-7 days              |
| News     | 2-4 hours             |

The AI looks at whether the trade is making progress toward its target. If it's just sitting flat and not moving, the time exit prevents it from clogging up your portfolio indefinitely.

---

## News Protection — Shelter From the Storm

**What it does:** Before major economic news releases, the AI takes protective action on your open trades. This might mean tightening stop losses, closing positions, or pausing new trades.

**The analogy:** Imagine you're driving and the weather forecast says a severe storm is coming in 30 minutes. You might pull over to a safe spot, or at least slow down and turn on your headlights. News protection does the same thing for your trades — it reduces risk before the "storm" hits.

**What counts as major news:**

- Interest rate decisions from central banks
- Jobs reports (Non-Farm Payrolls in the US)
- Inflation data (CPI reports)
- GDP numbers (how fast an economy is growing or shrinking)

**What the AI might do:**

- **Tighten stop losses** — move them closer to current price so losses are smaller if the market moves wildly
- **Close positions** — if a trade is near breakeven and high-impact news is imminent, close it to avoid the chaos
- **Pause scanning** — stop looking for new trades during the news release when the market is most unpredictable

> [!WARNING]
> During major news events, prices can jump 50-100 pips in seconds. Even with news protection, there's a small chance your stop loss could be "skipped" (called slippage) if the market moves faster than orders can execute. This is a normal part of forex trading, not a bug.

---

## Management Log — Full Transparency

**What it does:** Records every single action the AI takes on your trade, along with the reason why.

**The analogy:** Like a pilot's flight log. Every decision, every adjustment, every event is written down with a timestamp. If you ever want to know "why did the AI do that?" — the answer is in the log.

**What you'll see in the log:**

- "Moved stop loss to breakeven at 1.1000 — trade reached 1:1 risk-reward"
- "Trailing stop activated at 1.1050 — 30-pip trail distance"
- "Partial close: 50% at 1.1080 — reached 2:1 reward-to-risk target"
- "Tightened stop loss to 1.1060 — high-impact news (US CPI) in 15 minutes"
- "Time exit triggered — trade open for 6 hours with minimal progress"

**Where to find it:** Open any AI-placed trade and look for the **Management Log** section. Every entry has a timestamp and explanation.

> [!TIP]
> Reading the management log is one of the best ways to learn about trade management. Even experienced traders can pick up new techniques by watching how the AI handles different situations.

---

## How It All Fits Together

Here's a typical lifecycle of an AI-managed trade:

1. **Trade placed** at 1.1000, stop loss at 1.0950, take profit at 1.1150
2. **Price rises** to 1.1050 — AI moves stop loss to breakeven (1.1000)
3. **Price rises more** to 1.1080 — trailing stop activates, stop loss now at 1.1050
4. **Partial close** — 50% closed at 1.1100 for a 2:1 reward
5. **Price keeps going** to 1.1130 — trailing stop follows, stop loss now at 1.1100
6. **News incoming** — AI tightens stop to 1.1120
7. **Price reverses** after news, hits trailing stop at 1.1120
8. **Trade closed** — profit on both halves, everything logged

The AI handled 7 separate management actions on a single trade. Without it, you'd need to be watching the screen constantly and making each decision yourself.

> [!NOTE]
> All management actions happen automatically regardless of your operating mode (Manual, Semi-Auto, or Full Auto). The operating mode only affects whether trades are **opened** automatically — once a trade exists, the AI always manages it.
