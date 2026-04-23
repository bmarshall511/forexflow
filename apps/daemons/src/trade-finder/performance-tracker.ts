/**
 * Trade Finder Performance Tracker — records outcomes when Trade Finder trades close.
 *
 * Wired to tradeSyncer.onTradeClosed in index.ts. When a trade with
 * placedVia: "trade_finder" or "trade_finder_auto" closes, this records
 * the outcome into TradeFinderPerformance across 4 dimensions.
 */

import { recordTradeFinderOutcome, findSetupByResultSourceId } from "@fxflow/db"
import { getPipSize } from "@fxflow/shared"
import type { TradingMode } from "@fxflow/types"

/**
 * Record a Trade Finder trade outcome when it closes.
 *
 * @param sourceTradeId - OANDA trade ID
 * @param realizedPL - The trade's realized P&L
 * @param exitPrice - Exit price (null for cancelled orders)
 * @param account - Active OANDA account the closing trade was on
 */
export async function recordTradeFinderClose(
  sourceTradeId: string,
  realizedPL: number,
  exitPrice: number | null,
  account: TradingMode,
): Promise<void> {
  // Find the setup that generated this trade
  const setup = await findSetupByResultSourceId(sourceTradeId)
  if (!setup) return // Not a Trade Finder trade

  const outcome =
    realizedPL > 0 ? "win" : realizedPL < 0 ? "loss" : exitPrice === null ? "win" : "breakeven"
  if (outcome !== "win" && outcome !== "loss" && outcome !== "breakeven") return

  const pipSize = getPipSize(setup.instrument)
  const expectedRR = parseFloat(setup.rrRatio) || 0 // e.g. "2.5:1" → 2.5

  // Calculate actual R:R achieved
  let actualRR = 0
  if (exitPrice !== null && setup.riskPips > 0) {
    const actualPips =
      setup.direction === "long"
        ? (exitPrice - setup.entryPrice) / pipSize
        : (setup.entryPrice - exitPrice) / pipSize
    actualRR = actualPips / setup.riskPips
  }

  await recordTradeFinderOutcome({
    account,
    timeframeSet: setup.timeframeSet,
    instrument: setup.instrument,
    scoreTotal: setup.scores.total,
    maxPossible: setup.scores.maxPossible,
    expectedRR,
    actualRR,
    realizedPL,
    outcome,
    session: setup.detectionSession ?? null,
  })

  console.log(
    `[trade-finder-perf] Recorded: ${setup.instrument} ${outcome} $${realizedPL.toFixed(2)} (expected ${expectedRR.toFixed(1)}:1, actual ${actualRR.toFixed(1)}:1)`,
  )
}
