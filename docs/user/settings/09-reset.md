---
title: "Reset Options"
description: "Clear data or reset FXFlow to its default state"
category: "settings"
order: 9
---

# Reset Options

Sometimes you need a fresh start. This page has three levels of reset, from gentle to extreme. Read carefully before using any of them.

> [!WARNING]
> All reset actions on this page are permanent. Once you confirm, the deleted data is gone forever. There is no "undo" button. Make absolutely sure you want to do this before clicking.

## Clear Trade History

**What it does:** Removes all your closed trade records from FXFlow's database.

**What it keeps:**

- Your currently open trades (untouched)
- Your pending orders (untouched)
- All your settings
- Your API keys and connections

**When to use it:**

- You were testing and want to clean up practice trades
- Your trade history is cluttered with old data you no longer care about

> [!NOTE]
> This only removes records from FXFlow. Your actual trade history on OANDA is not affected. OANDA keeps its own records independently.

## Reset Settings

**What it does:** Returns every setting in FXFlow back to its original default value — as if you had just installed it.

**What it keeps:**

- All your trade history (open, pending, and closed)
- Your database

**What it removes:**

- OANDA API tokens and account IDs
- TradingView webhook configuration
- AI settings and API keys
- Trade Finder preferences
- AI Trader configuration
- Security settings (PIN, session duration)
- Deployment mode settings

**When to use it:**

- You changed a bunch of settings and things stopped working
- You want to reconfigure everything from scratch

> [!TIP]
> Before resetting settings, consider writing down your OANDA API token and any other API keys. You will need to enter them all again.

## Factory Reset

**What it does:** Completely wipes everything. Deletes all data and all settings. FXFlow will be exactly like it was the very first time you opened it.

**What it removes:**

- All trade history (open, pending, closed)
- All settings and API keys
- All AI analyses and trade conditions
- All Trade Finder setups
- All AI Trader configuration
- Everything

**When to use it:**

- You are starting completely fresh
- You are giving the computer to someone else
- Something is badly broken and nothing else fixes it

> [!WARNING]
> Factory reset is the nuclear option. It destroys every piece of data FXFlow has stored. Your trades on OANDA are safe (they live on OANDA's servers), but everything FXFlow knew about them — notes, AI analyses, conditions, source tracking — will be permanently deleted.

## Which Reset Should I Choose?

| I want to...                         | Use                 |
| ------------------------------------ | ------------------- |
| Clean up old closed trades           | Clear Trade History |
| Fix broken settings but keep my data | Reset Settings      |
| Start completely over from zero      | Factory Reset       |

> [!TIP]
> If you are unsure, start with the gentlest option (Clear Trade History) and see if that solves your problem. Only escalate to a bigger reset if the smaller one was not enough.
