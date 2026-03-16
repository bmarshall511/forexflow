---
title: "AI Analysis Settings"
description: "Configure AI-powered trade analysis and recommendations"
category: "settings"
order: 5
---

# AI Analysis Settings

AI Analysis uses artificial intelligence (think of it as a very smart robot) to look at your trades and give you advice. It can tell you things like "this trade looks risky because..." or "you might want to move your stop-loss."

## API Keys

### Claude API Key

This is **required** for any AI features to work. Claude is the AI that analyses your trades. You get an API key by signing up at Anthropic's website.

> [!NOTE]
> Using AI costs a small amount of money per analysis. The cost depends on which model you choose (see below). Haiku is the cheapest.

### FinnHub API Key

This is **optional**. FinnHub provides economic data (like news about interest rates and employment numbers) that helps the AI give better advice. If you do not add this key, AI Analysis still works — it just has less information to work with.

## Default Model

Choose which AI "brain" to use:

| Model      | Speed     | Cost           | Quality                           |
| ---------- | --------- | -------------- | --------------------------------- |
| **Haiku**  | Very fast | Cheapest       | Good for quick checks             |
| **Sonnet** | Medium    | Medium         | Best balance of speed and quality |
| **Opus**   | Slower    | Most expensive | Most thorough and detailed        |

> [!TIP]
> Start with Sonnet. It gives great analysis without being too slow or expensive. Switch to Haiku if you want quick snapshots, or Opus for deep dives on important trades.

## Default Depth

How deeply the AI looks at each trade:

- **Quick** — a brief glance. Takes a few seconds. Good for a fast opinion.
- **Standard** — a proper analysis. Takes about 15-30 seconds. Good for most trades.
- **Deep** — a thorough investigation. Takes a minute or more. Best for big or complicated trades.

## Auto-Analysis Triggers

These toggles tell the AI to automatically analyse trades when certain things happen:

- **On pending order create** — analyse when you place a new order that has not been filled yet
- **On order fill** — analyse when an order gets filled (becomes a real trade)
- **On trade close** — analyse after a trade closes to learn from it
- **Notify when complete** — send you a notification when the analysis is ready

> [!TIP]
> Turning on "On trade close" is a great way to learn. The AI will review every closed trade and explain what went well and what could improve.

## Interval Analysis

When enabled, the AI will re-analyse your open trades every few hours (you choose how often, from 1 to 24 hours). The default is **every 4 hours**.

This is useful because market conditions change. What looked like a good trade this morning might need adjusting by the afternoon.

## Auto-Apply Conditions

When the AI finishes analysing a trade, it sometimes suggests "conditions" — rules like "if the price drops below X, consider closing." With this toggle on, those conditions are automatically created for you.

You can still see and delete them — they are just set up automatically instead of you doing it manually.

Auto-applied conditions include built-in safety features: destructive actions (closing trades or cancelling orders) are blocked for 60 seconds after creation, and AI-created conditions automatically expire based on type — stop-loss moves expire after 48 hours, trailing stops after 72 hours, and other conditions after 7 days — so stale rules do not act on outdated analysis.

## Minimum Confidence for Stop-Loss Conditions

By default, AI-suggested conditions use your general confidence threshold. However, conditions that move your stop loss carry extra risk, so there is a separate setting: **Minimum Confidence for Stop-Loss Conditions**.

This defaults to **High**, meaning the AI must be highly confident before it suggests moving your stop loss. You can lower it if you prefer more frequent SL suggestions, but the High default is recommended.

> [!TIP]
> Keeping this set to High is a good safety net. It means the AI will only suggest stop-loss moves when it is very sure — reducing the chance of a bad suggestion costing you money.

## Auto-Apply Actions

> [!WARNING]
> This is the most powerful (and most dangerous) setting on this page. When enabled, FXFlow will automatically do what the AI recommends — like moving stop-losses or closing trades — without asking you first.

There are separate toggles for practice and live mode:

- **Practice mode** — safe to experiment with. No real money involved.
- **Live mode** — be very careful. The AI is smart but not perfect.

## Learning Mode

When enabled, the AI adds extra explanations to help you understand why it made each recommendation. It explains trading concepts in simple terms.

> [!TIP]
> Keep this on if you are still learning about trading. The explanations are genuinely helpful and will teach you over time.

## Performance Digest

The AI can generate summary reports about your trading patterns:

- **Weekly digest** — a summary of your past week's trading
- **Monthly digest** — a bigger-picture look at your month

These reports point out patterns you might not notice yourself, like "you tend to lose money on Friday afternoons" or "your EUR/USD trades are much more successful than your GBP/JPY trades."
