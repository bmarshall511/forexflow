/**
 * Tag service — manages trade tags and tag-to-trade assignments.
 *
 * Handles CRUD for tags and idempotent tag assignment/removal on trades.
 * Supports batch fetching of tags across multiple trades for table views.
 *
 * @module tag-service
 */
import { db } from "./client"
import type { TagData, TradeTagData } from "@fxflow/types"

// ─── Tag CRUD ────────────────────────────────────────────────────────────────

/** List all tags sorted by name. */
export async function listTags(): Promise<TagData[]> {
  const tags = await db.tag.findMany({ orderBy: { name: "asc" } })
  return tags.map((t) => ({ id: t.id, name: t.name, color: t.color }))
}

/** Create a new tag with a unique name. */
export async function createTag(name: string, color: string): Promise<TagData> {
  const tag = await db.tag.create({ data: { name, color } })
  return { id: tag.id, name: tag.name, color: tag.color }
}

/** Find or create a tag by name. If it exists, returns the existing tag. */
export async function findOrCreateTag(name: string, color: string): Promise<TagData> {
  const existing = await db.tag.findFirst({ where: { name } })
  if (existing) return { id: existing.id, name: existing.name, color: existing.color }
  return createTag(name, color)
}

/** Delete a tag by ID (cascades to TradeTag assignments). */
export async function deleteTag(id: string): Promise<void> {
  await db.tag.delete({ where: { id } })
}

// ─── Tag Assignments ─────────────────────────────────────────────────────────

/** Assign a tag to a trade. Idempotent — no error if already assigned. */
export async function assignTagToTrade(tradeId: string, tagId: string): Promise<void> {
  await db.tradeTag.upsert({
    where: { tradeId_tagId: { tradeId, tagId } },
    create: { tradeId, tagId },
    update: {},
  })
}

/** Remove a tag from a trade. */
export async function removeTagFromTrade(tradeId: string, tagId: string): Promise<void> {
  await db.tradeTag.deleteMany({ where: { tradeId, tagId } })
}

/** Get all tags assigned to a trade. */
export async function getTagsForTrade(tradeId: string): Promise<TagData[]> {
  const assignments = await db.tradeTag.findMany({
    where: { tradeId },
    include: { tag: true },
    orderBy: { tag: { name: "asc" } },
  })
  return assignments.map((a) => ({ id: a.tag.id, name: a.tag.name, color: a.tag.color }))
}

/** Get tags for multiple trade IDs in a single query. */
export async function getTagsForTradeIds(
  tradeIds: string[],
): Promise<Record<string, TradeTagData[]>> {
  if (tradeIds.length === 0) return {}

  const assignments = await db.tradeTag.findMany({
    where: { tradeId: { in: tradeIds } },
    include: { tag: true },
    orderBy: { tag: { name: "asc" } },
  })

  const result: Record<string, TradeTagData[]> = {}
  for (const a of assignments) {
    const arr = (result[a.tradeId] ??= [])
    arr.push({
      tagId: a.tagId,
      tag: { id: a.tag.id, name: a.tag.name, color: a.tag.color },
      assignedAt: a.assignedAt.toISOString(),
    })
  }
  return result
}
