---
title: "Setting Up Your OANDA Account"
description: "Create a free OANDA practice account and get the API key FXFlow needs to connect."
category: "getting-started"
order: 3
---

# Setting Up Your OANDA Account

Before FXFlow can do anything useful, it needs to connect to a forex broker. FXFlow uses **OANDA** as its broker.

## What Is OANDA?

> [!FOREX]
> A **forex broker** is a company that lets you buy and sell currencies. Think of it like a bank, but instead of just holding your money, it gives you access to a marketplace where currencies are traded. OANDA is one of the most popular and trusted forex brokers in the world.

Your money lives inside your OANDA account. FXFlow never holds your money — it just talks to OANDA on your behalf, like a remote control talks to a TV.

## Step 1: Create a Free Practice Account

1. Go to [oanda.com](https://www.oanda.com)
2. Look for a button that says **"Try a Demo"**, **"Practice Trading"**, or **"Sign Up"**
3. Fill in your details (name, email, password)
4. Choose **Practice Account** when asked

> [!TIP]
> A practice account comes loaded with fake money (usually $100,000 of pretend dollars). You can trade with it as much as you want without risking anything real. It's the perfect place to learn.

Once your account is created, log in to the OANDA platform.

## Step 2: Find Your API Key

An API key is like a **special password** that lets FXFlow communicate with OANDA. Here's how to get one:

1. Log in to your OANDA account at [oanda.com](https://www.oanda.com)
2. Look for your **account settings** or **profile** area
3. Find the section called **"Manage API Access"** or just **"API"**
   - On the fxTrade platform, this is usually under your account name in the top corner
4. Click **"Generate"** or **"Create New Token"**
5. A long string of characters will appear — this is your API key

It will look something like this:

```
a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4-a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4
```

**Copy this key immediately and save it somewhere safe** (like a password manager). OANDA will only show it to you once.

> [!WARNING]
> **Never share your API key with anyone.** Anyone who has your API key can place trades on your account. Treat it like a password to your bank account. If you think someone else has seen it, go back to OANDA and generate a new one right away (the old one will stop working).

## Step 3: Find Your Account ID

Your Account ID is a number that tells FXFlow which OANDA account to connect to. Here's how to find it:

1. While logged into OANDA, look at your account dashboard
2. Your Account ID is displayed near the top of the page or in your account settings
3. It looks something like this: `101-001-12345678-001`

> [!NOTE]
> If you have multiple OANDA accounts (like both a practice and a live account), each one has a different Account ID. Make sure you grab the right one — for now, use your **practice** account ID.

## Practice vs Live: Which Should I Use?

|                 | Practice Account       | Live Account                   |
| --------------- | ---------------------- | ------------------------------ |
| **Money**       | Fake (pretend dollars) | Real (your actual money)       |
| **Risk**        | Zero                   | Real financial risk            |
| **How to get**  | Free, instant sign-up  | Requires identity verification |
| **Market data** | Same as live           | Real-time prices               |
| **Best for**    | Learning, testing      | Actual trading                 |

> [!WARNING]
> **Start with a Practice account.** There is absolutely no reason to use real money while you're still learning. Practice accounts use the same real market prices, so the experience is identical — the only difference is that losses don't cost you real money.

## What You Should Have Now

Before moving on, make sure you have these two things written down or saved:

- [ ] Your **API Key** (the long string of characters)
- [ ] Your **Account ID** (the number like `101-001-12345678-001`)

You'll enter both of these into FXFlow in the next step.
