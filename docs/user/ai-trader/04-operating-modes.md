---
title: "Operating Modes"
description: "Choose how much control the AI has: Manual, Semi-Auto, or Full Auto"
category: "ai-trader"
order: 4
---

# Operating Modes

The AI Trader has three operating modes that control **how much freedom** the AI has to place trades. Think of it like the self-driving levels in a car — from full human control to full autopilot.

---

## Manual Mode — You Decide Everything

**How it works:** The AI finds trade opportunities and presents them to you. For every single one, YOU look at it and click **"Approve"** or **"Reject."** Nothing happens without your permission.

**The analogy:** Like having a financial advisor sitting next to you. They study the market, find opportunities, and say "Hey, I think this looks good — here's why." But YOU make the final call. They never touch your money without asking.

**What you see:**

1. A notification pops up: "New AI trade opportunity found"
2. You open it and see: the currency pair, direction (buy/sell), entry price, stop loss, take profit, confidence score, and the AI's reasoning
3. You click **Approve** (trade gets placed) or **Reject** (trade is skipped)

**Best for:**

- Complete beginners who are learning how forex trading works
- Cautious traders who want full control
- Anyone building trust with the AI system — watch its suggestions for a few weeks before giving it more freedom

> [!TIP]
> Manual mode is the best way to **learn**. You get to see exactly how the AI thinks, what it looks for, and why it makes certain decisions. Treat it like a teacher showing you their homework.

---

## Semi-Auto Mode — Trust but Verify

**How it works:** You set a **confidence threshold** (a number between 0 and 100). When the AI finds a trade:

- **Confidence ABOVE your threshold** = the AI places the trade automatically
- **Confidence BELOW your threshold** = the AI asks for your approval (just like Manual mode)

**The analogy:** Like setting a rule with your financial advisor: "If you're 70% sure or more, go ahead and do it without calling me. But if you're less than 70% sure, check with me first."

**Example with a 70% threshold:**

| Trade        | AI Confidence | What Happens                       |
| ------------ | ------------- | ---------------------------------- |
| EUR/USD Buy  | 85%           | Auto-executed (above 70%)          |
| GBP/JPY Sell | 62%           | Sent to you for review (below 70%) |
| AUD/USD Buy  | 91%           | Auto-executed (above 70%)          |
| USD/CAD Sell | 55%           | Sent to you for review (below 70%) |

**Best for:**

- Experienced traders who have watched the AI in Manual mode and trust its high-confidence calls
- People who want automation for the obvious opportunities but manual control for borderline ones
- Traders who can't check their phone every time an opportunity appears

---

## Full Auto Mode — Complete Autopilot

**How it works:** The AI executes ALL trades that pass the 3-tier pipeline. No human approval needed. If Tier 1 finds it, Tier 2 confirms it, and Tier 3 approves it, the trade gets placed.

**The analogy:** Like putting your car on full self-driving mode. You set the destination (your strategy profiles and settings), and the car handles everything — steering, acceleration, braking. You can sit back and watch, but you don't need to touch anything.

**Best for:**

- Hands-off trading where you check in once or twice a day
- Running the system overnight or while you're at work
- People who have thoroughly tested the system and trust its decisions

> [!WARNING]
> **Only use Full Auto on a practice (demo) account until you fully trust the system.** Full Auto means the AI is placing real trades with real money without asking you first. Start with Manual, move to Semi-Auto, and only switch to Full Auto after you've seen consistent results over weeks or months.

---

## The Confidence Score Explained

Every trade opportunity gets a **confidence score** from 0 to 100. But what does that number actually mean?

The confidence score reflects how many analysis techniques agree AND how strong each signal is:

| Score  | Meaning                                  | How Picky                             |
| ------ | ---------------------------------------- | ------------------------------------- |
| 90-100 | Nearly everything aligns perfectly       | Extremely selective — very few trades |
| 70-89  | Strong agreement across techniques       | Strict — good quality filter          |
| 50-69  | Moderate agreement, some mixed signals   | Moderate — balanced approach          |
| 30-49  | Weak agreement, many techniques disagree | Loose — lots of trades, lower quality |
| 0-29   | Very little agreement                    | Too loose — not recommended           |

**Choosing your threshold (for Semi-Auto mode):**

- **50** = moderate filter. You'll get more trades, but some will be lower quality.
- **70** = strict filter. Fewer trades, but higher quality. **Good starting point.**
- **90** = very selective. You might only get a few trades per week, but they'll be the best of the best.

> [!TIP]
> **Recommended path for new users:**
>
> 1. Start with **Manual mode** for 2-4 weeks. Watch every suggestion.
> 2. Switch to **Semi-Auto at 70%** once you trust the high-confidence calls.
> 3. Gradually lower the threshold (to 60%, then 50%) as you see consistent results.
> 4. Only move to **Full Auto** once you've seen months of reliable performance.

---

## Switching Modes

You can change your operating mode at any time in **Settings > AI Trader**. The change takes effect immediately:

- Switching to a stricter mode (e.g., Full Auto to Manual) is always safe — no new trades will be auto-placed
- Switching to a more permissive mode (e.g., Manual to Full Auto) means the AI can immediately start placing trades on the next scan

Existing open trades are not affected by mode changes. They will continue to be managed by the AI regardless of which mode you switch to.

> [!NOTE]
> The operating mode only controls whether trades are **placed** automatically. Trade **management** (moving stop losses, trailing stops, partial closes) is always handled by the AI once a trade is open, in all modes.
