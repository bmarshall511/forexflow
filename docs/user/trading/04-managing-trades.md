---
title: "Managing Trades"
description: "Modify, partially close, or fully close your active trades"
category: "trading"
order: 4
---

# Managing Trades

Once a trade is live, you're not stuck with your original plan. FXFlow lets you adjust your trades while they're running. You can move your safety levels, take some profit off the table, or close out entirely. This guide covers all the ways to manage an active trade.

## Modify Stop Loss

Your Stop Loss (SL) is the price where the trade automatically closes to protect you from further losses. Sometimes you'll want to move it:

- **Tighten it** (move it closer to the current price) — This reduces your maximum possible loss, but gives the trade less room to fluctuate. There's a higher chance you get "stopped out" (the trade closes by hitting your SL).
- **Loosen it** (move it further from the current price) — This gives the trade more room to breathe, but increases the amount you could lose if things go wrong.
- **Move it to breakeven** — A popular move! Once a trade is in profit, you can move the SL to your entry price. This means the worst that can happen is you break even — you've eliminated risk.

> [!TIP]
> Moving your Stop Loss to breakeven once a trade is nicely in profit is one of the most common things traders do. It's like saying "I've already won some ground — now let me make sure I don't give it all back."

> [!NOTE]
> When you use a condition preset (or AI suggestion) to move your SL to breakeven, FXFlow automatically adds a small **smart buffer** based on the current spread and volatility. Instead of placing the SL at the exact entry price — where spread alone could immediately trigger it — the SL is placed slightly beyond entry to give the trade breathing room. This applies to both manual condition presets and AI-suggested breakeven conditions.

To modify your SL, go to the **Live** tab on the Positions page, find your trade, and click the modify option. Enter the new price and confirm.

## Modify Take Profit

Your Take Profit (TP) is where the trade closes to lock in your winnings. You might want to change it if:

- The market is moving strongly in your favor and you think it could go further — move your TP higher (for buys) or lower (for sells)
- You want to secure profits sooner — bring your TP closer to the current price

The process is the same as modifying the SL: find the trade, click modify, enter the new TP level.

## Partial Close

A partial close means you exit **some** of your position but keep the rest running. This is a great way to lock in some profit while still having skin in the game.

> [!FOREX]
> Imagine you bought 10 shares of something. A partial close is like selling 5 of them to put some money in your pocket, while keeping the other 5 in case the price keeps going up. In forex, you do this with "units" instead of shares.

To partially close a trade:

1. Find the trade on the **Live** tab
2. Select the partial close option
3. Enter how many units you want to close
4. Confirm

The closed portion locks in its profit or loss. The remaining portion stays open as an active trade.

## Full Close

A full close means you exit the trade entirely. The profit or loss is finalized and added to your account balance. The trade moves from the **Live** tab to the **Closed** tab.

You might fully close when:

- You've reached your target and want to take all profits
- The market is moving against you and you want to cut your losses before the SL is hit
- Your reason for entering the trade has changed

> [!WARNING]
> Closing a trade is permanent. Once closed, the profit or loss is locked in. Make sure you really want to exit before confirming.

## Trade Events

Every trade keeps a log of everything that happened to it, called **trade events**. This is a timeline of actions like:

- When the order was placed
- When it was filled (became a live trade)
- Any modifications to SL or TP
- Partial closes
- The final close

This history is useful for reviewing your decisions after the fact. You can access it by clicking on a trade to see its detail view.

## MFE and MAE

On closed trades, you'll see two special numbers:

### MFE — Maximum Favorable Excursion

This is the **best** the trade reached while it was open. It shows the highest profit the trade ever hit, even if it didn't close at that level.

### MAE — Maximum Adverse Excursion

This is the **worst** the trade reached while it was open. It shows the biggest loss the trade ever had during its lifetime.

> [!NOTE]
> MFE and MAE help you learn from your trades. For example, if a trade's MFE was +$200 but you only closed it at +$50, you might want to hold trades longer next time. If the MAE was -$300 before recovering, you might want a wider Stop Loss. These numbers tell the full story of what happened during the trade, not just the final result.

Together, MFE and MAE paint a complete picture of how each trade behaved from start to finish — not just the end result, but the full journey.
