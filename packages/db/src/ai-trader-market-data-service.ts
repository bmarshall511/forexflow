/**
 * AI Trader market data cache service — manages cached external market data with TTL.
 *
 * Provides a key-value cache backed by SQLite for market data fetched from
 * external APIs (FRED, Alpha Vantage, etc.). Entries auto-expire based on
 * configurable TTL. Used by the AI trader's fundamental analysis pipeline.
 *
 * @module ai-trader-market-data-service
 */
import { db } from "./client"
import type { AiTraderMarketDataType, AiTraderMarketDataEntry } from "@fxflow/types"

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Map a Prisma market data row to the `AiTraderMarketDataEntry` DTO.
 *
 * @param row - Raw market data row from Prisma
 * @returns Serialized market data entry
 */
function toEntry(row: {
  dataType: string
  dataKey: string
  data: string
  fetchedAt: Date
  expiresAt: Date
}): AiTraderMarketDataEntry {
  return {
    dataType: row.dataType as AiTraderMarketDataType,
    dataKey: row.dataKey,
    data: JSON.parse(row.data) as unknown,
    fetchedAt: row.fetchedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  }
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/** Return cached entry if not expired, otherwise null. */
export async function getCachedMarketData(
  dataType: AiTraderMarketDataType,
  dataKey: string,
): Promise<AiTraderMarketDataEntry | null> {
  const row = await db.aiTraderMarketData.findFirst({
    where: { dataType, dataKey, expiresAt: { gt: new Date() } },
    orderBy: { fetchedAt: "desc" },
  })
  return row ? toEntry(row) : null
}

/** Return all non-expired entries of a given type. */
export async function getAllCachedByType(
  dataType: AiTraderMarketDataType,
): Promise<AiTraderMarketDataEntry[]> {
  const rows = await db.aiTraderMarketData.findMany({
    where: { dataType, expiresAt: { gt: new Date() } },
    orderBy: { fetchedAt: "desc" },
  })
  return rows.map(toEntry)
}

// ─── Mutations ───────────────────────────────────────────────────────────────

/** Upsert cached data: delete existing entry with same type+key, then insert. */
export async function setCachedMarketData(
  dataType: AiTraderMarketDataType,
  dataKey: string,
  data: unknown,
  ttlMinutes: number,
): Promise<void> {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60_000)

  await db.aiTraderMarketData.deleteMany({ where: { dataType, dataKey } })
  await db.aiTraderMarketData.create({
    data: {
      dataType,
      dataKey,
      data: JSON.stringify(data),
      fetchedAt: now,
      expiresAt,
    },
  })
}

/** Delete all entries where expiresAt < now. Returns count deleted. */
export async function cleanupExpiredData(): Promise<number> {
  const { count } = await db.aiTraderMarketData.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  })
  return count
}

/** Delete all entries. Returns count deleted. */
export async function clearAllMarketData(): Promise<number> {
  const { count } = await db.aiTraderMarketData.deleteMany()
  return count
}
