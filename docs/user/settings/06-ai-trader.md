---
title: "AI Trader Settings"
description: "Configure the autonomous AI-powered trading system"
category: "settings"
order: 6
---

# AI Trader Settings

AI Trader is FXFlow's most advanced feature. It scans the markets, analyses opportunities using artificial intelligence, and can place trades on its own. Think of it as hiring a robot trader that works for you around the clock.

## Enable / Disable

The master switch. When off, AI Trader does nothing. When on, it scans the markets on a schedule and finds potential trades.

## Operating Mode

This controls how much freedom the AI has:

- **Manual** — AI finds opportunities and tells you about them, but never places trades. You decide.
- **Semi-Auto** — AI places trades automatically only when it is very confident. Lower-confidence opportunities are shown to you for a decision.
- **Full Auto** — AI places trades whenever it finds a good opportunity above your confidence threshold.

> [!WARNING]
> Full Auto means the AI trades with your real money without asking you. Start with Manual mode until you trust how it works. Watch it for a few weeks before giving it more control.

## Scan Interval

How often (in minutes) AI Trader scans the markets for new opportunities. You can set this from 1 to 60 minutes. The default is **30 minutes**.

- Shorter intervals catch opportunities faster but use more AI credits
- Longer intervals save money but might miss fast-moving opportunities

## Max Concurrent Trades

The most trades AI Trader can have open at the same time, from 1 to 20. Default is **5**.

This prevents the AI from opening too many trades at once, which would spread your money too thin.

## Confidence Thresholds

The AI rates how confident it is about each opportunity on a scale. You set two thresholds:

- **Minimum** — opportunities below this are ignored completely. Not worth looking at.
- **Auto-Execute** — opportunities above this are traded automatically (in Semi-Auto or Full Auto mode).

Anything between these two thresholds is shown to you for a manual decision (in Semi-Auto mode).

## Budget Caps

These limits cap how much you spend on AI API calls (not trade size):

- **Daily USD cap** — the maximum AI analysis cost per day
- **Monthly USD cap** — the maximum AI analysis cost for the entire month

All AI costs are tracked, including Tier 2 calls that reject candidates. The dashboard shows today's and this month's AI spend in real time.

> [!TIP]
> Set these conservatively at first. You can always increase them later once you see how the AI performs.

## AI Models

AI Trader uses a multi-step process to evaluate trades. You can choose which AI models power each step:

- **Tier 2 model** (default: Haiku) — the fast first filter. Quickly eliminates bad opportunities.
- **Tier 3 model** (default: Sonnet) — the careful decision-maker. Deeply analyses remaining opportunities.

> [!NOTE]
> Using a more expensive model for Tier 3 can improve trade quality but costs more. Tier 2 processes many candidates, so keeping it on Haiku saves money.

## Pair Whitelist

Choose exactly which currency pairs AI Trader is allowed to trade. Only pairs you check here will be scanned.

> [!TIP]
> Start with 3-5 major pairs (like EUR/USD, GBP/USD, USD/JPY). Add more as you get comfortable with how AI Trader handles them.

## Enabled Profiles

AI Trader has four trading personalities, each suited to different market conditions:

- **Scalper** — very short trades, in and out quickly (minutes to hours)
- **Intraday** — trades within a single day, closed before markets quiet down
- **Swing** — holds trades for days to catch bigger price moves
- **News** — trades around major economic announcements

You can enable or disable each profile. Multiple profiles can run at the same time.

## Enabled Techniques

AI Trader uses 14 different analysis techniques to evaluate trades. These are methods professional traders use, like:

- **Smart Money Concepts (SMC)** — tracking what big institutions are doing
- **Fair Value Gaps (FVG)** — finding price levels the market skipped over
- **Support & Demand zones** — areas where price tends to bounce
- **RSI, MACD, Bollinger Bands** — mathematical indicators showing momentum and volatility

You can toggle each technique on or off. More techniques means more thorough analysis but slightly slower scans.

> [!FOREX]
> You do not need to understand what each technique does to use AI Trader. The AI handles the technical details. But if you are curious, enabling Learning Mode in AI Analysis settings will explain what the AI found.

## External API Keys

These are optional keys for extra market data:

- **FRED** — economic data from the US Federal Reserve (interest rates, employment, inflation)
- **Alpha Vantage** — additional market data and financial indicators

Both are free to sign up for and improve the quality of the AI's analysis.
