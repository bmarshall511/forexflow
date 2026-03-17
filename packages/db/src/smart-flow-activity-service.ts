import { db } from "./client"
import type { SmartFlowActivityEvent, SmartFlowActivityType } from "@fxflow/types"

export async function createActivityLog(input: {
  type: SmartFlowActivityType
  message: string
  detail?: string | null
  severity?: string
  instrument?: string | null
  tradeId?: string | null
  configId?: string | null
}): Promise<string> {
  const row = await db.smartFlowActivityLog.create({
    data: {
      type: input.type,
      message: input.message,
      detail: input.detail ?? null,
      severity: input.severity ?? "info",
      instrument: input.instrument ?? null,
      tradeId: input.tradeId ?? null,
      configId: input.configId ?? null,
    },
  })
  return row.id
}

export async function getActivityLogs(limit = 100): Promise<SmartFlowActivityEvent[]> {
  const rows = await db.smartFlowActivityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  })
  return rows
    .reverse()
    .map(
      (r: {
        id: string
        type: string
        message: string
        detail: string | null
        severity: string
        instrument: string | null
        tradeId: string | null
        configId: string | null
        createdAt: Date
      }) => ({
        id: r.id,
        type: r.type as SmartFlowActivityType,
        timestamp: r.createdAt.toISOString(),
        instrument: r.instrument,
        message: r.message,
        detail: r.detail,
        severity: r.severity as SmartFlowActivityEvent["severity"],
        tradeId: r.tradeId,
        configId: r.configId,
      }),
    )
}

export async function getActivityLogsByConfig(
  configId: string,
  limit = 20,
): Promise<SmartFlowActivityEvent[]> {
  const rows = await db.smartFlowActivityLog.findMany({
    where: { configId },
    orderBy: { createdAt: "desc" },
    take: limit,
  })
  return rows
    .reverse()
    .map(
      (r: {
        id: string
        type: string
        message: string
        detail: string | null
        severity: string
        instrument: string | null
        tradeId: string | null
        configId: string | null
        createdAt: Date
      }) => ({
        id: r.id,
        type: r.type as SmartFlowActivityType,
        timestamp: r.createdAt.toISOString(),
        instrument: r.instrument,
        message: r.message,
        detail: r.detail,
        severity: r.severity as SmartFlowActivityEvent["severity"],
        tradeId: r.tradeId,
        configId: r.configId,
      }),
    )
}

export async function clearActivityLogs(): Promise<number> {
  const result = await db.smartFlowActivityLog.deleteMany()
  return result.count
}

export async function cleanupOldActivityLogs(daysToKeep = 30): Promise<number> {
  const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000)
  const result = await db.smartFlowActivityLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  })
  return result.count
}
