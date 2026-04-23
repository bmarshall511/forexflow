import { db } from "./client"
import type {
  SmartFlowOpportunityData,
  SmartFlowOpportunityStatus,
  SmartFlowOpportunityScores,
  SmartFlowScanMode,
  TradingMode,
} from "@fxflow/types"
import { safeIso, safeJsonParse } from "./utils"

function toOpportunityData(row: Record<string, unknown>): SmartFlowOpportunityData {
  return {
    id: row.id as string,
    instrument: row.instrument as string,
    direction: row.direction as "long" | "short",
    scanMode: row.scanMode as SmartFlowScanMode,
    status: row.status as SmartFlowOpportunityStatus,
    score: (row.score as number) ?? 0,
    scores: safeJsonParse<SmartFlowOpportunityScores>(
      row.scoresJson as string,
      {
        confluence: 0,
        trendAlignment: 0,
        zoneQuality: 0,
        sessionQuality: 0,
        regimeMatch: 0,
        rrQuality: 0,
        spreadQuality: 0,
        total: 0,
      },
      "opportunity.scoresJson",
    ),
    regime: (row.regime as string) ?? null,
    session: (row.session as string) ?? null,
    preset: (row.preset as SmartFlowOpportunityData["preset"]) ?? null,
    entryPrice: row.entryPrice as number,
    stopLoss: row.stopLoss as number,
    takeProfit: row.takeProfit as number,
    riskPips: row.riskPips as number,
    rewardPips: row.rewardPips as number,
    riskRewardRatio: row.riskRewardRatio as number,
    positionSize: (row.positionSize as number) ?? 0,
    reasons: safeJsonParse<string[]>(row.reasons as string, [], "opportunity.reasons"),
    filterResults: safeJsonParse<Record<string, { passed: boolean; reason?: string }>>(
      row.filterResults as string,
      {},
      "opportunity.filterResults",
    ),
    resultConfigId: (row.resultConfigId as string) ?? null,
    resultTradeId: (row.resultTradeId as string) ?? null,
    realizedPL: (row.realizedPL as number) ?? null,
    outcome: (row.outcome as string) ?? null,
    expiresAt: row.expiresAt ? safeIso(row.expiresAt) : null,
    detectedAt: safeIso(row.detectedAt),
    placedAt: row.placedAt ? safeIso(row.placedAt) : null,
    closedAt: row.closedAt ? safeIso(row.closedAt) : null,
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getSmartFlowOpportunities(opts?: {
  status?: SmartFlowOpportunityStatus
  scanMode?: SmartFlowScanMode
  limit?: number
  account?: TradingMode
}): Promise<SmartFlowOpportunityData[]> {
  const client = db
  const where: Record<string, unknown> = {}
  if (opts?.status) where.status = opts.status
  if (opts?.scanMode) where.scanMode = opts.scanMode
  if (opts?.account) where.account = opts.account

  const rows = await client.smartFlowOpportunity.findMany({
    where,
    orderBy: { detectedAt: "desc" },
    take: opts?.limit ?? 50,
  })
  return rows.map((r) => toOpportunityData(r as unknown as Record<string, unknown>))
}

export async function getSmartFlowOpportunity(
  id: string,
): Promise<SmartFlowOpportunityData | null> {
  const client = db
  const row = await client.smartFlowOpportunity.findUnique({ where: { id } })
  if (!row) return null
  return toOpportunityData(row as unknown as Record<string, unknown>)
}

export async function countTodaySmartFlowOpportunities(account?: TradingMode): Promise<number> {
  const client = db
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const where: Record<string, unknown> = {
    detectedAt: { gte: today },
    status: { in: ["placed", "filled", "closed", "approved"] },
  }
  if (account) where.account = account
  return client.smartFlowOpportunity.count({ where })
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export interface CreateSmartFlowOpportunityInput {
  /** OANDA account this opportunity was detected for. */
  account: TradingMode
  instrument: string
  direction: "long" | "short"
  scanMode: SmartFlowScanMode
  score: number
  scores: SmartFlowOpportunityScores
  regime?: string | null
  session?: string | null
  preset?: string | null
  entryPrice: number
  stopLoss: number
  takeProfit: number
  riskPips: number
  rewardPips: number
  riskRewardRatio: number
  positionSize: number
  reasons: string[]
  filterResults: Record<string, { passed: boolean; reason?: string }>
}

export async function createSmartFlowOpportunity(
  input: CreateSmartFlowOpportunityInput,
): Promise<SmartFlowOpportunityData> {
  const client = db
  const row = await client.smartFlowOpportunity.create({
    data: {
      account: input.account,
      instrument: input.instrument,
      direction: input.direction,
      scanMode: input.scanMode,
      score: input.score,
      scoresJson: JSON.stringify(input.scores),
      regime: input.regime ?? null,
      session: input.session ?? null,
      preset: input.preset ?? null,
      entryPrice: input.entryPrice,
      stopLoss: input.stopLoss,
      takeProfit: input.takeProfit,
      riskPips: input.riskPips,
      rewardPips: input.rewardPips,
      riskRewardRatio: input.riskRewardRatio,
      positionSize: input.positionSize,
      reasons: JSON.stringify(input.reasons),
      filterResults: JSON.stringify(input.filterResults),
    },
  })
  return toOpportunityData(row as unknown as Record<string, unknown>)
}

export async function updateSmartFlowOpportunityStatus(
  id: string,
  status: SmartFlowOpportunityStatus,
  extra?: {
    resultConfigId?: string
    resultTradeId?: string
    placedAt?: Date
    closedAt?: Date
    realizedPL?: number
    outcome?: string
  },
): Promise<void> {
  const client = db
  const data: Record<string, unknown> = { status }
  if (extra?.resultConfigId !== undefined) data.resultConfigId = extra.resultConfigId
  if (extra?.resultTradeId !== undefined) data.resultTradeId = extra.resultTradeId
  if (extra?.placedAt !== undefined) data.placedAt = extra.placedAt
  if (extra?.closedAt !== undefined) data.closedAt = extra.closedAt
  if (extra?.realizedPL !== undefined) data.realizedPL = extra.realizedPL
  if (extra?.outcome !== undefined) data.outcome = extra.outcome

  await client.smartFlowOpportunity.update({ where: { id }, data })
}

export async function cleanupOldSmartFlowOpportunities(daysBack = 30): Promise<number> {
  const client = db
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysBack)
  const result = await client.smartFlowOpportunity.deleteMany({
    where: {
      detectedAt: { lt: cutoff },
      status: { in: ["expired", "rejected", "filtered", "closed"] },
    },
  })
  return result.count
}
