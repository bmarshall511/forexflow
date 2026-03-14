/**
 * App Reset service — selective module reset, trading data reset, factory reset,
 * and fresh install (delete DB file).
 *
 * @module reset-service
 */
import { unlink } from "node:fs/promises"
import { db } from "./client"

/** Module identifiers for selective reset. */
export type ResetModule =
  | "trading_history"
  | "tv_alerts"
  | "ai_analysis"
  | "ai_trader"
  | "trade_finder"
  | "technical_data"
  | "notifications"
  | "chart_state"

export interface PreflightStatus {
  openTrades: number
  pendingOrders: number
  runningAnalyses: number
  activeConditions: number
  moduleCounts: Record<ResetModule, number>
}

export interface ResetResult {
  success: boolean
  modulesReset: ResetModule[]
  recordsDeleted: number
  errors: string[]
}

const ALL_DATA_MODULES: ResetModule[] = [
  "trading_history",
  "tv_alerts",
  "ai_analysis",
  "ai_trader",
  "trade_finder",
  "technical_data",
  "notifications",
  "chart_state",
]

// ─── Module count helpers ───────────────────────────────────────────────────

async function countTradingHistory(): Promise<number> {
  const [trades, events, tags, tradeTags] = await Promise.all([
    db.trade.count(),
    db.tradeEvent.count(),
    db.tag.count(),
    db.tradeTag.count(),
  ])
  return trades + events + tags + tradeTags
}

async function countTvAlerts(): Promise<number> {
  const [signals, audits] = await Promise.all([
    db.tVAlertSignal.count(),
    db.signalAuditEvent.count(),
  ])
  return signals + audits
}

async function countAiAnalysis(): Promise<number> {
  const [analyses, conditions, outcomes, digests] = await Promise.all([
    db.aiAnalysis.count(),
    db.tradeCondition.count(),
    db.aiRecommendationOutcome.count(),
    db.aiDigest.count(),
  ])
  return analyses + conditions + outcomes + digests
}

async function countAiTrader(): Promise<number> {
  const [opps, market, perf] = await Promise.all([
    db.aiTraderOpportunity.count(),
    db.aiTraderMarketData.count(),
    db.aiTraderStrategyPerformance.count(),
  ])
  return opps + market + perf
}

async function countTradeFinderModule(): Promise<number> {
  return db.tradeFinderSetup.count()
}

async function countTechnicalData(): Promise<number> {
  const [zones, trends, curves] = await Promise.all([
    db.supplyDemandZone.count(),
    db.detectedTrend.count(),
    db.curveSnapshot.count(),
  ])
  return zones + trends + curves
}

const MODULE_COUNTERS: Record<ResetModule, () => Promise<number>> = {
  trading_history: countTradingHistory,
  tv_alerts: countTvAlerts,
  ai_analysis: countAiAnalysis,
  ai_trader: countAiTrader,
  trade_finder: countTradeFinderModule,
  technical_data: countTechnicalData,
  notifications: () => db.notification.count(),
  chart_state: () => db.chartLayout.count(),
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Get record counts per module for summary display. */
export async function getModuleDataCounts(): Promise<Record<ResetModule, number>> {
  const entries = await Promise.all(
    ALL_DATA_MODULES.map(async (mod) => [mod, await MODULE_COUNTERS[mod]()] as const),
  )
  return Object.fromEntries(entries) as Record<ResetModule, number>
}

/** Get counts for pre-flight checks (open trades, running analyses, etc). */
export async function getResetPreflightStatus(): Promise<PreflightStatus> {
  const [openTrades, pendingOrders, runningAnalyses, activeConditions, moduleCounts] =
    await Promise.all([
      db.trade.count({ where: { status: "open" } }),
      db.trade.count({ where: { status: "pending" } }),
      db.aiAnalysis.count({ where: { status: { in: ["pending", "running"] } } }),
      db.tradeCondition.count({ where: { status: "active" } }),
      getModuleDataCounts(),
    ])
  return { openTrades, pendingOrders, runningAnalyses, activeConditions, moduleCounts }
}

/** Reset a single module. Deletes children before parents for FK safety. */
export async function resetModule(module: ResetModule): Promise<{ deleted: number }> {
  let deleted = 0

  switch (module) {
    case "trading_history": {
      // Children first: TradeTag, TradeEvent, then AiAnalysis (cascades TradeCondition),
      // AiRecommendationOutcome, then Trade, then Tag
      const results = await db.$transaction([
        db.tradeTag.deleteMany(),
        db.tradeEvent.deleteMany(),
        db.tradeCondition.deleteMany(),
        db.aiRecommendationOutcome.deleteMany(),
        db.aiAnalysis.deleteMany(),
        db.trade.deleteMany(),
        db.tag.deleteMany(),
      ])
      deleted = results.reduce((sum, r) => sum + r.count, 0)
      break
    }
    case "tv_alerts": {
      const results = await db.$transaction([
        db.signalAuditEvent.deleteMany(),
        db.tVAlertSignal.deleteMany(),
      ])
      deleted = results.reduce((sum, r) => sum + r.count, 0)
      break
    }
    case "ai_analysis": {
      const results = await db.$transaction([
        db.tradeCondition.deleteMany(),
        db.aiRecommendationOutcome.deleteMany(),
        db.aiAnalysis.deleteMany(),
        db.aiDigest.deleteMany(),
      ])
      deleted = results.reduce((sum, r) => sum + r.count, 0)
      break
    }
    case "ai_trader": {
      const results = await db.$transaction([
        db.aiTraderOpportunity.deleteMany(),
        db.aiTraderMarketData.deleteMany(),
        db.aiTraderStrategyPerformance.deleteMany(),
      ])
      deleted = results.reduce((sum, r) => sum + r.count, 0)
      break
    }
    case "trade_finder": {
      const result = await db.tradeFinderSetup.deleteMany()
      deleted = result.count
      break
    }
    case "technical_data": {
      const results = await db.$transaction([
        db.supplyDemandZone.deleteMany(),
        db.detectedTrend.deleteMany(),
        db.curveSnapshot.deleteMany(),
      ])
      deleted = results.reduce((sum, r) => sum + r.count, 0)
      break
    }
    case "notifications": {
      const result = await db.notification.deleteMany()
      deleted = result.count
      break
    }
    case "chart_state": {
      const result = await db.chartLayout.deleteMany()
      deleted = result.count
      break
    }
  }

  return { deleted }
}

/** Reset all trading data. Preserves config and credential tables. */
export async function resetTradingData(): Promise<ResetResult> {
  const errors: string[] = []
  const modulesReset: ResetModule[] = []
  let recordsDeleted = 0

  for (const mod of ALL_DATA_MODULES) {
    try {
      const { deleted } = await resetModule(mod)
      modulesReset.push(mod)
      recordsDeleted += deleted
    } catch (err) {
      errors.push(`${mod}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { success: errors.length === 0, modulesReset, recordsDeleted, errors }
}

/** Factory reset: all data + all config/settings tables. */
export async function resetFactory(): Promise<ResetResult> {
  const dataResult = await resetTradingData()

  const configErrors: string[] = []
  let configDeleted = 0

  const configDeletes = [
    { name: "Settings", fn: () => db.settings.deleteMany() },
    { name: "TVAlertsConfig", fn: () => db.tVAlertsConfig.deleteMany() },
    { name: "AiSettings", fn: () => db.aiSettings.deleteMany() },
    { name: "TradeFinderConfig", fn: () => db.tradeFinderConfig.deleteMany() },
    { name: "AiTraderConfig", fn: () => db.aiTraderConfig.deleteMany() },
    { name: "ZoneSettings", fn: () => db.zoneSettings.deleteMany() },
    { name: "TrendSettings", fn: () => db.trendSettings.deleteMany() },
  ]

  for (const { name, fn } of configDeletes) {
    try {
      const result = await fn()
      configDeleted += result.count
    } catch (err) {
      configErrors.push(`${name}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return {
    success: dataResult.errors.length === 0 && configErrors.length === 0,
    modulesReset: dataResult.modulesReset,
    recordsDeleted: dataResult.recordsDeleted + configDeleted,
    errors: [...dataResult.errors, ...configErrors],
  }
}

/** Get the SQLite database file path from DATABASE_URL. */
export function getDatabasePath(): string {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL environment variable is required")
  // DATABASE_URL is "file:./path/to/db" or "file:/absolute/path"
  return url.replace(/^file:/, "")
}

/** Delete the database file (for fresh install). Disconnects Prisma first.
 *  Returns true if deleted, false if file not found. */
export async function deleteDatabaseFile(): Promise<boolean> {
  const dbPath = getDatabasePath()

  await db.$disconnect()

  try {
    await unlink(dbPath)
    // Also remove WAL and SHM files if they exist
    await unlink(`${dbPath}-wal`).catch(() => {})
    await unlink(`${dbPath}-shm`).catch(() => {})
    return true
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "ENOENT") {
      return false
    }
    throw err
  }
}
