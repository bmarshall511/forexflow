/**
 * AI Analysis service — manages Claude-powered trade analysis records.
 *
 * Handles creation, result persistence, cost calculation, usage statistics,
 * pagination, and cleanup of AI analysis records. Supports both user-triggered
 * and automated analyses with per-model cost tracking.
 *
 * @module ai-analysis-service
 */
import { db } from "./client"
import { safeJsonParse } from "./utils"
import type {
  AiAnalysisData,
  AiAnalysisStatus,
  AiAnalysisDepth,
  AiAnalysisTriggeredBy,
  AiAnalysisSections,
  AiClaudeModel,
  AiUsageStats,
} from "@fxflow/types"
import { AI_MODEL_OPTIONS } from "@fxflow/types"

// ─── Cost (derived from canonical AI_MODEL_OPTIONS in @fxflow/types) ─────────

/**
 * Calculate the USD cost for an AI analysis based on token usage and model pricing.
 * Falls back to Sonnet pricing if the model is not found in `AI_MODEL_OPTIONS`.
 *
 * @param model - The Claude model ID used for the analysis
 * @param inputTokens - Number of input tokens consumed
 * @param outputTokens - Number of output tokens generated
 * @returns The estimated cost in USD
 */
export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const option =
    AI_MODEL_OPTIONS.find((o) => o.id === model) ??
    AI_MODEL_OPTIONS.find((o) => o.id === "claude-sonnet-4-6")!
  return (
    (inputTokens / 1_000_000) * option.inputCostPer1M +
    (outputTokens / 1_000_000) * option.outputCostPer1M
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Map a Prisma analysis row to the `AiAnalysisData` DTO, deserializing
 * the sections JSON field.
 *
 * @param row - Raw analysis row from Prisma
 * @returns Serialized analysis data for the API/UI
 */
function toAnalysisData(row: {
  id: string
  tradeId: string
  status: string
  depth: string
  model: string
  tradeStatus: string
  triggeredBy: string
  sections: string | null
  inputTokens: number
  outputTokens: number
  costUsd: number
  durationMs: number
  errorMessage: string | null
  createdAt: Date
  updatedAt: Date
}): AiAnalysisData {
  return {
    id: row.id,
    tradeId: row.tradeId,
    status: row.status as AiAnalysisStatus,
    depth: row.depth as AiAnalysisDepth,
    model: row.model as AiClaudeModel,
    tradeStatus: row.tradeStatus,
    triggeredBy: row.triggeredBy as AiAnalysisTriggeredBy,
    sections: safeJsonParse<AiAnalysisSections | null>(
      row.sections,
      null,
      `analysis ${row.id} sections`,
    ),
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    costUsd: row.costUsd,
    durationMs: row.durationMs,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Create a new AI analysis record in "pending" status.
 *
 * @param input - Analysis creation parameters including trade ID, depth, and model
 * @returns The created analysis data
 */
export async function createAnalysis(input: {
  tradeId: string
  depth: AiAnalysisDepth
  model: AiClaudeModel
  tradeStatus: string
  triggeredBy?: AiAnalysisTriggeredBy
  contextSnapshot?: Record<string, unknown>
}): Promise<AiAnalysisData> {
  const row = await db.aiAnalysis.create({
    data: {
      tradeId: input.tradeId,
      status: "pending",
      depth: input.depth,
      model: input.model,
      tradeStatus: input.tradeStatus,
      triggeredBy: input.triggeredBy ?? "user",
      contextSnapshot: JSON.stringify(input.contextSnapshot ?? {}),
    },
  })
  return toAnalysisData(row)
}

/**
 * Update an analysis record's status, optionally recording an error message.
 *
 * @param id - Analysis ID
 * @param status - New status to set
 * @param errorMessage - Optional error message for failed analyses
 * @param rawResponse - Optional raw response to persist (e.g., on parse failure)
 */
export async function updateAnalysisStatus(
  id: string,
  status: AiAnalysisStatus,
  errorMessage?: string,
  rawResponse?: string,
): Promise<void> {
  await db.aiAnalysis.update({
    where: { id },
    data: {
      status,
      ...(errorMessage ? { errorMessage } : {}),
      ...(rawResponse ? { rawResponse } : {}),
    },
  })
}

/**
 * Fetch only the raw response text for a given analysis.
 * Loaded on-demand since responses can be large.
 */
export async function getAnalysisRawResponse(analysisId: string): Promise<string | null> {
  const row = await db.aiAnalysis.findUnique({
    where: { id: analysisId },
    select: { rawResponse: true },
  })
  return row?.rawResponse ?? null
}

/**
 * Persist a completed analysis result with token usage, parsed sections,
 * and computed cost. Marks the analysis as "completed".
 *
 * @param id - Analysis ID
 * @param result - The analysis result including raw response, sections, and token counts
 * @returns The updated analysis data
 */
export async function saveAnalysisResult(
  id: string,
  result: {
    rawResponse: string
    sections: AiAnalysisSections | null
    inputTokens: number
    outputTokens: number
    durationMs: number
  },
): Promise<AiAnalysisData> {
  const costUsd = calculateCost(
    (await db.aiAnalysis.findUniqueOrThrow({ where: { id }, select: { model: true } })).model,
    result.inputTokens,
    result.outputTokens,
  )

  const row = await db.aiAnalysis.update({
    where: { id },
    data: {
      status: "completed",
      rawResponse: result.rawResponse,
      sections: result.sections ? JSON.stringify(result.sections) : null,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd,
      durationMs: result.durationMs,
    },
  })
  return toAnalysisData(row)
}

/**
 * Retrieve a single analysis by ID.
 *
 * @param id - Analysis ID
 * @returns The analysis data, or null if not found
 */
export async function getAnalysis(id: string): Promise<AiAnalysisData | null> {
  const row = await db.aiAnalysis.findUnique({ where: { id } })
  if (!row) return null
  return toAnalysisData(row)
}

/**
 * Get the analysis history for a specific trade, ordered by most recent first.
 *
 * @param tradeId - Trade ID to get analyses for
 * @param limit - Maximum number of analyses to return (default: 20)
 * @returns Array of analysis data records
 */
export async function getAnalysisHistory(tradeId: string, limit = 20): Promise<AiAnalysisData[]> {
  const rows = await db.aiAnalysis.findMany({
    where: { tradeId },
    orderBy: { createdAt: "desc" },
    take: limit,
  })
  return rows.map(toAnalysisData)
}

/**
 * Get the most recent completed analysis for a trade.
 *
 * @param tradeId - Trade ID to find the latest completed analysis for
 * @returns The latest completed analysis, or null if none exist
 */
export async function getLatestCompletedAnalysis(tradeId: string): Promise<AiAnalysisData | null> {
  const row = await db.aiAnalysis.findFirst({
    where: { tradeId, status: "completed" },
    orderBy: { createdAt: "desc" },
  })
  if (!row) return null
  return toAnalysisData(row)
}

/**
 * Mark an analysis as cancelled.
 *
 * @param id - Analysis ID to cancel
 */
export async function cancelAnalysis(id: string): Promise<void> {
  await db.aiAnalysis.update({
    where: { id },
    data: { status: "cancelled" },
  })
}

/**
 * Find a recent active analysis for a trade within a time window.
 * Used to prevent duplicate analyses from being created in quick succession.
 *
 * @param tradeId - Trade ID to check
 * @param withinMinutes - Time window in minutes (default: 30)
 * @returns The most recent active analysis, or null if none in window
 */
export async function getRecentAnalysisForTrade(
  tradeId: string,
  withinMinutes = 30,
): Promise<AiAnalysisData | null> {
  const cutoff = new Date(Date.now() - withinMinutes * 60 * 1000)
  const row = await db.aiAnalysis.findFirst({
    where: {
      tradeId,
      createdAt: { gte: cutoff },
      status: { in: ["pending", "running", "completed"] },
    },
    orderBy: { createdAt: "desc" },
  })
  if (!row) return null
  return toAnalysisData(row)
}

/**
 * Compute comprehensive AI usage statistics including token counts, costs,
 * period breakdowns, model breakdowns, and average quality metrics.
 * Uses parallel aggregation queries for performance.
 *
 * @returns Aggregated usage stats across all completed analyses
 */
export async function getUsageStats(): Promise<AiUsageStats> {
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - 7)
  const monthStart = new Date(now)
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const yearStart = new Date(now)
  yearStart.setMonth(0, 1)
  yearStart.setHours(0, 0, 0, 0)

  const AUTO_TRIGGERS = ["auto_pending", "auto_fill", "auto_close", "auto_interval"]

  // Run all aggregation queries in parallel instead of loading all rows
  const [
    totals,
    statusRows,
    byModelRows,
    todayAgg,
    weekAgg,
    monthAgg,
    yearAgg,
    autoAgg,
    recentSections,
  ] = await Promise.all([
    // Total aggregates for completed analyses
    db.aiAnalysis.aggregate({
      where: { status: "completed" },
      _sum: { inputTokens: true, outputTokens: true, costUsd: true },
      _count: { _all: true },
    }),
    // Status counts
    db.aiAnalysis.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    // By model breakdown
    db.aiAnalysis.groupBy({
      by: ["model"],
      where: { status: "completed" },
      _sum: { inputTokens: true, outputTokens: true, costUsd: true },
      _count: { _all: true },
    }),
    // Period aggregates
    db.aiAnalysis.aggregate({
      where: { status: "completed", createdAt: { gte: todayStart } },
      _count: { _all: true },
      _sum: { costUsd: true },
    }),
    db.aiAnalysis.aggregate({
      where: { status: "completed", createdAt: { gte: weekStart } },
      _count: { _all: true },
      _sum: { costUsd: true },
    }),
    db.aiAnalysis.aggregate({
      where: { status: "completed", createdAt: { gte: monthStart } },
      _count: { _all: true },
      _sum: { costUsd: true },
    }),
    db.aiAnalysis.aggregate({
      where: { status: "completed", createdAt: { gte: yearStart } },
      _count: { _all: true },
      _sum: { costUsd: true },
    }),
    // Auto vs manual count
    db.aiAnalysis.count({
      where: { status: "completed", triggeredBy: { in: AUTO_TRIGGERS } },
    }),
    // Recent sections for avg win probability / quality score (limited to prevent memory issues)
    db.aiAnalysis.findMany({
      where: { status: "completed", sections: { not: null } },
      select: { sections: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ])

  // Parse win probability and quality score from recent completed analyses
  let winProbSum = 0
  let winProbCount = 0
  let qualitySum = 0
  let qualityCount = 0
  for (const row of recentSections) {
    if (!row.sections) continue
    const sections = safeJsonParse<AiAnalysisSections | null>(
      row.sections,
      null,
      "usage-stats sections",
    )
    if (sections?.winProbability != null) {
      winProbSum += sections.winProbability
      winProbCount++
    }
    if (sections?.tradeQualityScore != null) {
      qualitySum += sections.tradeQualityScore
      qualityCount++
    }
  }

  const totalCount = totals._count._all
  const statusMap = new Map(statusRows.map((r) => [r.status, r._count._all]))

  return {
    totalAnalyses: totalCount,
    totalInputTokens: totals._sum.inputTokens ?? 0,
    totalOutputTokens: totals._sum.outputTokens ?? 0,
    totalCostUsd: totals._sum.costUsd ?? 0,
    avgWinProbability: winProbCount > 0 ? Math.round(winProbSum / winProbCount) : null,
    avgQualityScore: qualityCount > 0 ? Math.round((qualitySum / qualityCount) * 10) / 10 : null,
    autoCount: autoAgg,
    manualCount: totalCount - autoAgg,
    byModel: byModelRows.map((r) => ({
      model: r.model,
      count: r._count._all,
      inputTokens: r._sum.inputTokens ?? 0,
      outputTokens: r._sum.outputTokens ?? 0,
      costUsd: r._sum.costUsd ?? 0,
    })),
    byPeriod: {
      today: { count: todayAgg._count._all, costUsd: todayAgg._sum.costUsd ?? 0 },
      thisWeek: { count: weekAgg._count._all, costUsd: weekAgg._sum.costUsd ?? 0 },
      thisMonth: { count: monthAgg._count._all, costUsd: monthAgg._sum.costUsd ?? 0 },
      thisYear: { count: yearAgg._count._all, costUsd: yearAgg._sum.costUsd ?? 0 },
      allTime: { count: totalCount, costUsd: totals._sum.costUsd ?? 0 },
    },
    statusCounts: {
      completed: statusMap.get("completed") ?? 0,
      failed: statusMap.get("failed") ?? 0,
      cancelled: statusMap.get("cancelled") ?? 0,
      running: statusMap.get("running") ?? 0,
      pending: statusMap.get("pending") ?? 0,
    },
  }
}

/**
 * Batch-fetch the latest non-cancelled analysis for multiple trades.
 * Used by trade tables to show analysis status indicators.
 *
 * @param tradeIds - Array of trade IDs to look up
 * @returns Map of trade ID to latest analysis data
 */
export async function getLatestAnalysisByTradeIds(
  tradeIds: string[],
): Promise<Record<string, AiAnalysisData>> {
  if (tradeIds.length === 0) return {}
  // Return the most recent non-cancelled analysis per trade so the UI
  // can show running/failed/completed states accurately.
  // "cancelled" analyses are invisible — we skip them so prior completed
  // analyses remain visible in the table cell.
  const rows = await db.aiAnalysis.findMany({
    where: { tradeId: { in: tradeIds }, status: { not: "cancelled" } },
    orderBy: { createdAt: "desc" },
  })
  const result: Record<string, AiAnalysisData> = {}
  for (const row of rows) {
    if (!result[row.tradeId]) result[row.tradeId] = toAnalysisData(row)
  }
  return result
}

/**
 * Batch-count completed analyses per trade for multiple trade IDs.
 *
 * @param tradeIds - Array of trade IDs to count analyses for
 * @returns Map of trade ID to completed analysis count
 */
export async function getAnalysisCountsByTradeIds(
  tradeIds: string[],
): Promise<Record<string, number>> {
  if (tradeIds.length === 0) return {}
  const groups = await db.aiAnalysis.groupBy({
    by: ["tradeId"],
    where: { tradeId: { in: tradeIds }, status: "completed" },
    _count: { id: true },
  })
  const result: Record<string, number> = {}
  for (const g of groups) {
    result[g.tradeId] = g._count.id
  }
  return result
}

/** Summary view of an analysis joined with its trade's instrument and direction. */
export interface RecentAnalysisSummary {
  id: string
  tradeId: string
  instrument: string
  direction: string
  entryPrice: number
  openedAt: string
  tradeNotes: string | null
  status: AiAnalysisStatus
  tradeStatus: string
  depth: AiAnalysisDepth
  model: AiClaudeModel
  triggeredBy: AiAnalysisTriggeredBy
  winProbability: number | null
  tradeQualityScore: number | null
  costUsd: number
  createdAt: string
}

/**
 * Get the most recent completed analyses joined with trade details.
 * Used by the AI insights dashboard card.
 *
 * @param limit - Maximum number of analyses to return (default: 3)
 * @returns Array of analysis summaries with trade context
 */
export async function getRecentAnalysesWithTrade(limit = 3): Promise<RecentAnalysisSummary[]> {
  const rows = await db.aiAnalysis.findMany({
    where: { status: "completed" },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      trade: {
        select: {
          instrument: true,
          direction: true,
          entryPrice: true,
          openedAt: true,
          notes: true,
        },
      },
    },
  })
  return rows.map((row) => toAnalysisSummary(row))
}

/**
 * Map a Prisma analysis row with included trade to a `RecentAnalysisSummary` DTO.
 *
 * @param row - Raw analysis row with trade include from Prisma
 * @returns Serialized analysis summary for the API/UI
 */
function toAnalysisSummary(row: {
  id: string
  tradeId: string
  status: string
  tradeStatus: string
  depth: string
  model: string
  triggeredBy: string
  sections: string | null
  costUsd: number
  createdAt: Date
  trade: {
    instrument: string
    direction: string
    entryPrice: number
    openedAt: Date
    notes: string | null
  }
}): RecentAnalysisSummary {
  const sections = safeJsonParse<AiAnalysisSections | null>(row.sections, null, `summary ${row.id}`)
  return {
    id: row.id,
    tradeId: row.tradeId,
    instrument: row.trade.instrument,
    direction: row.trade.direction,
    entryPrice: row.trade.entryPrice,
    openedAt: row.trade.openedAt.toISOString(),
    tradeNotes: row.trade.notes,
    status: row.status as AiAnalysisStatus,
    tradeStatus: row.tradeStatus,
    depth: row.depth as AiAnalysisDepth,
    model: row.model as AiClaudeModel,
    triggeredBy: row.triggeredBy as AiAnalysisTriggeredBy,
    winProbability: sections?.winProbability ?? null,
    tradeQualityScore: sections?.tradeQualityScore ?? null,
    costUsd: row.costUsd,
    createdAt: row.createdAt.toISOString(),
  }
}

const AUTO_TRIGGERED_VALUES = ["auto_pending", "auto_fill", "auto_close", "auto_interval"] as const

/**
 * Get analyses with pagination and filtering by trigger type and status.
 * Supports "automated" filter that matches all auto_* triggered-by values.
 *
 * @param opts - Pagination and filter options
 * @returns Paginated analysis summaries with total count
 */
export async function getAnalysesPaginated(opts: {
  page: number
  pageSize: number
  /** Pass "automated" to match all auto_* values; "user" for manual; any specific value for exact match */
  triggeredBy?: string
  status?: string
}): Promise<{ rows: RecentAnalysisSummary[]; total: number }> {
  const triggeredByFilter =
    opts.triggeredBy === "automated"
      ? { triggeredBy: { in: [...AUTO_TRIGGERED_VALUES] } }
      : opts.triggeredBy && opts.triggeredBy !== "all"
        ? { triggeredBy: opts.triggeredBy }
        : {}

  const statusFilter = opts.status && opts.status !== "all" ? { status: opts.status } : {}

  const where = { ...triggeredByFilter, ...statusFilter }
  const [rows, total] = await Promise.all([
    db.aiAnalysis.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
      include: {
        trade: {
          select: {
            instrument: true,
            direction: true,
            entryPrice: true,
            openedAt: true,
            notes: true,
          },
        },
      },
    }),
    db.aiAnalysis.count({ where }),
  ])
  return {
    rows: rows.map((row) => toAnalysisSummary(row)),
    total,
  }
}

/**
 * Delete analyses older than the specified number of days.
 *
 * @param days - Age threshold in days (default: 90)
 * @returns Number of analyses deleted
 */
export async function cleanupOldAnalyses(days = 90): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const result = await db.aiAnalysis.deleteMany({
    where: { createdAt: { lt: cutoff } },
  })
  return result.count
}

/**
 * On daemon startup: mark ALL analyses still in "running" or "pending" state
 * as "failed". These are orphaned records left by a previous daemon crash.
 * No cutoff needed — this only runs at startup, so nothing can be legitimately
 * running yet. A previous 15-min cutoff caused recently-created analyses to
 * remain stuck after a fast restart.
 */
export async function resetStuckAnalyses(): Promise<number> {
  const result = await db.aiAnalysis.updateMany({
    where: {
      status: { in: ["running", "pending"] },
    },
    data: {
      status: "failed",
      errorMessage: "Analysis interrupted (daemon restarted)",
    },
  })
  if (result.count > 0) {
    console.log(`[db] Reset ${result.count} stuck analysis record(s) to "failed"`)
  }
  return result.count
}

/**
 * Delete a single analysis record by ID.
 *
 * @param id - Analysis ID to delete
 */
export async function deleteAnalysis(id: string): Promise<void> {
  await db.aiAnalysis.delete({ where: { id } })
}

/**
 * Delete all analysis records. Returns the count of deleted records.
 *
 * @returns Number of analyses deleted
 */
export async function clearAllAnalyses(): Promise<number> {
  const result = await db.aiAnalysis.deleteMany()
  return result.count
}
