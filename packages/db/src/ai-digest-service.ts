/**
 * AI Digest service — manages periodic (weekly/monthly) AI-generated trading digests.
 *
 * Handles digest creation, result persistence, listing with pagination,
 * and deduplication by period start date.
 *
 * @module ai-digest-service
 */
import { db } from "./client"
import type { AiDigestData, AiDigestSections } from "@fxflow/types"

/**
 * Map a Prisma digest row to the `AiDigestData` DTO, deserializing the sections JSON.
 *
 * @param row - Raw digest row from Prisma
 * @returns Serialized digest data for the API/UI
 */
function toDigestData(row: {
  id: string
  period: string
  periodStart: Date
  periodEnd: Date
  status: string
  sections: string | null
  costUsd: number
  durationMs: number
  createdAt: Date
}): AiDigestData {
  return {
    id: row.id,
    period: row.period as "weekly" | "monthly",
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
    status: row.status,
    sections: row.sections ? (JSON.parse(row.sections) as AiDigestSections) : null,
    costUsd: row.costUsd,
    durationMs: row.durationMs,
    createdAt: row.createdAt.toISOString(),
  }
}

/**
 * Create a new digest record in "pending" status.
 *
 * @param input - Digest creation parameters with period type and date range
 * @returns The created digest ID
 */
export async function createDigest(input: {
  period: "weekly" | "monthly"
  periodStart: Date
  periodEnd: Date
}): Promise<string> {
  const record = await db.aiDigest.create({
    data: {
      period: input.period,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      status: "pending",
    },
  })
  return record.id
}

/**
 * Persist a digest result with sections, token usage, and cost data.
 *
 * @param id - Digest ID to update
 * @param result - The digest result including status, sections, and token counts
 */
export async function saveDigestResult(
  id: string,
  result: {
    status: "completed" | "failed"
    sections?: AiDigestSections
    rawResponse?: string
    inputTokens?: number
    outputTokens?: number
    costUsd?: number
    durationMs?: number
    errorMessage?: string
  },
): Promise<void> {
  await db.aiDigest.update({
    where: { id },
    data: {
      status: result.status,
      sections: result.sections ? JSON.stringify(result.sections) : undefined,
      rawResponse: result.rawResponse,
      inputTokens: result.inputTokens ?? 0,
      outputTokens: result.outputTokens ?? 0,
      costUsd: result.costUsd ?? 0,
      durationMs: result.durationMs ?? 0,
      errorMessage: result.errorMessage,
    },
  })
}

/**
 * Get the most recent completed digest for a given period type.
 *
 * @param period - "weekly" or "monthly"
 * @returns The latest completed digest, or null if none exist
 */
export async function getLatestDigest(period: "weekly" | "monthly"): Promise<AiDigestData | null> {
  const row = await db.aiDigest.findFirst({
    where: { period, status: "completed" },
    orderBy: { periodEnd: "desc" },
  })
  return row ? toDigestData(row) : null
}

/**
 * List digests with optional period filter and pagination.
 *
 * @param opts - Filter and pagination options
 * @returns Paginated digest list with total count
 */
export async function listDigests(opts?: {
  period?: "weekly" | "monthly"
  limit?: number
  offset?: number
}): Promise<{ items: AiDigestData[]; total: number }> {
  const where = opts?.period ? { period: opts.period } : {}
  const [rows, total] = await Promise.all([
    db.aiDigest.findMany({
      where,
      orderBy: { periodEnd: "desc" },
      take: opts?.limit ?? 20,
      skip: opts?.offset ?? 0,
    }),
    db.aiDigest.count({ where }),
  ])
  return { items: rows.map(toDigestData), total }
}

/**
 * Retrieve a single digest by ID.
 *
 * @param id - Digest ID
 * @returns The digest data, or null if not found
 */
export async function getDigest(id: string): Promise<AiDigestData | null> {
  const row = await db.aiDigest.findUnique({ where: { id } })
  return row ? toDigestData(row) : null
}

/**
 * Delete a single digest by ID.
 *
 * @param id - Digest ID to delete
 * @returns True if deleted, false if not found
 */
export async function deleteDigest(id: string): Promise<boolean> {
  try {
    await db.aiDigest.delete({ where: { id } })
    return true
  } catch {
    return false
  }
}

/**
 * Check if a digest already exists for a given period type and start date.
 * Used to prevent duplicate digest generation.
 *
 * @param period - "weekly" or "monthly"
 * @param periodStart - The period start date to check
 * @returns The existing digest, or null if not found
 */
export async function findExistingDigest(
  period: "weekly" | "monthly",
  periodStart: Date,
): Promise<AiDigestData | null> {
  const row = await db.aiDigest.findFirst({
    where: { period, periodStart },
  })
  return row ? toDigestData(row) : null
}
