---
title: "Glossary"
description: "Every trading and FXFlow term explained in plain English"
category: "reference"
order: 1
---

# Glossary

Every term you will see in FXFlow, explained so anyone can understand it. Terms are listed A to Z. Where a term shows up inside FXFlow, that is noted at the end of the definition.

> [!TIP]
> Use your browser's **Find** feature (Cmd + F / Ctrl + F) to jump straight to a word.

---

## A

**ADX (Average Directional Index)** — A number from 0 to 100 that tells you how _strong_ a trend is, not which direction it goes. A reading above 25 usually means there is a solid trend. In FXFlow, ADX is one of the techniques the EdgeFinder uses when scanning for trade ideas.

**Ask** — The price you pay when you _buy_ a currency pair. It is always slightly higher than the Bid price. You can see Ask prices on the Positions page and in Charts.

**ATR (Average True Range)** — A measure of how much a currency pair typically moves in a given time period. A high ATR means the price is bouncing around a lot. FXFlow's EdgeFinder and Trade Finder use ATR to decide where to place stop losses and take profits.

## B

**Balance** — The total amount of money in your trading account, _not_ counting any trades that are still open. Your balance only changes when a trade closes. Shown on the Dashboard and Account Summary.

**Bid** — The price you receive when you _sell_ a currency pair. It is always slightly lower than the Ask price.

**Bollinger Bands** — Two lines drawn above and below a moving average on a chart. When the price touches or crosses these lines, it might be about to reverse. FXFlow's EdgeFinder can use Bollinger Bands as one of its analysis techniques.

**BOS (Break of Structure)** — When the price breaks past a recent high or low, it signals the trend might continue. This is a Smart Money Concepts term. The EdgeFinder watches for BOS during its analysis.

**Breakeven** — Moving your stop loss to the exact price where you entered the trade, so that if the market reverses you lose nothing (and gain nothing). In FXFlow, you can move a trade to breakeven from the Positions page.

## C

**Cancelled** — A pending order that was never filled. The market didn't reach the order price before it was cancelled or expired. Cancelled orders show as a dimmed, strikethrough badge in Trade History and are excluded from your win rate and performance statistics.

**Candlestick** — A small bar on a chart that shows four prices for a time period: where the price opened, the highest point, the lowest point, and where it closed. Green (or hollow) candles mean the price went up; red (or filled) candles mean it went down. Visible on the Charts page.

**CHoCH (Change of Character)** — When the price breaks a key level in the _opposite_ direction of the current trend, hinting that the trend may be reversing. Another Smart Money Concepts term used by the EdgeFinder.

**Confluence** — When multiple signals or techniques all agree on the same trade direction at the same time. More confluence usually means a higher-confidence trade. FXFlow's EdgeFinder looks for confluence across its analysis techniques.

**Correlation** — How closely two currency pairs move together. If EUR/USD goes up and GBP/USD usually goes up too, they are positively correlated. Knowing this helps you avoid accidentally doubling your risk.

**Currency Pair** — Two currencies quoted together, like EUR/USD (euro vs. US dollar). The first currency is the one you buy or sell; the second is what you pay or receive in. FXFlow shows currency pairs throughout the app.

## D

**Daemon** — A background program that does the heavy lifting in FXFlow: syncing trades with OANDA, processing signals, and running AI analysis. You will see a green or red dot in the header showing whether the daemon is connected.

**Demand Zone** — A price area where buyers stepped in strongly in the past, so the price might bounce upward again if it returns there. The opposite of a Supply Zone. Used by the EdgeFinder's Smart Money analysis.

**Divergence** — When the price makes a new high (or low) but an indicator like RSI does not. This mismatch can warn that a trend is running out of steam. FXFlow's EdgeFinder checks for divergence automatically.

**Drawdown** — How far your account has fallen from its highest point. If your account peaked at $10,000 and is now $9,200, your drawdown is $800 (or 8%). Shown in Analytics.

## E

**EdgeFinder** — FXFlow's AI-powered trade scanner that automatically analyzes currency pairs using 14 techniques (Smart Money Concepts, technical indicators, Fibonacci, and more) across multiple timeframes. It runs a 3-tier AI pipeline to find and evaluate trade opportunities. In the codebase, EdgeFinder is called "AI Trader" (`ai-trader` in paths, types, and database models), but the UI always shows "EdgeFinder." Found under the EdgeFinder page in the sidebar.

**EMA (Exponential Moving Average)** — A smoothed line on the chart that follows the price, giving more importance to recent prices. Traders use EMAs to spot trends. The EdgeFinder uses EMA crossovers as one of its techniques.

**Equity** — Your account balance _plus or minus_ the profit or loss of all open trades. Equity changes in real time as prices move. Shown on the Dashboard.

**Equity Curve** — A chart that plots your equity over time. An upward-sloping curve means you are growing your account. Visible in Analytics.

## F

**Fair Value Gap (FVG)** — A gap left behind when the price moves so fast that it skips over a range. The market often comes back to "fill" these gaps later, creating trade opportunities. The EdgeFinder scans for FVGs.

**Fibonacci** — A sequence of numbers used to draw levels on a chart (like 38.2%, 50%, 61.8%). Traders expect the price to pause or reverse at these levels. FXFlow's EdgeFinder uses Fibonacci retracements, especially the OTE zone.

**Forex** — Short for "foreign exchange." It is the global marketplace where currencies are traded against each other, 24 hours a day, five days a week. FXFlow is built for forex trading.

## H

**Hedge** — Opening a trade in the _opposite_ direction of one you already have, to reduce risk. For example, if you are long EUR/USD, you might also go short EUR/USD to protect against a sudden drop.

## K

**Kill Zone** — Specific hours of the trading day when the biggest price moves tend to happen (for example, the London open or the New York open). The EdgeFinder can focus its scanning on kill zones for higher-quality setups.

## L

**Leverage** — Borrowing power from your broker that lets you control a large position with a small amount of money. 50:1 leverage means $1,000 controls $50,000 worth of currency. Leverage magnifies both profits _and_ losses.

> [!WARNING]
> High leverage can wipe out your account quickly. Always use a stop loss and risk only a small percentage of your balance per trade.

**Limit Order** — An order that waits at a specific price and only executes if the market reaches that price. For example, "Buy EUR/USD if it drops to 1.0800." Shown on the Pending Orders tab of the Positions page.

**Liquidity Sweep** — When the price briefly spikes past a key level (grabbing stop losses from other traders) and then reverses sharply. Smart Money traders look for these sweeps as entry signals. The EdgeFinder includes liquidity sweep detection.

**Long** — Buying a currency pair because you expect its price to go up. The opposite of Short.

**Lot** — A standard unit of trade size in forex. One standard lot = 100,000 units of the base currency. A mini lot is 10,000 units, and a micro lot is 1,000 units. FXFlow shows position sizes in units on the Positions page.

## M

**MACD (Moving Average Convergence Divergence)** — An indicator that shows the relationship between two moving averages. When the MACD line crosses above the signal line, it can be a buy signal (and vice versa). Used by the EdgeFinder.

**MAE (Maximum Adverse Excursion)** — The worst point a trade reached while it was open (the biggest unrealized loss). Useful for reviewing whether your stop loss was placed well. Shown in trade details.

**Margin** — The amount of money your broker sets aside as collateral when you open a leveraged trade. If your margin runs out, the broker may close your trades automatically (a "margin call").

**Market Order** — An order that executes immediately at the current market price. When you click "Buy" or "Sell" in FXFlow, a market order is placed.

**MFE (Maximum Favorable Excursion)** — The best point a trade reached while it was open (the biggest unrealized profit). Helps you evaluate whether your take profit was set well. Shown in trade details.

## O

**OANDA** — The forex broker that FXFlow connects to. OANDA holds your money and executes your trades. FXFlow reads your account data from OANDA and sends trade instructions to it. Configure your OANDA connection in Settings.

> [!NOTE]
> FXFlow syncs with OANDA every 2 minutes and also listens for instant updates. If something looks out of date, you can force a sync from the Positions page.

**OB (Order Block)** — A candle (or small group of candles) where institutional traders placed large orders. When the price returns to that area, it may react strongly. Part of Smart Money Concepts, used by the EdgeFinder.

**OTE (Optimal Trade Entry)** — A zone between the 61.8% and 78.6% Fibonacci retracement levels. Smart Money traders consider this the ideal area to enter a trade during a pullback. The EdgeFinder looks for OTE setups.

## P

**Partial Close** — Closing only part of an open trade to lock in some profit while leaving the rest running. You can do this from the Positions page in FXFlow.

**Pending Order** — An order that has been placed but has not executed yet because the price has not reached its trigger level. Includes limit orders and stop orders. Shown on the Pending Orders tab.

**Pip** — The smallest standard price movement in a currency pair. For most pairs, one pip = 0.0001 (the fourth decimal place). For yen pairs, one pip = 0.01. FXFlow shows profit and loss in both pips and currency.

**Position Size** — How many units of a currency pair you buy or sell in a single trade. Bigger size = bigger potential profit _and_ bigger potential loss. FXFlow can help calculate appropriate position sizes based on your risk settings.

**Profit Factor** — Total profit from winning trades divided by total loss from losing trades. A profit factor above 1.0 means you are making more than you lose overall. Shown in Analytics.

## R

**R-Multiple** — How much you made (or lost) on a trade compared to your initial risk. If you risked $100 and made $250, that is a 2.5R trade. A negative R-Multiple means a loss. Shown in trade details and Analytics.

**Reconciliation** — The process where FXFlow checks your OANDA account and updates its own records to match. This happens automatically every 2 minutes. You will sometimes see "reconciling" in the status bar.

**Resistance** — A price level where the market has struggled to go higher in the past. Think of it as a ceiling. If the price breaks through resistance, it often keeps going up.

**Risk-Reward Ratio** — The amount you could lose compared to the amount you could gain on a trade. A 1:3 risk-reward means you risk $1 to potentially make $3. FXFlow shows this ratio when you set up a trade.

**Rollover** — A small fee (or credit) applied to positions held overnight, based on the interest rate difference between the two currencies. Also called swap. Shown in trade details.

**RSI (Relative Strength Index)** — A number from 0 to 100 that measures whether a currency pair has been bought too much (above 70 = "overbought") or sold too much (below 30 = "oversold"). One of the EdgeFinder's analysis techniques.

## S

**Session (Trading)** — A block of hours when a major financial centre is open. The three main sessions are Tokyo (Asian), London (European), and New York (American). Prices tend to move most when sessions overlap.

**Short** — Selling a currency pair because you expect its price to go down. The opposite of Long.

**Slippage** — The difference between the price you expected and the price you actually got when your order was filled. It happens during fast-moving markets. FXFlow logs slippage so you can review it later.

**Smart Money Concepts (SMC)** — A trading approach that tries to follow what large institutional traders ("smart money") are doing. Includes ideas like Order Blocks, Fair Value Gaps, BOS, CHoCH, and Liquidity Sweeps. FXFlow's EdgeFinder has a full SMC analysis suite.

**Spread** — The difference between the Bid and Ask price. It is essentially the cost of entering a trade. Tighter spreads mean lower costs. Spreads are visible on the Charts page and in trade details.

**Stop Loss** — A safety order that automatically closes your trade if the price moves against you by a set amount. It limits how much you can lose on a single trade. You can set and adjust stop losses from the Positions page.

> [!WARNING]
> Never trade without a stop loss. A single bad trade without one can cause serious damage to your account.

**Supply Zone** — A price area where sellers stepped in strongly in the past, so the price might fall if it returns there. The opposite of a Demand Zone. Used by the EdgeFinder.

**Support** — A price level where the market has struggled to go lower in the past. Think of it as a floor. If the price breaks through support, it often keeps falling.

**Swap** — See **Rollover**. The daily interest charge or credit on an open position. Shown in trade details as "Swap" or "Financing."

## T

**Take Profit** — An order that automatically closes your trade when the price reaches a target level in your favour, locking in your profit. Set it when you open a trade, or add it later from the Positions page.

**Timeframe** — The time period each candlestick represents on a chart. Common timeframes: 1 minute (M1), 5 minutes (M5), 1 hour (H1), 4 hours (H4), daily (D1). Higher timeframes show the bigger picture; lower timeframes show more detail.

**Trailing Stop** — A stop loss that moves automatically as the price moves in your favour, but stays put if the price reverses. It lets profits run while still protecting against a reversal.

**Trend** — The general direction the price is moving over time: up (bullish), down (bearish), or sideways (ranging). Most trading strategies work best when you trade _with_ the trend.

## U

**Unrealized P/L** — The profit or loss on trades that are still open. It changes constantly as prices move. "Unrealized" means you have not locked it in yet. Shown on the Dashboard and Positions page.

> [!FOREX]
> Unrealized P/L only becomes real profit or loss when you close the trade. A winning trade can turn into a losing trade if you hold on too long.

## W

**Webhook** — A URL that receives automatic messages from another service. FXFlow uses webhooks to receive alerts from TradingView. When TradingView sends a signal, the webhook catches it and passes it to FXFlow's daemon for processing.

**Williams %R** — An indicator similar to RSI that ranges from 0 to -100. Readings above -20 suggest overbought conditions; below -80 suggest oversold. One of the techniques available to the EdgeFinder.

**Win Rate** — The percentage of your trades that ended in profit. A 60% win rate means 6 out of every 10 trades were winners. Shown in Analytics. A high win rate does not guarantee profitability unless your average winner is larger than your average loser.
