/**
 * Pip value calculation in the account (home) currency.
 *
 * **This is the only correct way to convert pip distances into dollar
 * amounts for forex pairs.** The naive `units × pips × pipSize` pattern
 * gives you a value in the *quote* currency, not your account currency —
 * so for EUR/JPY (quote = JPY), 287 units × 90.4 pips × 0.01 = ¥259.45,
 * which is ~$1.62 at USD/JPY=160, not $259.45.
 *
 * Pair structures and their exact pip-value formulas (assuming USD account):
 *
 *  1. **Quote is USD** (EUR/USD, GBP/USD, AUD/USD, NZD/USD): the pip IS
 *     already denominated in USD. `pipValueUsd = units × pipSize`.
 *
 *  2. **Base is USD** (USD/JPY, USD/CAD, USD/CHF): one unit of the quote
 *     currency is worth `1 / currentPrice` USD. So a pip (pipSize worth
 *     of quote) is `pipSize / currentPrice` USD per unit.
 *     `pipValueUsd = units × pipSize / currentPrice`.
 *
 *  3. **Cross pair** (EUR/JPY, GBP/JPY, EUR/GBP, AUD/CAD...): neither side
 *     is USD. We need a USD-to-quote conversion rate to translate the
 *     quote-denominated pip value into USD. When that rate is available
 *     (from the daemon's live quote cache, or derived from OANDA's own
 *     `unrealizedPL`), the formula is `(units × pipSize) / usdQuoteRate`.
 *     When it isn't, we return `null` and the caller must fall back to
 *     OANDA's authoritative `unrealizedPL` field — never guess.
 *
 * This module exports two helpers:
 *
 *  - {@link calculatePipValueUsd}: the structural formulas above.
 *  - {@link derivePipValueUsdFromUnrealizedPL}: the preferred path when a
 *    trade has an OANDA-reported `unrealizedPL` — self-calibrating because
 *    it inverts OANDA's own math.
 *
 * @module pip-value
 */

import { getPipSize } from "./pip-utils"

/**
 * Calculate USD per pip for a position, using the structural pair type.
 *
 * Returns `null` for cross pairs when no `usdQuoteRates` lookup is
 * provided — the caller MUST handle the null case (typically by falling
 * back to OANDA's authoritative `unrealizedPL`). Returning a wrong number
 * is worse than returning null, because callers will happily render it
 * next to a `$` sign and mislead the user by 100x+.
 *
 * @param instrument OANDA instrument name, e.g. "EUR_JPY"
 * @param units Position size in base-currency units (absolute value used)
 * @param currentPrice Current mid price — required only for USD-base pairs
 * @param usdQuoteRates Optional map from quote currency → USD/quote rate
 *                      (e.g. `{ JPY: 160.25, CAD: 1.38 }`). Provide this
 *                      when you have live rates available; without it,
 *                      cross pairs cannot be converted and return null.
 */
export function calculatePipValueUsd(opts: {
  instrument: string
  units: number
  currentPrice?: number | null
  usdQuoteRates?: Record<string, number> | null
}): number | null {
  const { instrument, usdQuoteRates } = opts
  const units = Math.abs(opts.units)
  if (units === 0) return 0

  const pipSize = getPipSize(instrument)
  const [base, quote] = instrument.split("_")
  if (!base || !quote) return null

  // Case 1: Quote is USD → pip is already in USD.
  if (quote === "USD") {
    return units * pipSize
  }

  // Case 2: Base is USD → one quote unit is 1/currentPrice USD, so a pip
  // (pipSize quote) is pipSize/currentPrice USD per unit of position.
  if (base === "USD") {
    if (!opts.currentPrice || opts.currentPrice <= 0) return null
    return (units * pipSize) / opts.currentPrice
  }

  // Case 3: Cross pair — require an explicit USD/quote rate.
  if (usdQuoteRates && typeof usdQuoteRates[quote] === "number" && usdQuoteRates[quote] > 0) {
    return (units * pipSize) / usdQuoteRates[quote]
  }

  return null
}

/**
 * Derive USD-per-pip for a specific trade by inverting OANDA's own math on
 * its `unrealizedPL`. This is the **preferred** path whenever a trade has
 * an OANDA-reported unrealized P&L, because OANDA is the ground truth:
 * whatever rate OANDA used to convert quote → home currency (account
 * currency) at settlement time is exactly the rate we want to reuse for
 * live updates between reconciles.
 *
 *   unrealizedPL = pipsDelta × pipValueUsd     (by definition)
 *   ⇒ pipValueUsd = |unrealizedPL / pipsDelta|
 *
 * When the trade is too close to break-even (`|pipsDelta| < 0.5`) the ratio
 * becomes unstable, so we fall back to the structural calculator. For
 * cross pairs near breakeven the structural calculator returns null —
 * that's fine, callers should treat null as "no USD view available" and
 * leave the OANDA `unrealizedPL` as-is without recomputing.
 *
 * @returns USD per pip for THIS trade, or null if no trustworthy value
 *          could be derived. Always non-negative.
 */
export function derivePipValueUsdFromUnrealizedPL(trade: {
  instrument: string
  direction: "long" | "short"
  entryPrice: number
  currentPrice: number | null
  currentUnits: number
  unrealizedPL: number
}): number | null {
  const pipSize = getPipSize(trade.instrument)

  if (trade.currentPrice && trade.currentPrice > 0) {
    const priceDiff =
      trade.direction === "long"
        ? trade.currentPrice - trade.entryPrice
        : trade.entryPrice - trade.currentPrice
    const pipsDelta = priceDiff / pipSize
    if (Math.abs(pipsDelta) >= 0.5 && trade.unrealizedPL !== 0) {
      // Self-calibrating: derived directly from OANDA's settlement math.
      return Math.abs(trade.unrealizedPL / pipsDelta)
    }
  }

  // Too close to breakeven OR no current price yet — fall back to the
  // structural calculator. May still return null for cross pairs; callers
  // must respect null and not invent a number.
  return calculatePipValueUsd({
    instrument: trade.instrument,
    units: trade.currentUnits,
    currentPrice: trade.currentPrice,
  })
}
