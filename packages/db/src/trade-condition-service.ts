/**
 * Trade condition service — manages price-triggered conditions attached to trades.
 *
 * Supports condition creation, chaining (parent/child), status transitions,
 * expiration, and crash recovery. Conditions are monitored by the daemon's
 * ConditionMonitor and can trigger actions like notifications or SL adjustments.
 *
 * @module trade-condition-service
 */
import { db } from "./client"
import { safeJsonParse } from "./utils"
import type {
  TradeConditionData,
  TradeConditionTriggerType,
  TradeConditionActionType,
  TradeConditionStatus,
} from "@fxflow/types"

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Map a Prisma condition row to the `TradeConditionData` DTO,
 * deserializing JSON fields for trigger value and action params.
 *
 * @param row - Raw condition row from Prisma
 * @returns Serialized condition data for the API/UI
 */
function toConditionData(row: {
  id: string
  tradeId: string
  triggerType: string
  triggerValue: string
  actionType: string
  actionParams: string
  status: string
  label: string | null
  createdBy: string
  analysisId: string | null
  priority: number
  parentConditionId: string | null
  expiresAt: Date | null
  triggeredAt: Date | null
  createdAt: Date
  updatedAt: Date
}): TradeConditionData {
  return {
    id: row.id,
    tradeId: row.tradeId,
    triggerType: row.triggerType as TradeConditionTriggerType,
    triggerValue: safeJsonParse<Record<string, unknown>>(
      row.triggerValue,
      {},
      `condition ${row.id} triggerValue`,
    ),
    actionType: row.actionType as TradeConditionActionType,
    actionParams: safeJsonParse<Record<string, unknown>>(
      row.actionParams,
      {},
      `condition ${row.id} actionParams`,
    ),
    status: row.status as TradeConditionStatus,
    label: row.label,
    createdBy: row.createdBy as "user" | "ai",
    analysisId: row.analysisId,
    priority: row.priority,
    parentConditionId: row.parentConditionId ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    triggeredAt: row.triggeredAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

// ─── Input types ─────────────────────────────────────────────────────────────

/** Fields required to create a new trade condition. */
export interface CreateConditionInput {
  tradeId: string
  triggerType: TradeConditionTriggerType
  triggerValue: Record<string, unknown>
  actionType: TradeConditionActionType
  actionParams?: Record<string, unknown>
  label?: string
  createdBy?: "user" | "ai"
  analysisId?: string
  priority?: number
  parentConditionId?: string | null
  status?: "active" | "waiting"
  expiresAt?: Date | string
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Create a new trade condition. Conditions with a parent start in "waiting" status
 * and are activated when the parent triggers. Standalone conditions start as "active".
 *
 * @param input - Condition creation parameters
 * @returns The created condition data
 */
export async function createCondition(input: CreateConditionInput): Promise<TradeConditionData> {
  const row = await db.tradeCondition.create({
    data: {
      tradeId: input.tradeId,
      triggerType: input.triggerType,
      triggerValue: JSON.stringify(input.triggerValue),
      actionType: input.actionType,
      actionParams: JSON.stringify(input.actionParams ?? {}),
      label: input.label ?? null,
      createdBy: input.createdBy ?? "user",
      analysisId: input.analysisId ?? null,
      priority: input.priority ?? 0,
      parentConditionId: input.parentConditionId ?? null,
      status: input.status ?? (input.parentConditionId ? "waiting" : "active"),
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    },
  })
  return toConditionData(row)
}

/**
 * Partially update a condition's configuration (trigger, action, label, etc.).
 *
 * @param id - Condition ID
 * @param updates - Fields to update
 * @returns The updated condition data, or null on failure
 */
export async function updateCondition(
  id: string,
  updates: Partial<{
    triggerType: TradeConditionTriggerType
    triggerValue: Record<string, unknown>
    actionType: TradeConditionActionType
    actionParams: Record<string, unknown>
    label: string | null
    priority: number
    parentConditionId: string | null
    expiresAt: Date | string | null
  }>,
): Promise<TradeConditionData | null> {
  try {
    const row = await db.tradeCondition.update({
      where: { id },
      data: {
        ...(updates.triggerType ? { triggerType: updates.triggerType } : {}),
        ...(updates.triggerValue ? { triggerValue: JSON.stringify(updates.triggerValue) } : {}),
        ...(updates.actionType ? { actionType: updates.actionType } : {}),
        ...(updates.actionParams ? { actionParams: JSON.stringify(updates.actionParams) } : {}),
        ...(updates.label !== undefined ? { label: updates.label } : {}),
        ...(updates.priority !== undefined ? { priority: updates.priority } : {}),
        ...(updates.parentConditionId !== undefined
          ? { parentConditionId: updates.parentConditionId }
          : {}),
        ...(updates.expiresAt !== undefined
          ? { expiresAt: updates.expiresAt ? new Date(updates.expiresAt) : null }
          : {}),
      },
    })
    return toConditionData(row)
  } catch (err) {
    console.warn("[trade-condition-service] updateCondition failed:", (err as Error).message)
    return null
  }
}

/**
 * Update a condition's status, optionally recording when it was triggered.
 *
 * @param id - Condition ID
 * @param status - New status to set
 * @param triggeredAt - Optional timestamp when the condition was triggered
 */
export async function updateConditionStatus(
  id: string,
  status: TradeConditionStatus,
  triggeredAt?: Date,
): Promise<void> {
  await db.tradeCondition.update({
    where: { id },
    data: { status, ...(triggeredAt ? { triggeredAt } : {}) },
  })
}

/**
 * Delete a condition by ID. Returns false if the condition was not found.
 *
 * @param id - Condition ID to delete
 * @returns True if deleted, false if not found or deletion failed
 */
export async function deleteCondition(id: string): Promise<boolean> {
  try {
    await db.tradeCondition.delete({ where: { id } })
    return true
  } catch (err) {
    console.warn("[trade-condition-service] deleteCondition failed:", (err as Error).message)
    return false
  }
}

/**
 * List all conditions attached to a specific trade, ordered by priority then creation date.
 *
 * @param tradeId - Trade ID to list conditions for
 * @returns Array of condition data
 */
export async function listConditionsForTrade(tradeId: string): Promise<TradeConditionData[]> {
  const rows = await db.tradeCondition.findMany({
    where: { tradeId },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
  })
  return rows.map(toConditionData)
}

/** List all active conditions across all trades — used by ConditionMonitor on startup */
export async function listActiveConditions(): Promise<TradeConditionData[]> {
  const rows = await db.tradeCondition.findMany({
    where: { status: "active" },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  })
  return rows.map(toConditionData)
}

/** Mark expired conditions (expiresAt < now) — run periodically by daemon */
export async function expireOldConditions(): Promise<number> {
  const result = await db.tradeCondition.updateMany({
    where: {
      status: "active",
      expiresAt: { lt: new Date() },
    },
    data: { status: "expired" },
  })
  return result.count
}

/** Condition data enriched with the parent trade's instrument and direction. */
export interface ConditionSummary {
  id: string
  tradeId: string
  instrument: string
  direction: string
  triggerType: TradeConditionTriggerType
  triggerValue: Record<string, unknown>
  actionType: TradeConditionActionType
  actionParams: Record<string, unknown>
  status: TradeConditionStatus
  label: string | null
  createdBy: "user" | "ai"
  triggeredAt: string | null
  createdAt: string
}

/** All conditions across all trades, joined to trade for instrument/direction */
export async function getAllConditionSummaries(opts?: {
  status?: TradeConditionStatus | "all"
}): Promise<ConditionSummary[]> {
  const where = opts?.status && opts.status !== "all" ? { status: opts.status } : {}
  const rows = await db.tradeCondition.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { trade: { select: { instrument: true, direction: true } } },
  })
  return rows.map((row) => ({
    id: row.id,
    tradeId: row.tradeId,
    instrument: row.trade.instrument,
    direction: row.trade.direction,
    triggerType: row.triggerType as TradeConditionTriggerType,
    triggerValue: safeJsonParse<Record<string, unknown>>(
      row.triggerValue,
      {},
      `summary ${row.id} triggerValue`,
    ),
    actionType: row.actionType as TradeConditionActionType,
    actionParams: safeJsonParse<Record<string, unknown>>(
      row.actionParams,
      {},
      `summary ${row.id} actionParams`,
    ),
    status: row.status as TradeConditionStatus,
    label: row.label,
    createdBy: row.createdBy as "user" | "ai",
    triggeredAt: row.triggeredAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }))
}

/** Cancel all active conditions for a trade (e.g. when trade closes) */
export async function cancelConditionsForTrade(tradeId: string): Promise<number> {
  const result = await db.tradeCondition.updateMany({
    where: { tradeId, status: "active" },
    data: { status: "cancelled" },
  })
  return result.count
}

/** Activate child conditions in a chain after the parent is triggered */
export async function activateChildConditions(parentConditionId: string): Promise<string[]> {
  const children = await db.tradeCondition.findMany({
    where: {
      parentConditionId,
      status: "waiting",
    },
    select: { id: true },
  })

  if (children.length === 0) return []

  await db.tradeCondition.updateMany({
    where: {
      parentConditionId,
      status: "waiting",
    },
    data: { status: "active" },
  })

  return children.map((c) => c.id)
}

/** Recover conditions stuck in "executing" state after daemon crash — mark as "triggered" */
export async function recoverExecutingConditions(): Promise<number> {
  const rows = await db.tradeCondition.findMany({
    where: { status: "executing" },
  })
  if (rows.length === 0) return 0

  for (const row of rows) {
    console.warn(
      `[trade-condition-service] Recovering stuck "executing" condition ${row.id} → marking as "triggered" (daemon may have crashed mid-execution)`,
    )
  }

  const result = await db.tradeCondition.updateMany({
    where: { status: "executing" },
    data: { status: "triggered", triggeredAt: new Date() },
  })
  return result.count
}
