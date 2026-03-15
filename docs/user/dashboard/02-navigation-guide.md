---
title: "Navigation Guide"
description: "How to get around FXFlow — sidebar, header, and mobile navigation"
category: "dashboard"
order: 2
---

# Navigation Guide

FXFlow has a lot of features, but getting around is straightforward once you know the layout. There are three main parts to the navigation: the **sidebar**, the **header**, and (on phones) the **mobile drawer**.

## Sidebar

The sidebar is the tall menu on the left side of the screen. It's your main way to move between different pages. The links are organized into three groups:

### Main

These are the core pages you'll use most often:

- **Dashboard** — Your home screen with account overview (see [Dashboard Overview](./01-dashboard-overview.md))
- **Positions** — View and manage your trades (waiting, live, and closed)
- **Charts** — Visual price charts where you can watch markets move in real time
- **Analytics** — Statistics and reports about your trading performance
- **Risk** — Tools to understand and manage how much risk you're taking

### Automation

These pages control features that can trade or alert you automatically:

- **Trade Finder** — A scanner that finds trading opportunities for you
- **TV Alerts** — Receives and processes signals from TradingView
- **AI Analysis** — Ask AI to analyze your trades and give you insights
- **AI Trader** — A fully automated AI trading system
- **Alerts** — Custom price alerts you've set up

### System

- **Documentation** — The help docs you're reading right now!
- **Settings** — Configure your account, connections, and preferences

> [!TIP]
> You don't need to understand every page right away. Start with **Dashboard** and **Positions** — those are the two you'll use most.

## Collapsible Sidebar

The sidebar has two modes:

- **Wide mode** — Shows icons _and_ text labels for every link. This is the default.
- **Icon-only mode** — Collapses down to just small icons, giving you more screen space for charts and data.

Click the collapse button at the bottom of the sidebar to switch between modes. The icons still work the same — just hover over them to see tooltips showing what each one does.

## Header Bar

The header runs across the top of every page. It contains a few important things:

- **Account Balance** — A quick glance at your balance without going to the Dashboard.
- **Daemon Status Dot** — A tiny colored dot showing whether the background service (the "daemon") is connected. Green means everything is working. Red or gray means there might be a connection issue.
- **OANDA Status** — Shows whether FXFlow is connected to your OANDA broker account. This is where your actual money and trades live.
- **Notification Bell** — Click this to see recent alerts and events. If there's a number on it, that's how many unread notifications you have.

> [!NOTE]
> The "daemon" is a background program that keeps FXFlow in sync with your broker. You don't need to do anything with it — just check that the dot is green. If it's red, go to Settings to troubleshoot.

## Mobile Navigation

On a phone or small tablet, the sidebar disappears to save screen space. Instead, you get a **drawer** — a menu that slides in from the side when you tap the menu button (three horizontal lines, sometimes called a "hamburger" icon).

The drawer contains all the same links as the sidebar. Tap any link to go to that page, and the drawer slides closed automatically.

> [!TIP]
> On mobile, you can also use the [Command Palette](./03-command-palette.md) to quickly jump to any page without opening the drawer. It's often faster!

## Quick Orientation

Here's a cheat sheet for "Where do I go to...?"

| I want to...                   | Go to        |
| ------------------------------ | ------------ |
| See my account balance         | Dashboard    |
| View my open trades            | Positions    |
| Watch price charts             | Charts       |
| See how I've been performing   | Analytics    |
| Find new trading opportunities | Trade Finder |
| Check if a signal came through | TV Alerts    |
| Get AI help on a trade         | AI Analysis  |
| Change my settings             | Settings     |
