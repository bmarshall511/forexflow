/**
 * AI Immediate Action Log — tracks the lifecycle of one-time actions the AI
 * proposes inside an analysis (adjust_sl, adjust_tp, close_trade, partial
 * close, etc.).
 *
 * `TradeCondition` handles *persistent* rules. This log handles *one-shots*
 * that live inside the analysis JSON — without it, we have no way to tell on
 * a re-run whether the user accepted or ignored the previous analysis's
 * recommendations. Feeding that signal into the re-run prompt lets the AI
 * avoid re-proposing ideas the user already rejected.
 *
 * @module ai-immediate-action-log-service
 */
import { db } from "./client"

export type AiImmediateActionStatus = "proposed" | "applied" | "dismissed" | "ignored"

export interface AiImmediateActionLogData {
  id: string
  tradeId: string
  analysisId: string
  actionType: string
  actionParams: Record<string, unknown>
  status: AiImmediateActionStatus
  resolvedAt: string | null
  resolvedNote: string | null
  createdAt: string
}

function toLogData(row: {
  id: string
  tradeId: string
  analysisId: string
  actionType: string
  actionParams: string
  status: string
  resolvedAt: Date | null
  resolvedNote: string | null
  createdAt: Date
}): AiImmediateActionLogData {
  let parsedParams: Record<string, unknown> = {}
  try {
    parsedParams = row.actionParams ? JSON.parse(row.actionParams) : {}
  } catch {
    parsedParams = {}
  }
  return {
    id: row.id,
    tradeId: row.tradeId,
    analysisId: row.analysisId,
    actionType: row.actionType,
    actionParams: parsedParams,
    status: row.status as AiImmediateActionStatus,
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    resolvedNote: row.resolvedNote,
    createdAt: row.createdAt.toISOString(),
  }
}

/**
 * Record that an analysis proposed an immediate action. Called once per
 * action in `sections.immediateActions` right after parsing the AI response.
 */
export async function logProposedAction(input: {
  tradeId: string
  analysisId: string
  actionType: string
  actionParams: Record<string, unknown>
}): Promise<AiImmediateActionLogData> {
  const row = await db.aiImmediateActionLog.create({
    data: {
      tradeId: input.tradeId,
      analysisId: input.analysisId,
      actionType: input.actionType,
      actionParams: JSON.stringify(input.actionParams),
      status: "proposed",
    },
  })
  return toLogData(row)
}

/**
 * Transition an action's status (applied / dismissed / ignored) with an
 * optional note explaining why (e.g. "auto-applied: confidence=high").
 */
export async function resolveAction(
  id: string,
  status: Exclude<AiImmediateActionStatus, "proposed">,
  note?: string,
): Promise<void> {
  await db.aiImmediateActionLog.update({
    where: { id },
    data: {
      status,
      resolvedAt: new Date(),
      ...(note ? { resolvedNote: note } : {}),
    },
  })
}

/**
 * Fetch all logged actions for a trade, most recent analysis first. Used by
 * the context-gatherer when building a re-run prompt so the AI sees the
 * lifecycle (applied / dismissed / ignored) of its prior recommendations.
 */
export async function listActionsForTrade(
  tradeId: string,
  limit = 50,
): Promise<AiImmediateActionLogData[]> {
  const rows = await db.aiImmediateActionLog.findMany({
    where: { tradeId },
    orderBy: { createdAt: "desc" },
    take: limit,
  })
  return rows.map(toLogData)
}

/**
 * Fetch actions for a specific analysis — used by the diff-view UI so it
 * can show each proposed action alongside its resolution.
 */
export async function listActionsForAnalysis(
  analysisId: string,
): Promise<AiImmediateActionLogData[]> {
  const rows = await db.aiImmediateActionLog.findMany({
    where: { analysisId },
    orderBy: { createdAt: "asc" },
  })
  return rows.map(toLogData)
}

/**
 * Delete log rows older than the threshold. Call periodically (daily) from
 * the daemon's cleanup schedule. Default: 180 days.
 */
export async function cleanupOldActionLogs(days = 180): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const result = await db.aiImmediateActionLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  })
  return result.count
}
