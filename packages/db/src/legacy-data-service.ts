/**
 * Legacy data service — counts and clears rows that predate the Phase -1
 * account-isolation migration.
 *
 * The migration added `account` to 14 trade-derived tables with a default of
 * `"unknown"` for existing rows, because OANDA `sourceTradeId` values are
 * numeric and per-account — there's no way to infer origin without probing
 * OANDA's API against both accounts. From the migration forward the daemon
 * writes only `"practice"` or `"live"`.
 *
 * This service lets the user inspect what's still unattributed and wipe it
 * cleanly so analytics start from a verified baseline.
 *
 * @module legacy-data-service
 */
import { db } from "./client"

export interface LegacyDataCounts {
  /** Total rows across all tables with account = "unknown". */
  total: number
  /** Per-table breakdown — only tables with at least one unknown row are listed. */
  byTable: Record<string, number>
}

export interface ClearLegacyDataResult {
  /** Total rows deleted across all tables. */
  total: number
  /** Per-table deletion count. */
  byTable: Record<string, number>
}

/** Every table that carries an `account` column and therefore can hold legacy rows. */
const LEGACY_TABLES = [
  "Trade",
  "TVAlertSignal",
  "TradeFinderSetup",
  "TradeFinderPerformance",
  "AiTraderOpportunity",
  "AiTraderNearMiss",
  "AiTraderReflection",
  "AiTraderStrategyPerformance",
  "SmartFlowConfig",
  "SmartFlowTrade",
  "SmartFlowOpportunity",
  "SmartFlowActivityLog",
  "PriceAlert",
  "SourcePriorityLog",
] as const

/**
 * Count rows where `account = "unknown"` across every trade-derived table.
 * Fast — each query is a single SELECT COUNT(*) WHERE account = "unknown".
 */
export async function getLegacyDataCounts(): Promise<LegacyDataCounts> {
  const byTable: Record<string, number> = {}
  for (const table of LEGACY_TABLES) {
    // Use raw SQL since the tables don't share a common Prisma accessor — and
    // this keeps the service column-agnostic if the schema drifts.
    const rows = await db.$queryRawUnsafe<Array<{ n: number }>>(
      `SELECT COUNT(*) AS n FROM "${table}" WHERE account = 'unknown'`,
    )
    const n = rows[0]?.n ?? 0
    if (n > 0) byTable[table] = Number(n)
  }
  const total = Object.values(byTable).reduce((s, n) => s + n, 0)
  return { total, byTable }
}

/**
 * Delete every row with `account = "unknown"` across every trade-derived
 * table. Cascading foreign keys clean up dependent rows (TradeEvent,
 * AiAnalysis, TradeCondition, AiImmediateActionLog,
 * AiRecommendationOutcome, SignalAuditEvent).
 *
 * Runs inside a single transaction so a mid-delete failure leaves the DB
 * consistent — either everything is wiped or nothing is.
 */
export async function clearLegacyData(): Promise<ClearLegacyDataResult> {
  const byTable: Record<string, number> = {}
  await db.$transaction(async (tx) => {
    for (const table of LEGACY_TABLES) {
      const result = await tx.$executeRawUnsafe(`DELETE FROM "${table}" WHERE account = 'unknown'`)
      if (result > 0) byTable[table] = result
    }
  })
  const total = Object.values(byTable).reduce((s, n) => s + n, 0)
  return { total, byTable }
}
