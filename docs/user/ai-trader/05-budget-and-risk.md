---
title: "Budget and Risk Controls"
description: "Control how much you spend on AI and how many trades the system can open"
category: "ai-trader"
order: 5
---

# Budget and Risk Controls

The EdgeFinder has several built-in controls to make sure it doesn't spend too much on AI API calls or open too many trades at once. Think of these as guardrails on a highway — they keep everything on track even if something unexpected happens.

---

## Daily Budget Cap

**What it does:** Sets the maximum amount of money the AI can spend on API calls (Tier 2 and Tier 3) in a single day. When the limit is reached, scanning pauses until midnight.

**The analogy:** Like a daily spending limit on a debit card. If your limit is $5, you can buy things all day — but once you've spent $5, the card stops working until tomorrow.

**How to set it:** Go to **Settings > EdgeFinder > Budget** and enter a dollar amount.

**Example:** If your daily cap is $3.00 and each full scan costs about $0.035, you can run roughly 85 scans before hitting the limit. At one scan every 30 minutes, that's over 42 hours of scanning — more than a full day. So $3/day is plenty for most people.

> [!TIP]
> A daily cap of **$3-5** is a good starting point. This gives you plenty of scans while keeping costs predictable. You can always adjust later.

---

## Monthly Budget Cap

**What it does:** Same idea as the daily cap, but for an entire calendar month. Even if your daily cap allows spending, the monthly cap is a hard ceiling.

**The analogy:** Like a monthly allowance. Even if you have money left each day, once the monthly total is used up, that's it until next month.

**Example:** A $50 monthly cap means you can spend up to $50 on AI API calls across the entire month. With typical usage, this is more than enough for even heavy scanning.

---

## Max Concurrent Trades

**What it does:** Limits how many AI-placed trades can be open at the same time. If you set this to 5, the AI will not open a 6th trade until one of the first 5 closes.

**The analogy:** Like having 5 parking spots. If all spots are full, the next car has to wait until one leaves.

**Why this matters:** Without a limit, the AI could potentially open dozens of trades at once, which would:

- Spread your account balance too thin
- Increase your total risk dramatically
- Make it hard to keep track of everything

**Recommended settings:**

| Account Size            | Suggested Max Trades |
| ----------------------- | -------------------- |
| Small (under $1,000)    | 2-3                  |
| Medium ($1,000-$10,000) | 3-5                  |
| Large (over $10,000)    | 5-10                 |

> [!WARNING]
> More concurrent trades means more total risk. If the market moves sharply against you, ALL open trades could lose money at the same time. Start small and increase only when you're comfortable.

---

## Where to See Your Current Spend

The **EdgeFinder dashboard** shows your budget usage in real time:

- **Today's spend** — how much you've used of your daily cap
- **Month's spend** — how much you've used of your monthly cap
- **Trades open** — how many of your max concurrent slots are used

You'll also see a progress bar for each limit so you can tell at a glance how much room is left.

> [!NOTE]
> If you're approaching your budget limit and want the AI to keep scanning, you can increase the cap at any time in Settings. The change takes effect immediately.

---

## Cost Optimization Tips

Here are ways to keep your AI API costs as low as possible:

### Scan Fewer Pairs

If you're scanning 28 currency pairs, Tier 1 checks all 28 (free) and sends up to 10 to Tier 2 (paid). Scanning only 10 pairs means fewer candidates reach the paid tiers.

### Use a Longer Scan Interval

Scanning every 15 minutes costs roughly 4 times more than scanning every hour. If you're using the Swing profile (trades last days), scanning every hour is more than enough.

### Disable Scalper When Not Watching

The Scalper profile works best when you're actively monitoring. If you're away from your computer, disable it to avoid burning scans on opportunities you can't oversee.

### Match Profiles to Your Schedule

| Your Schedule         | Suggested Setup                       |
| --------------------- | ------------------------------------- |
| At computer all day   | Scalper + Intraday, scan every 15 min |
| Check a few times/day | Intraday + Swing, scan every 30 min   |
| Check once daily      | Swing only, scan every 60 min         |

---

## Typical Cost Examples

| Scenario       | Pairs    | Scan Interval | Profile          | Est. Daily Cost |
| -------------- | -------- | ------------- | ---------------- | --------------- |
| Light usage    | 10 pairs | Every 60 min  | Swing            | $0.50-$1.00     |
| Moderate usage | 20 pairs | Every 30 min  | Intraday + Swing | $2.00-$4.00     |
| Heavy usage    | 28 pairs | Every 15 min  | All profiles     | $5.00-$10.00    |

> [!NOTE]
> These are estimates based on typical Tier 2 and Tier 3 costs. Actual costs depend on how many candidates pass each tier and how much data is included in each analysis.

---

## External API Keys (Optional)

You can optionally add API keys for two external data services that give the AI extra information to work with:

### FRED (Federal Reserve Economic Data)

- **What it is:** Free data from the US government about the economy (interest rates, inflation, jobs numbers)
- **Cost:** Free to use
- **Why it helps:** The AI can factor in real economic data when deciding whether to trade. For example, if inflation is rising, that might affect currency values.
- **How to get a key:** Sign up at [fred.stlouisfed.org](https://fred.stlouisfed.org)

### Alpha Vantage

- **What it is:** A market data service that provides extra financial information
- **Cost:** Free tier available (limited requests), paid plans for more data
- **Why it helps:** Gives the AI additional market indicators and cross-market data

> [!TIP]
> Both of these are optional. The EdgeFinder works perfectly well without them. They just provide bonus data that can help the AI make even better-informed decisions.

To add API keys, go to **Settings > EdgeFinder > API Keys**. Keys are encrypted and stored securely on your local machine.
