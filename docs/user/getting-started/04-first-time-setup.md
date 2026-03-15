---
title: "First-Time Setup"
description: "Connect FXFlow to your OANDA account and understand the main interface."
category: "getting-started"
order: 4
---

# First-Time Setup

You've installed FXFlow and you have your OANDA API key and Account ID. Now let's connect everything together.

## Step 1: Create Your PIN

The first time you open FXFlow, it will ask you to create a **6-digit PIN**. This is like the passcode on your phone — it keeps other people from accessing your trading data.

1. Enter a 6-digit number you'll remember
2. Confirm it by typing it again
3. You'll use this PIN every time you open FXFlow

> [!TIP]
> Pick something you'll remember but that others can't easily guess. Avoid obvious codes like `000000` or `123456`.

> [!WARNING]
> If you forget your PIN, you'll need to reset your FXFlow data. Keep your PIN somewhere safe, like a password manager.

## Step 2: Navigate to OANDA Settings

Once you're logged in, you need to tell FXFlow how to connect to OANDA:

1. Click on **Settings** in the sidebar (it looks like a gear icon)
2. Click on the **OANDA** tab

## Step 3: Configure Your Connection

On the OANDA settings page, you'll see a few fields to fill in:

### Select Your Environment

You'll see a choice between **Practice** and **Live**:

- Choose **Practice** if you're using a practice account (you should be!)
- Choose **Live** only if you have a funded live account and know what you're doing

> [!NOTE]
> Practice and Live use different OANDA servers. Make sure the environment matches the type of account you created. A practice API key won't work with the live environment, and vice versa.

### Enter Your API Token

Paste the API key you copied from OANDA into the **API Token** field. This is the long string of characters from the previous step.

### Enter Your Account ID

Type or paste your Account ID (like `101-001-12345678-001`) into the **Account ID** field.

## Step 4: Connect and Verify

Click the **Connect** or **Save** button. FXFlow will try to reach OANDA using the details you provided.

If everything works, you'll see a **green status indicator** showing that the connection is active. If something goes wrong, you'll see an error message — double-check that you copied the API key and Account ID correctly.

## Understanding the Header

Once connected, look at the top of the FXFlow interface. You'll notice status indicators in the header bar:

| Indicator                     | What It Means                                                   |
| ----------------------------- | --------------------------------------------------------------- |
| **Daemon Status** (green dot) | The background service that syncs your data is running properly |
| **OANDA Status** (green dot)  | FXFlow is successfully connected to OANDA                       |

- **Green** = everything is working
- **Red** or **yellow** = something needs attention

> [!TIP]
> If you see a red status indicator, don't panic. It usually means the connection was briefly interrupted. FXFlow will try to reconnect automatically. If it stays red, check your internet connection or revisit your OANDA settings.

## What Happens on First Connection

The moment FXFlow successfully connects to OANDA, a few things happen automatically:

1. **Account balance loads** — Your account balance, margin, and other financial details appear on the dashboard
2. **Open positions sync** — Any trades you already have open on OANDA will appear in FXFlow
3. **Pending orders sync** — Any limit orders waiting to execute will show up too
4. **Trade history loads** — Your recent closed trades are pulled in so you can review them

> [!NOTE]
> This first sync might take a few seconds. After that, FXFlow checks for changes every 2 minutes and also listens for instant updates from OANDA, so your data stays fresh.

## Step 5: Explore the Dashboard

You're connected! Take a moment to look around:

- **Dashboard** — Your home base. Shows account summary, recent trades, and AI insights.
- **Positions** — See your open trades (Live tab) and trade history (Closed tab).
- **Charts** — View live price charts for any currency pair.
- **Trade Finder** — Let FXFlow scan for trading opportunities.
- **TradingView Alerts** — Connect TradingView signals (an advanced feature you can explore later).
- **Settings** — Manage your OANDA connection, AI settings, and preferences.

> [!TIP]
> Spend some time clicking around in Practice mode. You can't break anything — it's fake money, remember? The best way to learn is to explore.

## You're All Set

FXFlow is installed, connected, and syncing. In the next step, you'll place your very first trade.
