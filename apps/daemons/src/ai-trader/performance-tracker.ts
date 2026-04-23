import type {
  AiTraderProfile,
  AiTraderSession,
  AiTraderTechnique,
  AiTraderStrategyPerformanceData,
  TradingMode,
} from "@fxflow/types"
import {
  recalculatePerformance,
  getPerformanceStats,
  cleanupOldPerformance,
  type TradeStatsInput,
} from "@fxflow/db"

/**
 * PerformanceTracker records and queries AI Trader trade outcomes,
 * sliced by profile, instrument, session, and technique.
 * Used to build "historical" score for the AI's decision-making.
 */
export class PerformanceTracker {
  /**
   * Record a closed AI trade outcome into the performance table.
   * Updates 4 dimension combos: overall, per-instrument, per-session, per-technique.
   */
  async recordOutcome(params: {
    account: TradingMode
    profile: AiTraderProfile
    instrument: string
    session: AiTraderSession | null
    technique: AiTraderTechnique | null
    realizedPL: number
    riskRewardRatio: number
    outcome: "win" | "loss" | "breakeven" | "cancelled"
  }): Promise<void> {
    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1) // Month start
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0) // Month end

    const trade: TradeStatsInput = {
      realizedPL: params.realizedPL,
      riskRewardRatio: params.riskRewardRatio,
      outcome: params.outcome,
    }

    // Recalculate 4 dimensions in parallel
    await Promise.all([
      // Overall for profile
      this.updateDimension(
        params.account,
        params.profile,
        null,
        null,
        null,
        periodStart,
        periodEnd,
        trade,
      ),
      // Per instrument
      this.updateDimension(
        params.account,
        params.profile,
        params.instrument,
        null,
        null,
        periodStart,
        periodEnd,
        trade,
      ),
      // Per session
      params.session
        ? this.updateDimension(
            params.account,
            params.profile,
            null,
            params.session,
            null,
            periodStart,
            periodEnd,
            trade,
          )
        : Promise.resolve(),
      // Per technique
      params.technique
        ? this.updateDimension(
            params.account,
            params.profile,
            null,
            null,
            params.technique,
            periodStart,
            periodEnd,
            trade,
          )
        : Promise.resolve(),
    ])
  }

  private async updateDimension(
    account: TradingMode,
    profile: AiTraderProfile,
    instrument: string | null,
    session: string | null,
    technique: string | null,
    periodStart: Date,
    periodEnd: Date,
    newTrade: TradeStatsInput,
  ): Promise<void> {
    // Get existing stats for this period (scoped to the same account so
    // practice and live aggregates don't commingle) and add the new trade.
    const existing = await getPerformanceStats({
      profile,
      instrument: instrument ?? undefined,
      session: session ?? undefined,
      account,
      daysBack: 31, // Current month
    })

    // Find matching period entry or start fresh
    const matchingPeriod = existing.find(
      (e) =>
        e.instrument === instrument &&
        e.session === (session as AiTraderSession | null) &&
        e.technique === (technique as AiTraderTechnique | null),
    )

    // Build trade list: existing stats as synthetic trades + new trade
    const trades: TradeStatsInput[] = []

    if (matchingPeriod) {
      // Reconstruct from aggregate stats
      for (let i = 0; i < matchingPeriod.wins; i++) {
        trades.push({
          realizedPL: matchingPeriod.totalPL > 0 ? matchingPeriod.totalPL / matchingPeriod.wins : 1,
          riskRewardRatio: matchingPeriod.avgRR,
          outcome: "win",
        })
      }
      for (let i = 0; i < matchingPeriod.losses; i++) {
        trades.push({
          realizedPL:
            matchingPeriod.totalPL < 0 ? matchingPeriod.totalPL / matchingPeriod.losses : -1,
          riskRewardRatio: matchingPeriod.avgRR * 0.5,
          outcome: "loss",
        })
      }
      for (let i = 0; i < matchingPeriod.breakevens; i++) {
        trades.push({ realizedPL: 0, riskRewardRatio: 0, outcome: "breakeven" })
      }
    }

    trades.push(newTrade)

    await recalculatePerformance(
      profile,
      instrument,
      session,
      technique,
      periodStart,
      periodEnd,
      trades,
      account,
    )
  }

  /**
   * Get historical performance for a specific setup type.
   * Used by the AI to factor in past success rates.
   */
  async getHistoricalStats(
    profile: AiTraderProfile,
    instrument?: string,
    session?: string,
  ): Promise<AiTraderStrategyPerformanceData[]> {
    return getPerformanceStats({ profile, instrument, session, daysBack: 90 })
  }

  /**
   * Cleanup old performance records beyond retention period.
   */
  async cleanup(): Promise<number> {
    return cleanupOldPerformance(180)
  }
}
