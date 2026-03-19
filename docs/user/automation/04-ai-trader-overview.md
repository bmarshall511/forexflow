---
title: "AI Trader Overview"
description: "A fully autonomous trading system that finds, analyzes, and optionally executes trades using AI."
category: "automation"
order: 4
---

# AI Trader Overview

The AI Trader is the most advanced automation feature in FXFlow. It is a system that can **find trading opportunities, analyze them with artificial intelligence, and place trades** — all without you lifting a finger.

Think of it as the difference between a calculator and a robot. The other tools in FXFlow are calculators — they help you do things faster. The AI Trader is a robot that can do the whole job on its own (if you let it).

## What It Does (High Level)

The AI Trader follows a repeating cycle:

1. **Scans** your selected currency pairs looking for potential trades
2. **Filters** the candidates using AI to remove the weak ones
3. **Decides** whether to trade, including exact entry, stop loss, and take profit
4. **Executes** the trade on OANDA (if you have given it permission)

This cycle runs continuously while the AI Trader is enabled, checking the markets at regular intervals.

## The 3-Tier Pipeline

The AI Trader uses a three-step process to go from "maybe" to "yes" or "no." Each step gets more thorough (and more expensive):

### Tier 1: Local Scan (Free)

The first step runs entirely on your computer with no AI costs. It performs fast technical analysis — checking price patterns, trends, and indicators across all your selected pairs. Most pairs are eliminated here. Only the ones showing real potential move to the next tier.

Tier 1 uses a **soft filter** approach: when higher timeframe trend or secondary momentum disagrees with a signal, it reduces the confidence score rather than eliminating it entirely. This allows strong setups to pass even in mixed conditions, while weak ones are still filtered out. The scan log shows a diagnostic breakdown of why signals were filtered (low volatility, low confluence, spread too wide, etc.) so you can understand what the market looks like.

> Think of this like a metal detector on a beach. It beeps on anything that _might_ be treasure, but most of it is bottle caps.

### Tier 2: Quick AI Filter (Cheap)

Candidates that passed Tier 1 are sent to a fast, affordable AI model. This step takes a few seconds per candidate and costs fractions of a cent. The AI does a quick sanity check — "Does this actually look good, or is the pattern misleading?" — and eliminates the false positives.

> This is like picking up the items the metal detector found and quickly checking if they look like coins or junk.

### Tier 3: Deep AI Decision (Thorough)

The remaining candidates get a full, detailed AI analysis. This uses a more powerful (and more expensive) AI model that examines multiple timeframes, market context, news events, and risk factors. It decides whether to trade, and if so, calculates the exact entry price, stop loss, take profit, and position size.

> This is like taking the possible coins to an expert who examines them under a magnifying glass and tells you exactly what they are worth.

> [!NOTE]
> Most candidates are eliminated in Tier 1 (free). Only a small number reach Tier 2, and even fewer make it to Tier 3. This keeps AI costs low while still being thorough on the trades that matter.

## Operating Modes

You control how much autonomy the AI Trader has:

### Manual Mode

The AI Trader scans and analyzes, but **never places trades**. It shows you the opportunities it finds and you decide whether to act on them. This is the safest way to start.

### Semi-Auto Mode

The AI Trader can place trades on its own, but **only when confidence is high**. You set a confidence threshold (e.g., 80%), and trades below that threshold are shown to you for manual approval.

### Full Auto Mode

The AI Trader handles everything. It finds, analyzes, and executes trades based on its own judgment within the risk limits you configure.

> [!WARNING]
> Full Auto mode on a live account means real money is being traded without your approval on each trade. Only use this after extensive testing in Manual mode. Make sure your risk controls (max trades per day, max risk per trade, daily loss limit) are properly configured.

## What You See on the Dashboard

The AI Trader dashboard shows you:

- **Scanner status** — whether it is currently scanning, and what pair/phase it is on
- **Activity log** — a timeline of everything the AI Trader has done (scanned, rejected, executed)
- **Opportunities** — current trade candidates with their scores and AI analysis summaries
- **Performance** — how the AI Trader's trades have performed over time

## Risk Controls

Like all automation in FXFlow, the AI Trader has safety limits:

- **Max trades per day** — prevents overtrading
- **Max risk per trade** — caps how much of your account any single trade can risk
- **Daily loss limit** — stops trading if total losses exceed your threshold
- **Currency pair whitelist** — only scans pairs you have approved
- **Monthly AI budget** — caps how much money is spent on AI analysis
- **Consecutive loss cooldown** — after 2+ consecutive AI Trader losses, scanning pauses for 30 minutes to prevent loss-chasing. This cooldown only counts losses from AI Trader trades — losses from Trade Finder, TV Alerts, or manual trades do not trigger it.

## Getting Started

1. Go to **AI Trader** in the sidebar
2. Configure your currency pair whitelist
3. Set risk controls (max trades, risk %, daily loss limit)
4. Start in **Manual mode**
5. Watch the opportunities it finds for at least a week
6. If the quality looks good, consider Semi-Auto with a high confidence threshold

> [!TIP]
> The AI Trader is most effective when you let it scan many pairs (10+) but set strict risk controls. It finds the needles in the haystack while you focus on other things.

For a detailed breakdown of the AI Trader's strategies, technical analysis techniques, and configuration options, see the **AI Trader Deep Dive** section.
