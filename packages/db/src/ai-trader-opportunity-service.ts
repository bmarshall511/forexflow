/**
 * AI Trader opportunity service — manages opportunities detected by the 3-tier AI pipeline.
 *
 * Handles opportunity creation, status transitions through the lifecycle
 * (detected -> suggested -> approved -> placed -> filled -> managed -> closed),
 * management action logging, cost tracking, and cleanup.
 *
 * @module ai-trader-opportunity-service
 */
import { db } from "./client"
import { safeIso, safeJsonParse } from "./utils"
import type {
  AiTraderOpportunityData,
  AiTraderOpportunityStatus,
  AiTraderScoreBreakdown,
  AiTraderManagementAction,
  AiTraderMarketRegime,
  AiTraderSession,
  AiTraderTechnique,
  AiTraderProfile,
  TradeDirection,
  TradeOutcome,
  TradingMode,
} from "@fxflow/types"

// ─── Mappers ────────────────────────────────────────────────────────────────

/**
 * Map a Prisma opportunity row to the `AiTraderOpportunityData` DTO,
 * deserializing JSON fields for scores, snapshots, and management log.
 *
 * @param row - Raw opportunity row from Prisma
 * @returns Serialized opportunity data for the API/UI
 */
function toOpportunityData(row: {
  id: string
  instrument: string
  direction: string
  profile: string
  status: string
  confidence: number
  scoresJson: string
  entryPrice: number
  stopLoss: number
  takeProfit: number
  riskPips: number
  rewardPips: number
  riskRewardRatio: number
  positionSize: number
  regime: string | null
  session: string | null
  primaryTechnique: string | null
  entryRationale: string | null
  technicalSnapshot: string
  fundamentalSnapshot: string
  sentimentSnapshot: string
  technicalBrief: string | null
  macroRiskBrief: string | null
  bullCase: string | null
  bearCase: string | null
  debateCost: number
  debateInputTokens: number
  debateOutputTokens: number
  tier2Response: string | null
  tier2Model: string | null
  tier2InputTokens: number
  tier2OutputTokens: number
  tier2Cost: number
  tier3Response: string | null
  tier3Model: string | null
  tier3InputTokens: number
  tier3OutputTokens: number
  tier3Cost: number
  resultTradeId: string | null
  resultSourceId: string | null
  realizedPL: number | null
  outcome: string | null
  managementLog: string
  detectedAt: Date
  suggestedAt: Date | null
  placedAt: Date | null
  filledAt: Date | null
  closedAt: Date | null
  expiresAt: Date | null
  createdAt: Date
  updatedAt: Date
}): AiTraderOpportunityData {
  return {
    id: row.id,
    instrument: row.instrument,
    direction: row.direction as TradeDirection,
    profile: row.profile as AiTraderProfile,
    status: row.status as AiTraderOpportunityStatus,
    confidence: row.confidence,
    scores: JSON.parse(row.scoresJson) as AiTraderScoreBreakdown,
    entryPrice: row.entryPrice,
    stopLoss: row.stopLoss,
    takeProfit: row.takeProfit,
    riskPips: row.riskPips,
    rewardPips: row.rewardPips,
    riskRewardRatio: row.riskRewardRatio,
    positionSize: row.positionSize,
    regime: row.regime as AiTraderMarketRegime | null,
    session: row.session as AiTraderSession | null,
    primaryTechnique: row.primaryTechnique as AiTraderTechnique | null,
    entryRationale: row.entryRationale,
    technicalBrief: row.technicalBrief,
    macroRiskBrief: row.macroRiskBrief,
    bullCase: row.bullCase,
    bearCase: row.bearCase,
    debateCost: row.debateCost,
    debateInputTokens: row.debateInputTokens,
    debateOutputTokens: row.debateOutputTokens,
    technicalSnapshot: safeJsonParse<unknown>(row.technicalSnapshot, {}),
    fundamentalSnapshot: safeJsonParse<unknown>(row.fundamentalSnapshot, {}),
    sentimentSnapshot: safeJsonParse<unknown>(row.sentimentSnapshot, {}),
    tier2Response: row.tier2Response,
    tier2Model: row.tier2Model,
    tier2InputTokens: row.tier2InputTokens,
    tier2OutputTokens: row.tier2OutputTokens,
    tier2Cost: row.tier2Cost,
    tier3Response: row.tier3Response,
    tier3Model: row.tier3Model,
    tier3InputTokens: row.tier3InputTokens,
    tier3OutputTokens: row.tier3OutputTokens,
    tier3Cost: row.tier3Cost,
    resultTradeId: row.resultTradeId,
    resultSourceId: row.resultSourceId,
    realizedPL: row.realizedPL,
    outcome: row.outcome as TradeOutcome | null,
    managementLog: safeJsonParse<AiTraderManagementAction[]>(row.managementLog, []),
    detectedAt: safeIso(row.detectedAt),
    suggestedAt: row.suggestedAt ? safeIso(row.suggestedAt) : null,
    placedAt: row.placedAt ? safeIso(row.placedAt) : null,
    filledAt: row.filledAt ? safeIso(row.filledAt) : null,
    closedAt: row.closedAt ? safeIso(row.closedAt) : null,
    expiresAt: row.expiresAt ? safeIso(row.expiresAt) : null,
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

/** Fields required to create a new AI trader opportunity. */
export interface CreateOpportunityInput {
  /** OANDA account this opportunity was detected for. */
  account?: TradingMode
  instrument: string
  direction: TradeDirection
  profile: AiTraderProfile
  confidence: number
  scores: AiTraderScoreBreakdown
  entryPrice: number
  stopLoss: number
  takeProfit: number
  riskPips: number
  rewardPips: number
  riskRewardRatio: number
  positionSize: number
  regime?: AiTraderMarketRegime
  session?: AiTraderSession
  primaryTechnique?: AiTraderTechnique
  entryRationale?: string
  technicalSnapshot?: unknown
  fundamentalSnapshot?: unknown
  sentimentSnapshot?: unknown
  expiresAt?: Date
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/**
 * Create a new AI trader opportunity in "detected" status.
 *
 * @param input - Opportunity details including instrument, levels, scores, and snapshots
 * @returns The created opportunity data
 */
export async function createOpportunity(
  input: CreateOpportunityInput,
): Promise<AiTraderOpportunityData> {
  const row = await db.aiTraderOpportunity.create({
    data: {
      ...(input.account ? { account: input.account } : {}),
      instrument: input.instrument,
      direction: input.direction,
      profile: input.profile,
      status: "detected",
      confidence: input.confidence,
      scoresJson: JSON.stringify(input.scores),
      entryPrice: input.entryPrice,
      stopLoss: input.stopLoss,
      takeProfit: input.takeProfit,
      riskPips: input.riskPips,
      rewardPips: input.rewardPips,
      riskRewardRatio: input.riskRewardRatio,
      positionSize: input.positionSize,
      regime: input.regime ?? null,
      session: input.session ?? null,
      primaryTechnique: input.primaryTechnique ?? null,
      entryRationale: input.entryRationale ?? null,
      technicalSnapshot: input.technicalSnapshot ? JSON.stringify(input.technicalSnapshot) : "{}",
      fundamentalSnapshot: input.fundamentalSnapshot
        ? JSON.stringify(input.fundamentalSnapshot)
        : "{}",
      sentimentSnapshot: input.sentimentSnapshot ? JSON.stringify(input.sentimentSnapshot) : "{}",
      expiresAt: input.expiresAt ?? null,
      detectedAt: new Date(),
    },
  })
  return toOpportunityData(row)
}

/**
 * Transition an opportunity to a new status with optional metadata updates.
 * Supports updating tier2/tier3 AI response data, trade result links, and timestamps.
 *
 * @param id - Opportunity ID
 * @param status - New status to transition to
 * @param extra - Optional fields to update alongside the status change
 */
export async function updateOpportunityStatus(
  id: string,
  status: AiTraderOpportunityStatus,
  extra?: Partial<{
    suggestedAt: Date
    placedAt: Date
    filledAt: Date
    closedAt: Date
    resultTradeId: string
    resultSourceId: string
    realizedPL: number
    outcome: TradeOutcome
    tier2Response: string
    tier2Model: string
    tier2InputTokens: number
    tier2OutputTokens: number
    tier2Cost: number
    /** Tier 2's own confidence (0-100) BEFORE the Tier 3 decision. */
    tier2Confidence: number
    tier2Passed: boolean
    tier2DecidedAt: Date
    tier3Response: string
    tier3Model: string
    tier3InputTokens: number
    tier3OutputTokens: number
    tier3Cost: number
    // Multi-agent debate data
    technicalBrief: string
    macroRiskBrief: string
    bullCase: string
    bearCase: string
    debateCost: number
    debateInputTokens: number
    debateOutputTokens: number
  }>,
): Promise<void> {
  const data: Record<string, unknown> = { status, updatedAt: new Date() }
  if (extra) {
    for (const [key, val] of Object.entries(extra)) {
      if (val !== undefined) data[key] = val
    }
  }
  await db.aiTraderOpportunity.update({ where: { id }, data })
}

/**
 * Append a management action to an opportunity's log (e.g., SL adjustment, partial close).
 *
 * @param id - Opportunity ID
 * @param action - The management action to append
 */
export async function appendManagementAction(
  id: string,
  action: AiTraderManagementAction,
): Promise<void> {
  const row = await db.aiTraderOpportunity.findUniqueOrThrow({
    where: { id },
    select: { managementLog: true },
  })
  const log = safeJsonParse<AiTraderManagementAction[]>(row.managementLog, [])
  log.push(action)
  await db.aiTraderOpportunity.update({
    where: { id },
    data: { managementLog: JSON.stringify(log), updatedAt: new Date() },
  })
}

// ─── Queries ────────────────────────────────────────────────────────────────

const ACTIVE_STATUSES: AiTraderOpportunityStatus[] = [
  "detected",
  "suggested",
  "approved",
  "placed",
  "filled",
  "managed",
]
const HISTORY_STATUSES: AiTraderOpportunityStatus[] = ["closed", "expired", "rejected", "skipped"]

/**
 * Get all active opportunities (detected through managed), ordered by confidence.
 *
 * @returns Array of active opportunity data
 */
export async function getActiveOpportunities(
  account?: TradingMode,
): Promise<AiTraderOpportunityData[]> {
  const where: Record<string, unknown> = { status: { in: ACTIVE_STATUSES } }
  if (account) where.account = account
  const rows = await db.aiTraderOpportunity.findMany({
    where,
    orderBy: { confidence: "desc" },
  })
  return rows.map(toOpportunityData)
}

/**
 * Get historical opportunities (closed, expired, rejected, skipped).
 *
 * @param limit - Maximum number of records to return (default: 50)
 * @returns Array of historical opportunity data
 */
export async function getOpportunityHistory(
  limit = 50,
  account?: TradingMode,
): Promise<AiTraderOpportunityData[]> {
  const where: Record<string, unknown> = { status: { in: HISTORY_STATUSES } }
  if (account) where.account = account
  const rows = await db.aiTraderOpportunity.findMany({
    where,
    orderBy: { closedAt: "desc" },
    take: limit,
  })
  return rows.map(toOpportunityData)
}

/**
 * Retrieve a single opportunity by ID.
 *
 * @param id - Opportunity ID
 * @returns The opportunity data, or null if not found
 */
export async function getOpportunity(id: string): Promise<AiTraderOpportunityData | null> {
  const row = await db.aiTraderOpportunity.findUnique({ where: { id } })
  return row ? toOpportunityData(row) : null
}

/**
 * Find an opportunity by its linked OANDA result trade ID.
 *
 * @param tradeId - The OANDA trade ID to search for
 * @returns The matching opportunity, or null if not found
 */
export async function findOpportunityByResultTradeId(
  tradeId: string,
): Promise<AiTraderOpportunityData | null> {
  const row = await db.aiTraderOpportunity.findFirst({ where: { resultTradeId: tradeId } })
  return row ? toOpportunityData(row) : null
}

/**
 * Find an opportunity by its OANDA result source ID (order or trade ID).
 *
 * @param sourceId - The OANDA source ID to search for
 * @returns The matching opportunity, or null if not found
 */
export async function findOpportunityByResultSourceId(
  sourceId: string,
): Promise<AiTraderOpportunityData | null> {
  const row = await db.aiTraderOpportunity.findFirst({ where: { resultSourceId: sourceId } })
  return row ? toOpportunityData(row) : null
}

/**
 * Count currently open AI trader positions (placed, filled, or managed).
 *
 * @returns Number of open AI trades
 */
export async function countOpenAiTrades(account?: TradingMode): Promise<number> {
  const where: Record<string, unknown> = { status: { in: ["placed", "filled", "managed"] } }
  if (account) where.account = account
  return db.aiTraderOpportunity.count({ where })
}

/**
 * Get all opportunities for a specific strategy profile.
 *
 * @param profile - Strategy profile to filter by (e.g., "scalper", "intraday")
 * @returns Array of opportunities for the given profile
 */
export async function getOpportunitiesByProfile(
  profile: AiTraderProfile,
): Promise<AiTraderOpportunityData[]> {
  const rows = await db.aiTraderOpportunity.findMany({
    where: { profile },
    orderBy: { createdAt: "desc" },
  })
  return rows.map(toOpportunityData)
}

// ─── Filtered + Paginated Query ──────────────────────────────────────────────

/** Filters for the combined opportunity list. */
export interface OpportunityListFilters {
  status?: AiTraderOpportunityStatus[]
  instrument?: string
  profile?: AiTraderProfile
  direction?: TradeDirection
  account?: TradingMode
  search?: string
  sort?: "confidence" | "detectedAt" | "realizedPL" | "riskRewardRatio"
  sortDir?: "asc" | "desc"
  page?: number
  limit?: number
}

/**
 * Get all opportunities with server-side filtering, sorting, and pagination.
 *
 * @param filters - Optional filter, sort, and pagination parameters
 * @returns Paginated result with data array and total count
 */
export async function getAllOpportunities(
  filters: OpportunityListFilters = {},
): Promise<{ data: AiTraderOpportunityData[]; total: number }> {
  const {
    status,
    instrument,
    profile,
    direction,
    account,
    search,
    sort = "detectedAt",
    sortDir = "desc",
    page = 1,
    limit = 20,
  } = filters

  // Build where clause
  const where: Record<string, unknown> = {}

  if (status && status.length > 0) {
    where.status = { in: status }
  }
  if (instrument) {
    where.instrument = instrument
  }
  if (profile) {
    where.profile = profile
  }
  if (direction) {
    where.direction = direction
  }
  if (account) {
    where.account = account
  }
  if (search) {
    where.OR = [
      { instrument: { contains: search } },
      { entryRationale: { contains: search } },
      { profile: { contains: search } },
      { primaryTechnique: { contains: search } },
    ]
  }

  const orderBy = { [sort]: sortDir }
  const skip = (page - 1) * limit

  const [rows, total] = await Promise.all([
    db.aiTraderOpportunity.findMany({
      where,
      orderBy,
      skip,
      take: limit,
    }),
    db.aiTraderOpportunity.count({ where }),
  ])

  return { data: rows.map(toOpportunityData), total }
}

// ─── Cost Tracking ──────────────────────────────────────────────────────────

/**
 * Sum today's AI costs (tier2 + tier3) across all opportunities.
 *
 * @returns Total cost in USD for today
 */
export async function getTodayAiCost(): Promise<number> {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const rows = await db.aiTraderOpportunity.findMany({
    where: { createdAt: { gte: startOfDay } },
    select: { tier2Cost: true, tier3Cost: true },
  })
  return rows.reduce((sum, r) => sum + r.tier2Cost + r.tier3Cost, 0)
}

/**
 * Sum this month's AI costs (tier2 + tier3) across all opportunities.
 *
 * @returns Total cost in USD for the current month
 */
export async function getMonthlyAiCost(): Promise<number> {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  const rows = await db.aiTraderOpportunity.findMany({
    where: { createdAt: { gte: startOfMonth } },
    select: { tier2Cost: true, tier3Cost: true },
  })
  return rows.reduce((sum, r) => sum + r.tier2Cost + r.tier3Cost, 0)
}

// ─── Cleanup ────────────────────────────────────────────────────────────────

/**
 * Expire stale detected/suggested opportunities older than the given threshold.
 *
 * @param maxAgeHours - Maximum age in hours before expiration (default: 4)
 * @returns Number of opportunities expired
 */
export async function expireOldOpportunities(maxAgeHours = 4): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000)
  const result = await db.aiTraderOpportunity.updateMany({
    where: {
      status: { in: ["detected", "suggested"] },
      detectedAt: { lt: cutoff },
    },
    data: { status: "expired", updatedAt: new Date() },
  })
  return result.count
}

/**
 * Reconcile "placed"/"filled"/"managed" opportunities against actual open trades.
 * Any opportunity in an active status whose resultTradeId is not in the set of
 * open trade IDs is marked as expired/cancelled (order was cancelled, SL hit, etc.
 * without the close callback firing — e.g., after a daemon restart).
 *
 * @param openTradeSourceIds - Set of OANDA source trade IDs currently open.
 * @returns Number of stale opportunities cleaned up.
 */
export async function reconcileStaleOpportunities(
  openTradeSourceIds: Set<string>,
): Promise<number> {
  const active = await db.aiTraderOpportunity.findMany({
    where: { status: { in: ["placed", "filled", "managed"] } },
    select: { id: true, resultTradeId: true, status: true },
  })

  const staleIds: string[] = []
  const reasons: Map<string, string> = new Map()
  for (const opp of active) {
    if (!opp.resultTradeId) {
      staleIds.push(opp.id)
      reasons.set(opp.id, `No OANDA trade ID (order never filled, status was ${opp.status})`)
    } else if (!openTradeSourceIds.has(opp.resultTradeId)) {
      staleIds.push(opp.id)
      reasons.set(
        opp.id,
        `Trade ${opp.resultTradeId} disappeared from OANDA (closed without callback, status was ${opp.status})`,
      )
    }
  }

  if (staleIds.length === 0) return 0

  // Persist the cancellation reason in the management log so post-mortem
  // analysis can see WHY 13/15 opportunities ended up as "cancelled" —
  // previously this was silent and made it impossible to diagnose.
  for (const id of staleIds) {
    const reason = reasons.get(id) ?? "Unknown"
    try {
      const row = await db.aiTraderOpportunity.findUnique({
        where: { id },
        select: { managementLog: true },
      })
      const log = safeJsonParse<AiTraderManagementAction[]>(row?.managementLog ?? "[]", [])
      log.push({
        action: "close",
        detail: `Reconciled as cancelled: ${reason}`,
        timestamp: new Date().toISOString(),
      })
      await db.aiTraderOpportunity.update({
        where: { id },
        data: {
          status: "expired",
          outcome: "cancelled",
          managementLog: JSON.stringify(log),
          entryRationale:
            (
              await db.aiTraderOpportunity.findUnique({
                where: { id },
                select: { entryRationale: true },
              })
            )?.entryRationale ?? reason,
          updatedAt: new Date(),
        },
      })
    } catch {
      // Fallback: bulk update without reason log (same as before)
      await db.aiTraderOpportunity.update({
        where: { id },
        data: { status: "expired", outcome: "cancelled", updatedAt: new Date() },
      })
    }
  }

  return staleIds.length
}

/**
 * Delete old historical opportunities beyond the retention period.
 *
 * @param days - Age threshold in days (default: 90)
 * @returns Number of opportunities deleted
 */
export async function cleanupOldOpportunities(days = 90): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const result = await db.aiTraderOpportunity.deleteMany({
    where: {
      status: { in: HISTORY_STATUSES },
      updatedAt: { lt: cutoff },
    },
  })
  return result.count
}

// ─── Near-miss persistence ───────────────────────────────────────────────────

/**
 * Persist a Tier 1 near-miss for post-mortem threshold tuning. Called from
 * the scanner for each signal that almost passed the filter breakdown but
 * got blocked. Fire-and-forget from the caller's perspective — errors are
 * swallowed because near-miss logging must never block a scan cycle.
 */
export interface CreateNearMissInput {
  /** OANDA account this near-miss was observed on. */
  account?: TradingMode
  instrument: string
  direction: "long" | "short"
  profile: string
  confidence: number
  blockingFilter: string
  reason?: string | null
  /** Serialised Tier1NearMiss-shaped metadata. */
  metadata?: unknown
}

export async function createNearMiss(input: CreateNearMissInput): Promise<void> {
  try {
    await db.aiTraderNearMiss.create({
      data: {
        ...(input.account ? { account: input.account } : {}),
        instrument: input.instrument,
        direction: input.direction,
        profile: input.profile,
        confidence: Math.round(input.confidence),
        blockingFilter: input.blockingFilter,
        reason: input.reason ?? null,
        metadata: JSON.stringify(input.metadata ?? {}),
      },
    })
  } catch (err) {
    console.warn("[ai-trader-opportunity-service] createNearMiss failed:", (err as Error).message)
  }
}

/**
 * Delete old near-miss rows beyond the retention period. Called from the
 * scanner's periodic cleanup cycle so we don't accumulate forever.
 */
export async function cleanupOldNearMisses(days = 30): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const result = await db.aiTraderNearMiss.deleteMany({
    where: { detectedAt: { lt: cutoff } },
  })
  return result.count
}
