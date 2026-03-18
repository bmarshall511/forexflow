/**
 * Trade Finder Adaptive Tuner — auto-adjusts thresholds based on rolling performance.
 *
 * Runs after each trade close. Analyzes 30-day performance and generates
 * recommendations to improve win rate. Can auto-apply if enabled.
 */

import {
  getTradeFinderPerformance,
  getTradeFinderConfig,
  updateTradeFinderConfig,
} from "@fxflow/db"

export interface AdaptiveRecommendation {
  type: "raise_min_score" | "lower_min_score" | "disable_instrument" | "disable_timeframe"
  message: string
  currentValue?: number
  suggestedValue?: number
  key?: string // instrument or timeframe
}

/**
 * Evaluate performance and generate recommendations.
 * Called after each Trade Finder trade closes.
 */
export async function evaluateAndTune(): Promise<AdaptiveRecommendation[]> {
  const config = await getTradeFinderConfig()
  const recommendations: AdaptiveRecommendation[] = []

  // Get 30-day overall stats
  const overallStats = await getTradeFinderPerformance({ dimension: "overall", daysBack: 30 })
  const totalTrades = overallStats.reduce((s, r) => s + r.wins + r.losses + r.breakevens, 0)
  if (totalTrades < 5) return [] // Not enough data

  const totalWins = overallStats.reduce((s, r) => s + r.wins, 0)
  const winRate = (totalWins / totalTrades) * 100

  // 1. Overall win rate check
  if (winRate < 40 && config.autoTradeMinScore < 16) {
    const suggested = Math.min(16, config.autoTradeMinScore + 1)
    recommendations.push({
      type: "raise_min_score",
      message: `Win rate ${winRate.toFixed(0)}% is below 40% — raise auto-trade min score to ${suggested}`,
      currentValue: config.autoTradeMinScore,
      suggestedValue: suggested,
    })
  } else if (winRate > 65 && config.autoTradeMinScore > 7) {
    const suggested = Math.max(7, config.autoTradeMinScore - 0.5)
    recommendations.push({
      type: "lower_min_score",
      message: `Win rate ${winRate.toFixed(0)}% is above 65% — can lower auto-trade min score to ${suggested}`,
      currentValue: config.autoTradeMinScore,
      suggestedValue: suggested,
    })
  }

  // 2. Per-instrument check
  const instrumentStats = await getTradeFinderPerformance({ dimension: "instrument", daysBack: 30 })
  for (const stat of instrumentStats) {
    if (!stat.dimensionKey) continue
    const total = stat.wins + stat.losses + stat.breakevens
    if (total < 3) continue
    const instrWinRate = (stat.wins / total) * 100
    if (instrWinRate < 30) {
      recommendations.push({
        type: "disable_instrument",
        message: `${stat.dimensionKey.replace("_", "/")} win rate ${instrWinRate.toFixed(0)}% — consider disabling`,
        key: stat.dimensionKey,
      })
    }
  }

  // 3. Per-timeframe check
  const tfStats = await getTradeFinderPerformance({ dimension: "timeframe", daysBack: 30 })
  for (const stat of tfStats) {
    if (!stat.dimensionKey) continue
    const total = stat.wins + stat.losses + stat.breakevens
    if (total < 3) continue
    const tfWinRate = (stat.wins / total) * 100
    if (tfWinRate < 30) {
      recommendations.push({
        type: "disable_timeframe",
        message: `${stat.dimensionKey} timeframe win rate ${tfWinRate.toFixed(0)}% — consider switching`,
        key: stat.dimensionKey,
      })
    }
  }

  // Log recommendations
  if (recommendations.length > 0) {
    console.log(`[trade-finder-adaptive] ${recommendations.length} recommendation(s):`)
    for (const r of recommendations) {
      console.log(`  → ${r.message}`)
    }

    // Auto-apply score adjustments if win rate is critically low
    if (winRate < 35 && recommendations.some((r) => r.type === "raise_min_score")) {
      const scoreRec = recommendations.find((r) => r.type === "raise_min_score")
      if (scoreRec?.suggestedValue) {
        await updateTradeFinderConfig({ autoTradeMinScore: scoreRec.suggestedValue })
        console.log(
          `[trade-finder-adaptive] AUTO-APPLIED: raised autoTradeMinScore to ${scoreRec.suggestedValue}`,
        )
      }
    }
  }

  return recommendations
}
