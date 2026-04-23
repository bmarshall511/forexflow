import { db } from "./client"
import type {
  PlacementSource,
  SourcePriorityConfigData,
  SourcePriorityLogEntry,
  SourcePriorityAction,
  TradingMode,
} from "@fxflow/types"

// ─── Config ────────────────────────────────────────────────────────────────

const DEFAULT_PRIORITY_ORDER: PlacementSource[] = [
  "trade_finder",
  "tv_alerts",
  "ai_trader",
  "smart_flow",
]

function parseOrder(json: string): PlacementSource[] {
  try {
    const parsed = JSON.parse(json) as PlacementSource[]
    if (Array.isArray(parsed) && parsed.length > 0) return parsed
  } catch {
    /* ignore */
  }
  return DEFAULT_PRIORITY_ORDER
}

export async function getSourcePriorityConfig(): Promise<SourcePriorityConfigData> {
  const client = db
  const row = await client.sourcePriorityConfig.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  })
  return {
    enabled: row.enabled,
    mode: row.mode as SourcePriorityConfigData["mode"],
    priorityOrder: parseOrder(row.priorityOrder),
    autoSelectWindowDays: row.autoSelectWindowDays,
    autoSelectRecalcMinutes: row.autoSelectRecalcMinutes,
  }
}

export async function updateSourcePriorityConfig(
  fields: Partial<{
    enabled: boolean
    mode: string
    priorityOrder: PlacementSource[]
    autoSelectWindowDays: number
    autoSelectRecalcMinutes: number
  }>,
): Promise<SourcePriorityConfigData> {
  const client = db
  const data: Record<string, unknown> = {}
  if (fields.enabled !== undefined) data.enabled = fields.enabled
  if (fields.mode !== undefined) data.mode = fields.mode
  if (fields.priorityOrder !== undefined) data.priorityOrder = JSON.stringify(fields.priorityOrder)
  if (fields.autoSelectWindowDays !== undefined)
    data.autoSelectWindowDays = fields.autoSelectWindowDays
  if (fields.autoSelectRecalcMinutes !== undefined)
    data.autoSelectRecalcMinutes = fields.autoSelectRecalcMinutes

  const row = await client.sourcePriorityConfig.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: data,
  })
  return {
    enabled: row.enabled,
    mode: row.mode as SourcePriorityConfigData["mode"],
    priorityOrder: parseOrder(row.priorityOrder),
    autoSelectWindowDays: row.autoSelectWindowDays,
    autoSelectRecalcMinutes: row.autoSelectRecalcMinutes,
  }
}

// ─── Priority Log ──────────────────────────────────────────────────────────

export interface CreatePriorityLogInput {
  /** OANDA account the placement attempt was for. */
  account?: TradingMode
  instrument: string
  requestingSource: string
  existingSource?: string | null
  existingTradeId?: string | null
  action: SourcePriorityAction
  reason: string
}

export async function createPriorityLog(input: CreatePriorityLogInput): Promise<void> {
  const client = db
  await client.sourcePriorityLog.create({
    data: {
      ...(input.account ? { account: input.account } : {}),
      instrument: input.instrument,
      requestingSource: input.requestingSource,
      existingSource: input.existingSource ?? null,
      existingTradeId: input.existingTradeId ?? null,
      action: input.action,
      reason: input.reason,
    },
  })
}

export async function listPriorityLogs(options?: {
  limit?: number
  instrument?: string
  source?: string
  account?: TradingMode
}): Promise<SourcePriorityLogEntry[]> {
  const client = db
  const where: Record<string, unknown> = {}
  if (options?.instrument) where.instrument = options.instrument
  if (options?.source) where.requestingSource = options.source
  if (options?.account) where.account = options.account

  const rows = await client.sourcePriorityLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: options?.limit ?? 50,
  })
  return rows.map(
    (r: {
      id: string
      instrument: string
      requestingSource: string
      existingSource: string | null
      existingTradeId: string | null
      action: string
      reason: string
      createdAt: Date
    }): SourcePriorityLogEntry => ({
      id: r.id,
      instrument: r.instrument,
      requestingSource: r.requestingSource,
      existingSource: r.existingSource,
      existingTradeId: r.existingTradeId,
      action: r.action as SourcePriorityAction,
      reason: r.reason,
      createdAt: r.createdAt.toISOString(),
    }),
  )
}

export async function cleanupOldPriorityLogs(daysToKeep = 30): Promise<number> {
  const client = db
  const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000)
  const result = await client.sourcePriorityLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  })
  return result.count
}

// ─── Win Rate by Source (for auto-select) ──────────────────────────────────

export async function getWinRateBySource(
  windowDays: number,
  account?: TradingMode,
): Promise<Map<PlacementSource, { wins: number; total: number; winRate: number }>> {
  const client = db
  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)

  const where: Record<string, unknown> = {
    status: "closed",
    closedAt: { gte: cutoff },
    realizedPL: { not: 0 },
  }
  if (account) where.account = account

  const trades = await client.trade.findMany({
    where,
    select: { metadata: true, realizedPL: true },
  })

  const stats = new Map<PlacementSource, { wins: number; total: number; winRate: number }>()

  for (const t of trades) {
    let source: PlacementSource | null = null
    if (t.metadata) {
      try {
        const meta = JSON.parse(t.metadata) as Record<string, unknown>
        const pv = meta.placedVia as string | undefined
        if (
          pv === "trade_finder" ||
          pv === "trade_finder_auto" ||
          pv === "ut_bot_alerts" ||
          pv === "ai_trader" ||
          pv === "ai_trader_manual" ||
          pv === "smart_flow"
        ) {
          // Normalize to the 4 canonical sources
          if (pv === "trade_finder" || pv === "trade_finder_auto") source = "trade_finder"
          else if (pv === "ut_bot_alerts") source = "tv_alerts"
          else if (pv === "ai_trader" || pv === "ai_trader_manual") source = "ai_trader"
          else if (pv === "smart_flow") source = "smart_flow"
        }
      } catch {
        /* ignore */
      }
    }
    if (!source) continue

    const entry = stats.get(source) ?? { wins: 0, total: 0, winRate: 0 }
    entry.total++
    if (t.realizedPL > 0) entry.wins++
    entry.winRate = entry.total > 0 ? entry.wins / entry.total : 0
    stats.set(source, entry)
  }

  return stats
}
