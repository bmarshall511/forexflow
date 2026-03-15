---
title: "TradingView Alerts"
description: "Automatically place trades when TradingView indicators fire alerts."
category: "automation"
order: 1
---

# TradingView Alerts

## What Is TradingView?

TradingView is a popular website where traders look at charts, draw lines, and set up **indicators** — tools that highlight patterns in price data. One of its most powerful features is **alerts**: you can tell TradingView "notify me when this indicator signals a buy or sell."

FXFlow takes this one step further. Instead of just notifying you, it can **automatically place a real trade** on your OANDA account when a TradingView alert fires.

## How It Works

The signal travels through four stops on its journey from alert to trade:

1. **TradingView** fires an alert and sends a message (called a **webhook**) to a URL you configure
2. **Cloudflare Worker** (a tiny server FXFlow runs in the cloud) receives the message and checks it is valid
3. **FXFlow Daemon** (the engine running on your computer or server) picks up the signal
4. **OANDA** receives the order and places the trade

> [!NOTE]
> This entire chain takes just a few seconds. By the time you notice the alert, the trade is usually already placed.

## Setting It Up

### Step 1: Deploy the Cloudflare Worker

Go to **Settings > TradingView Alerts** in FXFlow. You will see a section for the Cloudflare Worker. This creates the "landing pad" URL that TradingView will send alerts to. Follow the on-screen instructions to deploy it.

Once deployed, you will get a **webhook URL** — a web address that looks something like:
`https://your-worker.workers.dev/webhook/abc123`

### Step 2: Configure TradingView

In TradingView:

1. Open the alert creation dialog on your indicator
2. Under **Notifications**, enable **Webhook URL**
3. Paste your FXFlow webhook URL
4. In the **Message** field, paste the JSON template from FXFlow settings

The JSON template tells FXFlow what pair to trade, which direction (buy/sell), and what stop loss and take profit to use.

### Step 3: Test the Pipeline

Back in FXFlow, use the **Test Signal** button. This sends a fake signal through the entire pipeline — TradingView to Worker to Daemon — and reports back whether each step succeeded.

> [!TIP]
> Always run a test signal after setting up a new alert. It catches configuration mistakes before real money is on the line.

## Safety Controls

Automation is powerful, but it needs guardrails. FXFlow provides several safety controls:

### Cooldown Timer

A delay between automated trades on the **same currency pair**. If set to 5 minutes, FXFlow will reject any signal for EUR/USD that arrives within 5 minutes of the previous one. This prevents rapid-fire duplicate trades.

### Maximum Positions

A cap on how many trades can be open at the same time. If set to 5 and you already have 5 open trades, new signals are rejected until a trade closes.

### Daily Loss Limit

If your total losses for the day exceed this amount, FXFlow stops placing automated trades until the next day. This is your emergency brake.

### Kill Switch

A master on/off toggle. When off, **all** incoming signals are acknowledged and logged but no trades are placed. Use this when you want to monitor signals without risking real money.

> [!WARNING]
> Always configure safety controls before enabling live alerts. Without them, a misfiring indicator could place dozens of unwanted trades in minutes.

## Signal Statuses

Every signal that arrives is logged with a status:

| Status        | Meaning                                |
| ------------- | -------------------------------------- |
| **Received**  | Signal arrived at the daemon           |
| **Executing** | Daemon is placing the order on OANDA   |
| **Executed**  | Order placed successfully              |
| **Rejected**  | Signal was blocked by a safety control |

## Common Rejection Reasons

If a signal is rejected, the log tells you why:

- **cooldown_active** — another signal for the same pair arrived too recently
- **max_positions_reached** — you already have the maximum number of open trades
- **daily_loss_limit** — your losses for the day exceeded your limit
- **market_closed** — the forex market is not open right now (weekends)

> [!TIP]
> Check the TV Alerts page regularly to see how many signals are being received versus executed. A high rejection rate might mean your safety settings are too tight — or it might mean your indicator is firing too often.

## Summary

TradingView Alerts let you turn chart-based ideas into automatic trades. The key to using them well is: set up your indicator carefully, configure your safety controls, run a test signal, and check the logs regularly.
