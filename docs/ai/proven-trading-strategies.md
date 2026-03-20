# Proven Automated Trading Strategies & Techniques

Research compiled from institutional trading practices, prop firm methodologies, backtested algorithmic systems, and smart money concepts (SMC/ICT). Focus: strategies that prioritize consistent profitability and capital preservation over high returns.

---

## Table of Contents

1. [Supply & Demand Zone Trading (Institutional Approach)](#1-supply--demand-zone-trading-institutional-approach)
2. [Smart Money Concepts for Automated Trading](#2-smart-money-concepts-for-automated-trading)
3. [Mean Reversion Strategies](#3-mean-reversion-strategies)
4. [Trend-Following Approaches](#4-trend-following-approaches)
5. [Entry Confirmation Techniques](#5-entry-confirmation-techniques)
6. [Position Management & Exit Strategies](#6-position-management--exit-strategies)
7. [Risk Management Frameworks](#7-risk-management-frameworks)
8. [Session-Based Trading Filters](#8-session-based-trading-filters)
9. [Common Failure Modes & How to Fix Them](#9-common-failure-modes--how-to-fix-them)
10. [Composite Strategy Recommendations](#10-composite-strategy-recommendations)

---

## 1. Supply & Demand Zone Trading (Institutional Approach)

### How Institutions Trade Zones

Institutional zone trading differs fundamentally from retail approaches. Institutions do not simply buy at demand and sell at supply. They:

- **Create** zones through large block orders that create imbalances
- **Return** to zones to fill remaining orders (the "retest")
- **Sweep** liquidity above/below zones before entering (stop hunts)

### Zone Scoring System

A robust automated system should score zones on these factors:

| Factor                     | Weight   | Description                                                                                                                                                                                      |
| -------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Freshness**              | High     | Untested zones have highest probability. Each retest reduces strength as resting orders get filled. First touch: ~72-85% reaction rate. Second touch: ~55-60%. Third touch: largely invalidated. |
| **Departure Velocity**     | High     | Speed and magnitude of the move away from the zone. Strong, explosive departures with long-bodied candles signal major imbalance. Measure via ATR multiples (>2x ATR departure = strong).        |
| **Time at Level**          | Medium   | Less time spent forming the zone = stronger zone. Quick, decisive moves indicate institutional urgency.                                                                                          |
| **Zone Width**             | Medium   | Narrower zones (relative to ATR) offer better risk:reward. Zones wider than 2x ATR are lower quality for entries.                                                                                |
| **HTF Alignment**          | Critical | Zone must align with higher-timeframe trend direction. Counter-trend zones have significantly lower success rates.                                                                               |
| **Volume Characteristics** | Medium   | Unusual volume spikes during zone formation confirm institutional participation.                                                                                                                 |

**Scoring formula (recommended):**

```
score = (freshness * 0.30) + (departure_velocity * 0.25) + (htf_alignment * 0.20) + (time_at_level * 0.10) + (zone_width * 0.10) + (volume * 0.05)
```

Minimum score threshold: 7/10 for trade entry.

### Multi-Timeframe Framework

The proven institutional approach uses a 3-tier timeframe structure:

1. **Higher Timeframe (Daily/4H):** Establish directional bias. Identify major supply/demand zones. Only trade in the direction of the HTF trend.
2. **Intermediate Timeframe (1H):** Observe trend structure (higher highs/higher lows for bullish). Identify intermediate zones within the HTF context.
3. **Entry Timeframe (15M/5M):** Wait for price to pull back into an intermediate zone. Look for entry confirmation patterns (see Section 5).

**Expected performance:**

- Win rate: 55-65% (with proper confirmation)
- Risk:Reward: 1:2 to 1:3
- Profit factor: 1.4-2.0
- Why it works: Zones represent unfilled institutional orders. When price returns, those orders execute, creating predictable reactions.

### Zone Invalidation Rules

A zone is invalidated when:

- Price **closes through** the zone (not just wicks)
- The zone has been tested **3+ times**
- The zone is **older than 20-30 candles** on its formation timeframe (age decay)
- A **structural break** (BOS) occurs in the opposite direction on the zone's timeframe

---

## 2. Smart Money Concepts for Automated Trading

### Codifiable SMC Components

These SMC concepts can be systematically detected and automated:

#### Order Blocks (OBs)

- **Definition:** The last opposing candle before a strong impulsive move that breaks structure.
- **Bullish OB:** Last bearish candle before a strong bullish displacement that creates a BOS.
- **Bearish OB:** Last bullish candle before a strong bearish displacement that creates a BOS.
- **Algorithmic detection:** Find swing structure breaks, then look back to the last opposing candle. Validate that the subsequent move was impulsive (>2x ATR).
- **Key rule:** No BOS = no valid Order Block. The structural break is the institutional signature.
- **Expected win rate:** 72-85% on first touch (per backtested ICT systems), drops significantly on retests.

#### Fair Value Gaps (FVGs)

- **Bullish FVG:** When candle N-1's high < candle N+1's low (gap between bodies).
- **Bearish FVG:** When candle N-1's low > candle N+1's high.
- **Algorithmic detection:** Compare high[i-1] vs low[i+1] for bullish, low[i-1] vs high[i+1] for bearish.
- **Trading rule:** Price tends to return to fill FVGs. Entry on 50% retracement of the FVG. First tap during a session window offers the highest probability reaction.
- **Parameter:** `join_consecutive: true` to merge multiple sequential FVGs into one zone.
- **Expected win rate:** 60-70% when traded with trend and session filter.

#### Liquidity Sweeps

- **Definition:** Price briefly breaks above/below a cluster of equal highs/lows, then reverses.
- **Detection:** Identify clusters of highs/lows within a tight range (e.g., within 5 pips). When price breaks the cluster then closes back inside, flag as a sweep.
- **Trading rule:** After a sweep, look for entry at the nearest OB or FVG in the reversal direction.
- **Why it works:** Institutions deliberately push price into stop-loss clusters to fill large orders, then reverse.

#### Break of Structure (BOS) / Change of Character (CHOCH)

- **BOS:** Price breaks the most recent swing high (bullish) or swing low (bearish), confirming trend continuation.
- **CHOCH:** Price breaks structure in the opposite direction of the prevailing trend, signaling potential reversal.
- **Algorithmic detection:** Track swing highs and swing lows. Compare each new swing against the previous same-type swing.
- **Key for automation:** CHOCH is the earliest signal of trend change. BOS confirms continuation. A trade should only be taken after a confirmed BOS in the trade direction.

### Python Libraries for SMC Detection

The `smartmoneyconcepts` PyPI package provides algorithmic detection for:

- Order Blocks (with volume strength percentage)
- Fair Value Gaps (with consecutive gap merging)
- Swing Highs/Lows
- BOS/CHOCH detection
- Liquidity level identification

Input format: OHLCV DataFrame with lowercase columns `["open", "high", "low", "close", "volume"]`.

---

## 3. Mean Reversion Strategies

### Bollinger Band Mean Reversion

**Backtested results across forex pairs:**

- 4H timeframe: 72% win rate, 0.8% average return per trade
- Daily timeframe: 78% win rate, 1.5% average return per trade
- 1H timeframe: 65% win rate, 0.3% average return per trade

**Parameters:**

- Bollinger Bands: 20-period SMA, 2 standard deviations
- Entry: Price touches lower band + RSI(14) < 30 for longs (inverse for shorts)
- Exit: Price returns to middle band (20 SMA) or touches opposite band
- Stop: 1.5x ATR(14) beyond the entry band

**Why it works:** Prices are mean-reverting in ranging markets. The 2-sigma band represents a statistically extreme deviation. Combined with RSI confirmation, this filters out trending moves that would cause false mean-reversion signals.

**Application to zone trading:** Use mean reversion as a confluence filter. When price reaches a demand zone AND touches the lower Bollinger Band AND RSI < 30, the trade has triple confirmation. This combined approach raises win rates to ~75-80%.

### RSI Mean Reversion

**Backtested results (RSI(14) < 30 buy signal, SPY daily):**

- Win rate: 58%
- Risk:Reward: 1:1.8
- Average holding period: 3-5 days

**For zone trading application:**

- RSI(14) < 30 at a demand zone = high-probability long entry
- RSI(14) > 70 at a supply zone = high-probability short entry
- RSI divergence (price makes new low but RSI makes higher low) at a zone = strongest signal

---

## 4. Trend-Following Approaches

### EMA Crossover with Zone Confluence

**Parameters:**

- Fast EMA: 9-period
- Slow EMA: 21-period
- Trend filter: 50-period or 200-period EMA for overall direction

**Rules:**

1. Only take demand zone entries when price is above the 50 EMA (bullish trend)
2. Only take supply zone entries when price is below the 50 EMA (bearish trend)
3. EMA crossover in the trade direction provides additional confirmation

**Expected improvement:** Adding a trend filter to zone trading typically improves win rate by 10-15% while reducing total trade count by 30-40%.

### ADX Trend Strength Filter

- ADX > 25: Trending market. Favor trend-following zone entries (with-trend).
- ADX < 20: Ranging market. Mean reversion from zones works better.
- ADX > 40: Strong trend. Avoid counter-trend zone entries entirely.

**Application:** Use ADX as a mode switch. In trending conditions, only trade zones aligned with the trend. In ranging conditions, trade both supply and demand zones as mean reversion.

---

## 5. Entry Confirmation Techniques

### The 3-Candle Confirmation Entry (Institutional Standard)

This is the mechanical trigger used by institutional traders to validate an Order Block:

1. **Candle 1:** Price enters the zone (OB/demand/supply).
2. **Candle 2:** Price shows rejection (wick into zone, close back outside).
3. **Candle 3:** Confirmation candle forms one of these patterns:
   - Engulfing pattern (bullish engulfing at demand, bearish at supply)
   - Pin bar / hammer with wick into zone
   - Morning/Evening star formation

**Entry:** On the close of the 3rd candle.
**Stop loss:** Below the zone (demand) or above the zone (supply).
**Expected win rate:** 65-75% when combined with HTF alignment.

### Risk Entry vs. Confirmation Entry

| Approach               | Entry Point                  | Win Rate | R:R         | Best For                                             |
| ---------------------- | ---------------------------- | -------- | ----------- | ---------------------------------------------------- |
| **Risk Entry**         | Limit order at zone boundary | 50-55%   | 1:3+        | High-quality zones (score 8+/10), time-proven setups |
| **Confirmation Entry** | After BOS/CHOCH at zone      | 65-75%   | 1:1.5-1:2.5 | Most automated trading, lower-score zones            |

**Recommendation for automation:** Use confirmation entry as default. Reserve risk entries only for zones scoring 9+/10 with perfect HTF alignment.

### Displacement Confirmation

Displacement = an impulsive, multi-candle move that shows genuine institutional commitment.

**Detection criteria:**

- 3+ consecutive candles in the same direction
- Combined range > 2x ATR
- Little to no overlap between candle bodies (bodies stacked, not overlapping)

**Application:** After price taps a zone, wait for displacement in the expected direction before entering. This filters out weak, unconvincing reactions.

### Additional Confirmation Filters (Stack for Higher Win Rate)

Each additional filter increases win rate by ~5-8% but reduces trade frequency:

1. **RSI divergence** at the zone
2. **Volume spike** on the reaction candle (>1.5x average volume)
3. **FVG formation** in the reaction move
4. **BOS on LTF** after zone tap
5. **Session alignment** (trade during kill zones only)

---

## 6. Position Management & Exit Strategies

### Scaling Out (Proven Approach)

The most consistently profitable position management technique:

| Level          | Action                             | Effect                          |
| -------------- | ---------------------------------- | ------------------------------- |
| **Entry**      | Full position (1R risk)            | -                               |
| **1R profit**  | Close 50% + move stop to breakeven | Risk eliminated, profit locked  |
| **2R profit**  | Close 25% + trail stop to 1R       | Guaranteed 1.25R profit minimum |
| **3R+ profit** | Trail remaining 25% with ATR stop  | Captures extended moves         |

**Why this works:** The 50% close at 1R + breakeven stop converts roughly 55-60% of trades into winners (since breakeven trades are neither wins nor losses). The remaining position captures outsized gains on trending moves, improving overall expectancy.

**Net effect on metrics:**

- Effective win rate: ~70-75% (counting breakeven as neutral)
- Average R:R: ~1.2-1.5R (reduced by partial exits but compensated by consistency)
- Profit factor: 2.0-2.5
- Maximum drawdown: ~40% lower than all-in/all-out approach

### ATR Trailing Stop (Chandelier Exit)

**Optimal parameters (backtested):**

- ATR period: 22
- Multiplier: 3.0x for standard volatility
- Multiplier: 5.0x for volatile instruments

**Calculation:**

```
Long trail: Highest High(22) - 3.0 * ATR(22)
Short trail: Lowest Low(22) + 3.0 * ATR(22)
```

**Why 3x ATR:** Backtesting shows 3x ATR keeps you in trending moves while avoiding premature exits from normal volatility. Values below 2x result in excessive whipsaws; values above 4x give back too much profit.

### Time-Based Exits (Triple Barrier Method)

The Triple Barrier Method uses three simultaneous exit conditions:

1. **Take-Profit barrier:** Price reaches target (e.g., 2R)
2. **Stop-Loss barrier:** Price hits stop (e.g., -1R)
3. **Time barrier:** Close after N candles regardless of P&L

**Recommended time barriers by strategy type:**

| Strategy       | Max Holding Period | Rationale                                            |
| -------------- | ------------------ | ---------------------------------------------------- |
| Scalp (M5/M15) | 2-4 hours          | Diminishing edge after initial momentum              |
| Intraday (H1)  | End of session     | Avoid overnight gap risk                             |
| Swing (H4/D1)  | 5-10 days          | Trend impulses typically play out within this window |

**Adaptive time stops:** Extend the time barrier if the trade is in profit and still showing momentum (ADX > 25). Shorten the time barrier in choppy conditions (ADX < 20).

### Breakeven Stop Rules

**When to move stop to breakeven:**

- After price moves 1R in your favor (conservative)
- After price creates a new swing point beyond entry (structural)
- After 50% position is closed at 1R

**Important caveat:** Moving to breakeven too early (e.g., at 0.5R) significantly reduces win rate because normal market noise stops you out. Studies show that requiring at least 1R of movement before BE reduces premature stops by ~30%.

---

## 7. Risk Management Frameworks

### Position Sizing: Fractional Kelly Criterion

The Kelly Criterion calculates the mathematically optimal bet size:

```
Kelly % = W - [(1 - W) / R]

Where:
W = win probability (e.g., 0.60)
R = win/loss ratio (e.g., 2.0)

Example: 0.60 - [(1 - 0.60) / 2.0] = 0.60 - 0.20 = 0.40 (40%)
```

**Critical: Never use full Kelly.** Professional traders use fractional Kelly:

| Fraction            | Growth          | Drawdown           | Used By              |
| ------------------- | --------------- | ------------------ | -------------------- |
| Full Kelly (100%)   | Maximum         | Severe (50%+)      | Nobody sane          |
| Half Kelly (50%)    | ~75% of optimal | ~50% less drawdown | Aggressive algos     |
| Quarter Kelly (25%) | ~50% of optimal | ~75% less drawdown | Most professionals   |
| Tenth Kelly (10%)   | ~20% of optimal | Minimal drawdown   | Capital preservation |

**Recommendation:** Start with Quarter Kelly. If your strategy has a verified edge over 200+ trades with >55% win rate and >1.5R average win, move to Half Kelly.

### Fixed Fractional Position Sizing

Simpler than Kelly and widely used:

```
Position Size = (Account Equity * Risk %) / (Entry - Stop Loss)

Example:
- Account: $10,000
- Risk: 1% = $100
- Entry: 1.1000, Stop: 1.0950 (50 pips)
- Position: $100 / 50 pips = $2/pip = ~20,000 units
```

**Recommended risk percentages:**

| Account Phase                      | Risk Per Trade | Max Open Risk |
| ---------------------------------- | -------------- | ------------- |
| Testing/Proving (first 100 trades) | 0.5%           | 2%            |
| Established edge (100-500 trades)  | 1.0%           | 4%            |
| Proven system (500+ trades)        | 1.5-2.0%       | 6%            |

### Correlation-Based Exposure Limits

**The "danger zone" for forex correlation is >0.75:**

- EUR/USD and GBP/USD: typically ~0.85 correlation = treat as single risk unit
- AUD/USD and NZD/USD: typically ~0.90 correlation = essentially the same trade
- USD/JPY and EUR/JPY: moderate ~0.60 correlation = can trade independently

**Rules:**

1. Maximum 3% total risk on pairs with correlation > 0.75
2. Treat highly correlated pairs (>0.85) as a single position for risk purposes
3. Maximum 2-3 concurrent positions per currency (e.g., max 3 trades involving USD)
4. Recalculate correlation matrix weekly (correlations shift over time)

### Drawdown Circuit Breakers

**Tiered drawdown response system (prop firm standard):**

| Trigger              | Action                                           |
| -------------------- | ------------------------------------------------ |
| 3% daily drawdown    | Reduce position size by 50% for remainder of day |
| 5% daily drawdown    | Stop trading for the day entirely                |
| 2 consecutive losses | Reduce next trade size by 50%                    |
| 3 consecutive losses | Pause trading for 1 hour minimum                 |
| 5 consecutive losses | Stop trading for the day; review system          |
| 8% weekly drawdown   | Reduce all position sizes by 50% for the week    |
| 10% monthly drawdown | Halt system; full strategy review required       |

**Recovery rules:**

- After a circuit breaker triggers, scale risk back up gradually (not immediately)
- Resume at 50% normal risk, increase by 25% after each profitable trade
- Full risk restoration only after recovering 50% of the drawdown

### Maximum Open Positions

| Strategy Type | Max Concurrent Trades | Max Per Currency |
| ------------- | --------------------- | ---------------- |
| Scalp         | 1-2                   | 1                |
| Intraday      | 2-3                   | 1                |
| Swing         | 3-5                   | 2                |

**Portfolio heat limit:** Never exceed 5% total open risk across all positions simultaneously.

---

## 8. Session-Based Trading Filters

### ICT Kill Zones (Proven Session Windows)

Kill zones are the time windows with highest institutional participation and strongest price movements:

| Kill Zone         | Time (UTC)  | Time (New York)        | Characteristics                      |
| ----------------- | ----------- | ---------------------- | ------------------------------------ |
| **Asian**         | 00:00-03:00 | 19:00-22:00 (prev day) | Range formation, liquidity building  |
| **London Open**   | 07:00-10:00 | 02:00-05:00            | Highest volatility, trend initiation |
| **New York Open** | 12:00-15:00 | 07:00-10:00            | London/NY overlap, strongest moves   |
| **London Close**  | 15:00-17:00 | 10:00-12:00            | Reversals, profit-taking             |

### Session Filter Rules for Zone Trading

1. **Only enter trades during kill zones.** Trades outside these windows have statistically worse outcomes due to lower liquidity and wider spreads.

2. **London Open (07:00-10:00 UTC):** Best for trend-following zone entries. Price often sweeps Asian session highs/lows then trends.

3. **NY Open (12:00-15:00 UTC):** Best overall session. The London/NY overlap provides maximum liquidity. Common pattern: price retraces into London session zones before continuing or reversing.

4. **Avoid:**
   - Last hour of NY session (19:00-21:00 UTC): Low liquidity, erratic movements
   - Asian session: Unless trading JPY/AUD pairs, ranges tend to be too tight
   - First 5 minutes of any session open: Let the initial volatility settle

5. **Pre-news blackout:** No new entries 30 minutes before high-impact news events (NFP, CPI, FOMC, GDP). Close or tighten stops on existing positions.

### Session-Aware Zone Strategy

The highest-probability setup combines session timing with zone trading:

1. **Mark Asian session high/low** as liquidity levels
2. **At London open,** watch for a sweep of Asian liquidity (stop hunt)
3. **After the sweep,** look for a zone entry (OB/demand/supply) with confirmation
4. **Target:** The opposite side of the Asian range, or the next major zone

This setup has a reported 65-75% win rate because it exploits the predictable institutional behavior of sweeping overnight liquidity before establishing the daily trend.

---

## 9. Common Failure Modes & How to Fix Them

### Why Automated Zone Systems Fail

| Failure Mode                    | Root Cause                                                            | Fix                                                                                                                |
| ------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Static zone analysis**        | Treating zones as permanent; not accounting for order absorption      | Implement zone aging decay. Score reduces with each candle of age. Invalidate after 3 touches or structural break. |
| **No trend filter**             | Trading counter-trend zones, which fail 60-70% of the time            | Mandatory HTF alignment. Only trade zones in the direction of the H4/Daily trend.                                  |
| **Ignoring order flow context** | Entering zones without confirmation of actual buying/selling pressure | Require at minimum a confirmation candle pattern (engulfing, pin bar) at the zone.                                 |
| **Drawing zones too tight**     | Missing the full institutional accumulation area                      | Include the entire consolidation area before the impulsive move, not just the single candle.                       |
| **Drawing zones too wide**      | Poor risk:reward because stop is too far                              | If zone is wider than 1.5-2x ATR, skip it or use the distal edge only.                                             |
| **Over-optimization**           | Curve-fitting to historical data with too many parameters             | Keep rules to max 5-7 parameters. Use walk-forward optimization. Verify on out-of-sample data.                     |
| **No session filter**           | Taking trades in low-liquidity periods where zones react weakly       | Restrict entries to kill zones only.                                                                               |
| **Single timeframe analysis**   | Zones on one timeframe without context of higher timeframes           | Require zone alignment across at least 2 timeframes.                                                               |
| **No invalidation rules**       | Staying in positions when the zone thesis has clearly failed          | Close immediately if price closes through the zone on the entry timeframe.                                         |
| **Correlation blindness**       | Taking 3 long-USD trades simultaneously, tripling exposure            | Implement correlation matrix checks before opening new positions.                                                  |

### What Separates Profitable Zone Systems from Unprofitable Ones

**Profitable systems have:**

- Zone quality scoring (not all zones are equal)
- Multi-timeframe confirmation (minimum 2 timeframes aligned)
- Session filters (only trade during high-liquidity windows)
- Confirmation entry (don't blindly enter at zone touch)
- Robust risk management (position sizing, correlation limits, circuit breakers)
- Zone aging/invalidation (zones are not permanent)
- Trend alignment (don't fight the higher timeframe)

**Unprofitable systems typically:**

- Treat all zones equally
- Enter on zone touch without confirmation
- Trade 24/5 without session awareness
- Use fixed position sizes regardless of zone quality
- Have no mechanism for zone invalidation
- Trade counter-trend zones
- Over-optimize parameters to historical data

---

## 10. Composite Strategy Recommendations

### Strategy A: Conservative Zone Scalper (Highest Win Rate)

**Target:** 70-80% win rate, 1:1.2 R:R, small consistent profits.

**Rules:**

1. HTF bias: Daily/4H EMA(50) direction determines bias
2. Zone identification: H1 supply/demand zones, scored 7+/10
3. Entry confirmation: 3-candle pattern at zone on M15
4. Session filter: London Open or NY Open kill zones only
5. Exit: 50% at 1R, 50% at middle Bollinger Band
6. Stop: Below/above zone + 0.5x ATR buffer
7. Time exit: Close after 4 hours if neither TP nor SL hit
8. Max positions: 2 concurrent, 1 per currency

### Strategy B: SMC Swing Trader (Best Risk-Adjusted Returns)

**Target:** 60-65% win rate, 1:2.5 R:R, larger but less frequent wins.

**Rules:**

1. HTF bias: Daily BOS/CHOCH determines direction
2. Zone identification: H4 Order Blocks with FVG confluence
3. Entry: H1 BOS at OB after liquidity sweep
4. Session filter: Enter during London or NY, hold overnight
5. Exit: Scale out 33/33/33 at 1R, 2R, 3R
6. Stop: Beyond OB + 1x ATR buffer
7. Trail: Chandelier exit (22-period, 3x ATR) on remaining position
8. Time exit: Close after 5 trading days if in drawdown
9. Max positions: 3-5 concurrent, 2 per currency

### Strategy C: Mean Reversion Zone Bouncer (Ranging Markets)

**Target:** 75-80% win rate, 1:1 R:R, high frequency in ranges.

**Rules:**

1. Market condition: ADX(14) < 20 (confirmed range)
2. Zone identification: H1/H4 supply/demand zones at range extremes
3. Entry: Price at zone + lower Bollinger Band + RSI(14) < 30
4. Session filter: Any kill zone; extra confidence during London/NY overlap
5. Exit: Target middle of range (mean)
6. Stop: Beyond zone + 1x ATR
7. Time exit: Close after 8 hours
8. Pause: If ADX crosses above 25, stop taking mean reversion trades

### Key Metrics to Monitor in Live Trading

| Metric               | Healthy Range | Action if Outside                    |
| -------------------- | ------------- | ------------------------------------ |
| Win rate             | >55%          | Review entry confirmation filters    |
| Profit factor        | >1.5          | Review exit management               |
| Max drawdown         | <15%          | Trigger circuit breaker review       |
| Average R            | >0.8R         | Check if partial exits are optimal   |
| Sharpe ratio         | >1.0          | Acceptable risk-adjusted returns     |
| Consecutive losses   | <5            | If exceeded, pause and review        |
| Correlation exposure | <5% total     | Reduce positions on correlated pairs |

---

## Sources

### Algorithmic Trading Strategies

- [Forex Algorithmic Trading Strategies That Actually Work in 2026](https://newyorkcityservers.com/blog/forex-algorithmic-trading-strategies)
- [Algorithmic Trading Strategies 2026 - Backtests, Rules And Settings](https://www.quantifiedstrategies.com/algorithmic-trading-strategies/)
- [10 Best Forex Algorithmic Trading Strategies](https://www.quantvps.com/blog/10-best-forex-algorithmic-trading-strategies-pros-cons)

### Supply & Demand Zone Trading

- [Supply and Demand Trading Guide 2025: Master Institutional Zone Analysis](https://www.purefinancialacademy.com/blog/mastering-supply-and-demand-zones-a-practical-guide-for-modern-traders)
- [How to Use Supply and Demand Zones in Prop Trading](https://www.fortraders.com/blog/how-to-use-supply-and-demand-zones-in-prop-trading)
- [Supply and Demand Trading Strategy Backtest](https://www.quantifiedstrategies.com/supply-and-demand-trading-strategy/)
- [Top Mistakes Traders Make with Supply and Demand Trading](https://bookmap.com/blog/top-mistakes-traders-make-with-supply-and-demand-trading-and-how-to-fix-them)
- [Warning Signs Of A Supply And Demand Zone Failure](https://forexmentoronline.com/warning-signs-of-a-supply-and-demand-zone-failure/)
- [5 Rules For Trading Supply And Demand Like A Pro](https://priceactionninja.com/5-rules-for-trading-supply-and-demand-like-a-pro-trader/)
- [Supply Demand Zones Pro Indicator](https://www.tradingview.com/script/h0jxhmgn-Supply-Demand-Zones-Pro/)

### Smart Money Concepts

- [Smart Money Concepts Python Library](https://github.com/joshyattridge/smart-money-concepts)
- [smartmoneyconcepts on PyPI](https://pypi.org/project/smartmoneyconcepts/)
- [A Strategist's Guide to Smart Money Concepts](https://medium.com/@daolien906118/a-strategists-guide-to-smart-money-concepts-smc-trading-with-the-institutional-flow-4ae3fce50174)
- [Anatomy of a Valid Order Block](https://liquidityfinder.com/news/anatomy-of-a-valid-order-block-in-smart-money-concepts-67221)
- [Understanding Smart Money Concepts Through StrategyQuant](https://strategyquant.com/blog/understanding-smart-money-concepts-through-strategyquant-indicators/)

### Entry Confirmation

- [The 3-Candle Confirmation Entry: How To Trade Order Blocks](https://tradingstrategyguides.com/the-3-candle-confirmation-entry-how-to-trade-order-blocks-with-precision/)
- [3 Secret Supply And Demand Entry Confirmation Signals](https://priceactionninja.com/3-secret-supply-and-demand-entry-confirmation-signals/)
- [Entry Confirmation Techniques in Trading](https://traze.com/academy/advanced-strategies-forex-brokers/entry-confirmation-techniques-trading/)
- [Order Flow: Absorption Setup](https://www.trader-dale.com/order-flow-how-to-trade-the-absorption-setup-trade-entry-confirmation/)

### Mean Reversion

- [Mean Reversion Strategies: Backtested](https://www.quantifiedstrategies.com/mean-reversion-strategies/)
- [Mean Reversion Strategies - Complete Backtesting Guide](https://backtestme.com/guides/mean-reversion-strategies)
- [Mean Reversion Trading: Fading Extremes with Precision](https://www.luxalgo.com/blog/mean-reversion-trading-fading-extremes-with-precision/)

### Trailing Stops & Position Management

- [5 ATR Stop-Loss Strategies for Risk Control](https://www.luxalgo.com/blog/5-atr-stop-loss-strategies-for-risk-control/)
- [Chandelier Exit](https://chartschool.stockcharts.com/table-of-contents/technical-indicators-and-overlays/technical-overlays/chandelier-exit)
- [Breakeven Algo Trading Strategies](https://brokeragetoday.com/breakeven-trading-algo-strategy/)

### Risk Management

- [The Risk-Constrained Kelly Criterion](https://blog.quantinsti.com/risk-constrained-kelly-criterion/)
- [Position Sizing Strategies for Algo-Traders](https://medium.com/@jpolec_72972/position-sizing-strategies-for-algo-traders-a-comprehensive-guide-c9a8fc2443c8)
- [Risk Management Strategies for Algo Trading](https://www.luxalgo.com/blog/risk-management-strategies-for-algo-trading/)
- [The Ultimate Risk Management Plan for Prop Firm Traders 2026](https://acy.com/en/market-news/education/market-education-ultimate-risk-management-prop-firm-traders-2025-j-o-20250801-123921/)
- [Prop Firm Daily Drawdown Rules](https://newyorkcityservers.com/blog/prop-firm-daily-drawdown-rules)

### Session Filters & Kill Zones

- [Master All 4 ICT Kill Zones Times](https://innercircletrader.net/tutorials/master-ict-kill-zones/)
- [Kill Zone Trading in Forex](https://fxopen.com/blog/en/kill-zone-trading-in-forex/)
- [Trading ICT Kill Zones: Complete Guide](https://howtotrade.com/blog/ict-kill-zones/)

### Correlation & Portfolio Risk

- [Currency Correlation & Portfolio Risk Guide](https://www.activtrades.com/en/news/forex-correlation-pairs-how-they-influence-multi-asset-portfolio-risk)
- [Forex Correlation Matrix: Stop Doubling Your Risk](https://fxnx.com/en/blog/the-forex-correlation-matrix-stop-the-hidden)

### Time-Based Exits

- [What 567,000 Backtests Taught Me About Algo Trading Exits](https://kjtradingsystems.com/algo-trading-exits.html)
- [Stop-Loss, Take-Profit, Triple-Barrier & Time-Exit Strategies](https://medium.com/@jpolec_72972/stop-loss-take-profit-triple-barrier-time-exit-advanced-strategies-for-backtesting-8b51836ec5a2)
- [Five Exit Strategies in Trading](https://www.quantifiedstrategies.com/trading-exit-strategies/)
