/**
 * Price alert service — manages standalone price alerts independent of trades.
 *
 * Handles CRUD, triggering (with repeat support), expiration, and queries
 * for the daemon's price alert monitor.
 *
 * @module price-alert-service
 */
import { db } from "./client"
import type {
  PriceAlertData,
  PriceAlertDirection,
  PriceAlertStatus,
  TradingMode,
} from "@fxflow/types"

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Map a Prisma price alert row to the serialized DTO. */
function toPriceAlertData(row: {
  id: string
  instrument: string
  direction: string
  targetPrice: number
  currentPrice: number
  label: string | null
  status: string
  repeating: boolean
  triggeredAt: Date | null
  expiresAt: Date | null
  createdAt: Date
}): PriceAlertData {
  return {
    id: row.id,
    instrument: row.instrument,
    direction: row.direction as PriceAlertDirection,
    targetPrice: row.targetPrice,
    currentPrice: row.currentPrice,
    label: row.label,
    status: row.status as PriceAlertStatus,
    repeating: row.repeating,
    triggeredAt: row.triggeredAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Create a new price alert. */
export async function createPriceAlert(data: {
  account?: TradingMode
  instrument: string
  direction: PriceAlertDirection
  targetPrice: number
  currentPrice: number
  label?: string
  repeating?: boolean
  expiresAt?: Date
}): Promise<PriceAlertData> {
  const row = await db.priceAlert.create({
    data: {
      ...(data.account ? { account: data.account } : {}),
      instrument: data.instrument,
      direction: data.direction,
      targetPrice: data.targetPrice,
      currentPrice: data.currentPrice,
      label: data.label ?? null,
      repeating: data.repeating ?? false,
      expiresAt: data.expiresAt ?? null,
    },
  })
  return toPriceAlertData(row)
}

/** List price alerts with optional status and instrument filters. */
export async function listPriceAlerts(filters?: {
  status?: string
  instrument?: string
  account?: TradingMode
}): Promise<PriceAlertData[]> {
  const where: Record<string, unknown> = {}
  if (filters?.status) where.status = filters.status
  if (filters?.instrument) where.instrument = filters.instrument
  if (filters?.account) where.account = filters.account

  const rows = await db.priceAlert.findMany({
    where,
    orderBy: { createdAt: "desc" },
  })
  return rows.map(toPriceAlertData)
}

/** Get a single price alert by ID. */
export async function getPriceAlert(id: string): Promise<PriceAlertData | null> {
  const row = await db.priceAlert.findUnique({ where: { id } })
  return row ? toPriceAlertData(row) : null
}

/** Update editable fields on a price alert. */
export async function updatePriceAlert(
  id: string,
  data: {
    label?: string
    targetPrice?: number
    direction?: PriceAlertDirection
    status?: string
    expiresAt?: Date | null
  },
): Promise<PriceAlertData> {
  const row = await db.priceAlert.update({ where: { id }, data })
  return toPriceAlertData(row)
}

/** Permanently delete a price alert. */
export async function deletePriceAlert(id: string): Promise<void> {
  await db.priceAlert.delete({ where: { id } })
}

/**
 * Mark a price alert as triggered. If the alert is repeating, it resets
 * back to "active" after recording the trigger timestamp.
 */
export async function triggerPriceAlert(id: string): Promise<PriceAlertData> {
  const now = new Date()
  const alert = await db.priceAlert.findUniqueOrThrow({ where: { id } })

  const row = await db.priceAlert.update({
    where: { id },
    data: {
      status: alert.repeating ? "active" : "triggered",
      triggeredAt: now,
    },
  })
  return toPriceAlertData(row)
}

/** Get all active alerts for an instrument (used by the daemon monitor). */
export async function getActiveAlertsForInstrument(
  instrument: string,
  account?: TradingMode,
): Promise<PriceAlertData[]> {
  const where: Record<string, unknown> = { instrument, status: "active" }
  if (account) where.account = account
  const rows = await db.priceAlert.findMany({
    where,
    orderBy: { targetPrice: "asc" },
  })
  return rows.map(toPriceAlertData)
}

/** Get distinct instruments that have active alerts (for subscription management). */
export async function getActiveAlertInstruments(account?: TradingMode): Promise<string[]> {
  const where: Record<string, unknown> = { status: "active" }
  if (account) where.account = account
  const rows = await db.priceAlert.findMany({
    where,
    select: { instrument: true },
    distinct: ["instrument"],
  })
  return rows.map((r) => r.instrument)
}

/** Expire alerts past their expiresAt date. Returns the number expired. */
export async function expireOldAlerts(): Promise<number> {
  const now = new Date()
  const result = await db.priceAlert.updateMany({
    where: {
      status: "active",
      expiresAt: { lte: now },
    },
    data: { status: "expired" },
  })
  return result.count
}

/** Cancel all active alerts. Returns the number cancelled. */
export async function cancelAllAlerts(): Promise<number> {
  const result = await db.priceAlert.updateMany({
    where: { status: "active" },
    data: { status: "cancelled" },
  })
  return result.count
}
