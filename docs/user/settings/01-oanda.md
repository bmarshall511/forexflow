---
title: "OANDA Broker Connection"
description: "Connect FXFlow to your OANDA trading account"
category: "settings"
order: 1
---

# OANDA Broker Connection

OANDA is the company that actually holds your money and places your trades. Think of it like a bank account, but for trading currencies. FXFlow connects to OANDA so it can see your trades and place new ones for you.

## Practice vs Live Mode

At the top of this page, you will see a toggle switch that says **Practice** or **Live**.

- **Practice mode** connects to a fake-money account. You can trade all you want without any risk. This is perfect for learning.
- **Live mode** connects to your real-money account.

> [!WARNING]
> Live mode uses REAL money. Every trade placed in live mode can make or lose actual money from your account. Make sure you know what you are doing before switching to live.

When you switch between practice and live, FXFlow will ask you to confirm. This prevents accidentally trading with real money.

## Adding Your API Token

An API token is like a special password that lets FXFlow talk to your OANDA account. Here is how to set it up:

1. Log in to your OANDA account on their website
2. Find the API section (usually under "Manage API Access")
3. Generate a new token
4. Copy the token and paste it into the **API Token** field in FXFlow

> [!TIP]
> Your token is encrypted (scrambled for safety) as soon as you save it. FXFlow only shows the last 4 characters, like `••••••a3b7`. Nobody can see the full token, not even you after saving.

## Account ID

Your **Account ID** is the number OANDA gives your trading account. It looks something like `101-001-12345678-001`. Paste this into the Account ID field so FXFlow knows which account to connect to.

## Testing the Connection

After entering your token and account ID, click the **Test Connection** button.

- **Green indicator** = everything is working. FXFlow can talk to OANDA.
- **Red indicator** = something is wrong. Check that your token and account ID are correct.

> [!NOTE]
> If you see a red indicator, the most common fixes are:
>
> - Make sure you copied the full token without extra spaces
> - Check that your account ID matches the mode (practice tokens only work with practice accounts)
> - Make sure your internet connection is working

## Switching Between Practice and Live

You can switch modes at any time. When you do:

1. FXFlow shows a confirmation dialog asking "Are you sure?"
2. You confirm the switch
3. FXFlow disconnects from the old account and connects to the new one
4. Your trade history for each mode is kept separate

> [!FOREX]
> Most professional traders test new strategies in practice mode first before using real money. There is no shame in practicing — it is the smart thing to do.
