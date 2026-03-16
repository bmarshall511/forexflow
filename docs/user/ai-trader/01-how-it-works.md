---
title: "How the AI Trader Works"
description: "Understand the 3-tier pipeline that finds and executes trades automatically"
category: "ai-trader"
order: 1
---

# How the AI Trader Works

The AI Trader is like having a team of three experts working together to find good trades for you. Each expert has a different job, and a trade must pass ALL three before any real money is involved.

This system is called the **3-tier pipeline**. Let's walk through each tier.

---

## Tier 1 — Local Analysis (Free)

**What it does:** Scans ALL your selected currency pairs using 14 different analysis techniques, right on your own computer.

**The analogy:** Imagine you're at the beach with a metal detector. You sweep it across the entire beach (all your currency pairs), and it beeps whenever it finds something that MIGHT be treasure. You don't know yet if it's a gold coin or a bottle cap — you just know something interesting is there.

**How it works:**

1. FXFlow looks at every currency pair you've selected (for example, 28 pairs)
2. For each pair, it runs 14 different checks (things like "is the price at a key level?" or "is the trend strong?")
3. It scores each pair based on how many checks look positive
4. It picks the **top 10 most promising candidates** to send to the next tier

**Cost:** Completely free. This runs on your computer using math — no AI models are needed.

> [!TIP]
> Tier 1 does the heavy lifting for free. Even if you scan 28 currency pairs, you pay nothing for this step. That's why the system is so cost-effective.

---

## Tier 2 — Quick AI Filter (~$0.0005 per check)

**What it does:** A fast, affordable AI model called **Claude Haiku** quickly evaluates each of the top 10 candidates from Tier 1.

**The analogy:** You've found 10 shiny objects on the beach. Now you take them to a jeweler for a quick look. The jeweler glances at each one and says "this one might be real" or "nah, that's just glass." It takes seconds and costs almost nothing.

**How it works:**

1. Haiku receives a summary of each candidate's analysis scores
2. It quickly decides: "Worth investigating further?" or "Not good enough"
3. Weak signals get filtered out — maybe only 3-5 candidates survive
4. Rejection reasons are shown in plain English in the Activity Log

**Cost:** About $0.0005 per check. That's half a tenth of a penny. If 10 candidates reach Tier 2, that's roughly half a cent total.

---

## Tier 3 — Deep AI Decision (~$0.01 per analysis)

**What it does:** A more powerful AI model called **Claude Sonnet** does a thorough, detailed analysis of each surviving candidate.

**The analogy:** The jeweler said 3 stones might be real diamonds. Now you take them to a **gemologist** — a diamond expert with a microscope. They examine each stone carefully from every angle. For each real diamond, they tell you exactly what it's worth and how to handle it.

**How it works:**

1. Sonnet receives ALL the detailed data about each candidate
2. It performs deep analysis, considering market conditions, risk, and multiple timeframes
3. For each candidate, it decides: **execute the trade** or **skip it**
4. For approved trades, it calculates:
   - **Entry price** — where to get in
   - **Stop loss** — where to get out if the trade goes wrong (your safety net)
   - **Take profit** — where to collect your winnings
   - **Position size** — how much money to put on this trade

**Cost:** About $0.01 per analysis. That's one penny.

---

## Cost Breakdown Example

Here's what a typical scan costs:

| Tier      | What Happens     | Pairs Checked | Cost Each | Total Cost  |
| --------- | ---------------- | ------------- | --------- | ----------- |
| Tier 1    | Local scan       | 28 pairs      | Free      | $0.00       |
| Tier 2    | Quick AI filter  | 10 candidates | ~$0.0005  | ~$0.005     |
| Tier 3    | Deep AI analysis | 3 candidates  | ~$0.01    | ~$0.03      |
| **Total** |                  |               |           | **~$0.035** |

That's about 3.5 cents for a complete scan of 28 currency pairs.

> [!NOTE]
> Actual costs vary depending on how much data is sent to the AI. These are typical estimates. You can monitor exact spending on the AI Trader dashboard.

---

## How Often Does It Scan?

The AI Trader scans on a schedule that you control. The default is **every 30 minutes**, but you can change it.

- **Every 15 minutes** — more frequent, catches opportunities faster, costs more
- **Every 30 minutes** — good balance (default)
- **Every 1 hour** — less frequent, saves money, might miss some opportunities

> [!TIP]
> If you're using the Scalper strategy (very fast trades), you might want scans every 15 minutes. For Swing trading (multi-day trades), every hour is plenty.

---

## What Happens When a Trade Is Approved?

When Tier 3 says "yes, take this trade," and the confidence score meets your threshold, here's what happens next:

1. **Order sent to OANDA** — FXFlow sends the trade details to your broker (OANDA) automatically
2. **Order appears in your positions** — you'll see it in your Open Trades list within seconds
3. **Stop loss and take profit are set** — your safety net and profit target are already in place
4. **AI manages the trade** — the system monitors and adjusts the trade as it develops
5. **You get a notification** — a message appears telling you a new AI trade was placed

The trade shows up with an **"AI Trade"** badge so you always know which trades the AI placed versus ones you placed yourself.

> [!WARNING]
> The AI Trader places real trades with real money on your OANDA account. Always start with a practice (demo) account until you're comfortable with how it works.
