/**
 * Trade service — CRUD operations for OANDA-sourced trades.
 *
 * Handles upsert, close, partial close, MFE/MAE tracking, metadata enrichment,
 * and listing with pagination/filtering. OANDA is the canonical trade repository;
 * the `enrichSource()` helper resolves display-friendly source labels from metadata.
 *
 * @module trade-service
 */
import { db } from "./client"
import type {
  TradeSource,
  TradeStatus,
  TradeDirection,
  TradeCloseReason,
  TradeOutcome,
  Timeframe,
  ClosedTradeData,
  TradeDetailData,
} from "@fxflow/types"

// ─── Input types ─────────────────────────────────────────────────────────────

/** Fields required to create or update a trade record via upsert. */
export interface UpsertTradeInput {
  source: TradeSource
  sourceTradeId: string
  status: TradeStatus
  instrument: string
  direction: TradeDirection
  orderType?: string | null
  entryPrice: number
  exitPrice?: number | null
  stopLoss?: number | null
  takeProfit?: number | null
  trailingStopDistance?: number | null
  initialUnits: number
  currentUnits: number
  realizedPL?: number
  unrealizedPL?: number
  financing?: number
  closeReason?: string | null
  timeInForce?: string | null
  gtdTime?: string | null
  mfe?: number | null
  mae?: number | null
  metadata?: string | null
  openedAt: Date
  closedAt?: Date | null
}

/** Fields required to close an existing trade. */
export interface CloseTradeInput {
  exitPrice: number | null
  closeReason: TradeCloseReason
  realizedPL: number
  financing: number
  mfe?: number | null
  mae?: number | null
  closedAt: Date
}

/** Filtering, sorting, and pagination options for listing trades. */
export interface ListTradesOptions {
  status?: TradeStatus
  instrument?: string
  direction?: TradeDirection
  outcome?: TradeOutcome
  from?: Date
  to?: Date
  sort?: string
  order?: "asc" | "desc"
  limit?: number
  offset?: number
  tagIds?: string[]
}

/** Paginated response containing trades and metadata. */
export interface TradeListResponse {
  trades: ClosedTradeData[]
  totalCount: number
  page: number
  pageSize: number
}

/** Fields required to create a trade audit event. */
export interface CreateTradeEventInput {
  tradeId: string
  eventType: string
  detail: string // JSON string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Derive trade outcome from realized P&L.
 *
 * @param realizedPL - The realized profit/loss value
 * @returns The trade outcome: "win", "loss", or "breakeven"
 */
function getOutcome(realizedPL: number): TradeOutcome {
  if (realizedPL > 0) return "win"
  if (realizedPL < 0) return "loss"
  return "breakeven"
}

/** Internal row shape returned by Prisma for trade queries with optional tag includes. */
interface TradeRow {
  id: string
  source: string
  sourceTradeId: string
  instrument: string
  direction: string
  entryPrice: number
  exitPrice: number | null
  stopLoss: number | null
  takeProfit: number | null
  initialUnits: number
  realizedPL: number
  financing: number
  closeReason: string | null
  mfe: number | null
  mae: number | null
  timeframe: string | null
  notes: string | null
  metadata?: string | null
  openedAt: Date
  closedAt: Date | null
  tags?: { tagId: string; assignedAt: Date; tag: { id: string; name: string; color: string } }[]
}

/**
 * Enrich the display source from DB metadata.
 * DB always stores source="oanda", but metadata.placedVia records the true origin.
 */
function enrichSource(source: string, metadata?: string | null): TradeSource {
  if (metadata) {
    try {
      const meta = JSON.parse(metadata) as Record<string, unknown>
      if (meta.placedVia === "ut_bot_alerts") return "ut_bot_alerts"
      if (meta.placedVia === "trade_finder") return "trade_finder"
      if (meta.placedVia === "trade_finder_auto") return "trade_finder_auto"
      if (meta.placedVia === "ai_trader") return "ai_trader"
      if (meta.placedVia === "fxflow") return "manual"
    } catch {
      /* ignore malformed metadata */
    }
  }
  return source as TradeSource
}

/**
 * Map a Prisma trade row to the `ClosedTradeData` DTO, enriching the source
 * from metadata and computing the outcome from realized P&L.
 *
 * @param row - Raw trade row from Prisma
 * @returns Serialized closed trade data for the API/UI
 */
function toClosedTradeData(row: TradeRow): ClosedTradeData {
  return {
    id: row.id,
    source: enrichSource(row.source, row.metadata),
    sourceTradeId: row.sourceTradeId,
    instrument: row.instrument,
    direction: row.direction as TradeDirection,
    entryPrice: row.entryPrice,
    exitPrice: row.exitPrice,
    stopLoss: row.stopLoss,
    takeProfit: row.takeProfit,
    units: row.initialUnits,
    realizedPL: row.realizedPL,
    financing: row.financing,
    closeReason: (row.closeReason ?? "UNKNOWN") as TradeCloseReason,
    outcome: getOutcome(row.realizedPL),
    mfe: row.mfe,
    mae: row.mae,
    timeframe: (row.timeframe as Timeframe) ?? null,
    notes: row.notes ?? null,
    tags: (row.tags ?? []).map((tt) => ({
      tagId: tt.tagId,
      tag: { id: tt.tag.id, name: tt.tag.name, color: tt.tag.color },
      assignedAt: tt.assignedAt.toISOString(),
    })),
    openedAt: row.openedAt.toISOString(),
    closedAt: row.closedAt?.toISOString() ?? row.openedAt.toISOString(),
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Upsert a trade record using composite unique [source, sourceTradeId].
 *
 * IMPORTANT: The update path uses explicit spread syntax to guarantee that
 * fields not present in `input` are NEVER touched. This preserves user data
 * (metadata, notes, tags, timeframe) across reconcile cycles.
 *
 * Fields explicitly set to `null` in input ARE written (e.g., SL removed).
 * Fields left `undefined` (not present) are omitted from the update entirely.
 */
export async function upsertTrade(input: UpsertTradeInput) {
  const where = {
    source_sourceTradeId: { source: input.source, sourceTradeId: input.sourceTradeId },
  }

  // Build update object — ONLY include fields that are explicitly provided.
  // `undefined` means "caller didn't provide this" → omit entirely.
  // `null` means "caller wants to clear this" → write null.
  const update: Record<string, unknown> = {
    status: input.status,
    instrument: input.instrument,
    direction: input.direction,
    entryPrice: input.entryPrice,
    initialUnits: input.initialUnits,
    currentUnits: input.currentUnits,
    openedAt: input.openedAt,
  }
  if (input.orderType !== undefined) update.orderType = input.orderType
  if (input.exitPrice !== undefined) update.exitPrice = input.exitPrice
  if (input.stopLoss !== undefined) update.stopLoss = input.stopLoss
  if (input.takeProfit !== undefined) update.takeProfit = input.takeProfit
  if (input.trailingStopDistance !== undefined)
    update.trailingStopDistance = input.trailingStopDistance
  if (input.realizedPL !== undefined) update.realizedPL = input.realizedPL
  if (input.unrealizedPL !== undefined) update.unrealizedPL = input.unrealizedPL
  if (input.financing !== undefined) update.financing = input.financing
  if (input.closeReason !== undefined) update.closeReason = input.closeReason
  if (input.timeInForce !== undefined) update.timeInForce = input.timeInForce
  if (input.gtdTime !== undefined) update.gtdTime = input.gtdTime
  if (input.metadata !== undefined) update.metadata = input.metadata
  if (input.closedAt !== undefined) update.closedAt = input.closedAt

  return db.trade.upsert({
    where,
    create: {
      source: input.source,
      sourceTradeId: input.sourceTradeId,
      status: input.status,
      instrument: input.instrument,
      direction: input.direction,
      orderType: input.orderType ?? null,
      entryPrice: input.entryPrice,
      exitPrice: input.exitPrice ?? null,
      stopLoss: input.stopLoss ?? null,
      takeProfit: input.takeProfit ?? null,
      trailingStopDistance: input.trailingStopDistance ?? null,
      initialUnits: input.initialUnits,
      currentUnits: input.currentUnits,
      realizedPL: input.realizedPL ?? 0,
      unrealizedPL: input.unrealizedPL ?? 0,
      financing: input.financing ?? 0,
      closeReason: input.closeReason ?? null,
      timeInForce: input.timeInForce ?? null,
      gtdTime: input.gtdTime ?? null,
      mfe: input.mfe ?? null,
      mae: input.mae ?? null,
      metadata: input.metadata ?? null,
      openedAt: input.openedAt,
      closedAt: input.closedAt ?? null,
    },
    update,
  })
}

/** Close a trade by source and sourceTradeId. */
export async function closeTrade(
  source: TradeSource,
  sourceTradeId: string,
  data: CloseTradeInput,
) {
  return db.trade.update({
    where: { source_sourceTradeId: { source, sourceTradeId } },
    data: {
      status: "closed",
      exitPrice: data.exitPrice,
      closeReason: data.closeReason,
      realizedPL: data.realizedPL,
      financing: data.financing,
      mfe: data.mfe ?? undefined,
      mae: data.mae ?? undefined,
      closedAt: data.closedAt,
    },
  })
}

/**
 * When a pending order fills on OANDA, the order disappears and a new trade
 * appears with a DIFFERENT sourceTradeId. This function detects filled orders
 * and migrates the DB record to the new sourceTradeId, preserving all user data
 * (tags, notes, metadata, analyses, conditions, events).
 *
 * Must be called BEFORE removeStalePendingOrders.
 */
export async function migrateFilledPendingOrders(
  source: string,
  activePendingSourceIds: string[],
  openTradeSourceIds: Array<{ sourceTradeId: string; instrument: string; direction: string }>,
): Promise<number> {
  if (openTradeSourceIds.length === 0) return 0

  // Find pending orders that are no longer active (just filled or cancelled)
  const stalePending = await db.trade.findMany({
    where: {
      source,
      status: "pending",
      ...(activePendingSourceIds.length > 0
        ? { sourceTradeId: { notIn: activePendingSourceIds } }
        : {}),
    },
    select: { id: true, sourceTradeId: true, instrument: true, direction: true },
  })

  if (stalePending.length === 0) return 0

  // Check which open trades already have a DB record (don't need migration)
  const tradeSourceIds = openTradeSourceIds.map((t) => t.sourceTradeId)
  const existingRecords = await db.trade.findMany({
    where: { source, sourceTradeId: { in: tradeSourceIds } },
    select: { sourceTradeId: true },
  })
  const existingSet = new Set(existingRecords.map((r) => r.sourceTradeId))

  // Open trades without a DB record = likely just-filled orders
  const unmatchedTrades = openTradeSourceIds.filter((t) => !existingSet.has(t.sourceTradeId))

  let migrated = 0
  const remaining = [...stalePending]

  for (const trade of unmatchedTrades) {
    const matchIdx = remaining.findIndex(
      (r) => r.instrument === trade.instrument && r.direction === trade.direction,
    )
    if (matchIdx === -1) continue

    const match = remaining[matchIdx]!
    await db.trade.update({
      where: { id: match.id },
      data: { sourceTradeId: trade.sourceTradeId, status: "open" },
    })
    remaining.splice(matchIdx, 1)
    migrated++
  }

  return migrated
}

/**
 * Soft-close pending orders that are no longer in OANDA's active order list.
 *
 * Previously used deleteMany which CASCADE DELETED all associated data
 * (tags, notes, analyses, conditions, events). Now uses updateMany to
 * preserve all relationships. This prevents data loss when:
 * - An order is replaced (SL/TP modification gives a new order ID)
 * - An order fills (becomes an open trade with a different ID)
 * - An order is cancelled
 */
export async function removeStalePendingOrders(
  activeSourceIds: string[],
  source: TradeSource,
): Promise<number> {
  const result = await db.trade.updateMany({
    where: {
      source,
      status: "pending",
      sourceTradeId: { notIn: activeSourceIds },
    },
    data: {
      status: "closed",
      closeReason: "ORDER_CANCEL",
      closedAt: new Date(),
    },
  })
  return result.count
}

/** Mark orphaned "open" trades as closed (they disappeared from OANDA). */
export async function closeOrphanedTrades(
  source: TradeSource,
  activeSourceIds: string[],
): Promise<number> {
  const result = await db.trade.updateMany({
    where: {
      source,
      status: "open",
      sourceTradeId: { notIn: activeSourceIds },
    },
    data: {
      status: "closed",
      closeReason: "MARKET_ORDER",
      closedAt: new Date(),
    },
  })
  return result.count
}

/**
 * Update a trade's sourceTradeId (used when OANDA replaces a pending order
 * with a new ID during SL/TP modification). Must be called BEFORE reconcile
 * so that removeStalePendingOrders does not soft-close the old record.
 */
export async function updateTradeSourceId(
  source: TradeSource,
  oldSourceTradeId: string,
  newSourceTradeId: string,
): Promise<boolean> {
  try {
    await db.trade.update({
      where: { source_sourceTradeId: { source, sourceTradeId: oldSourceTradeId } },
      data: { sourceTradeId: newSourceTradeId },
    })
    return true
  } catch {
    return false
  }
}

/** Lookup a single trade by source and sourceTradeId. */
export async function getTradeBySourceId(source: TradeSource, sourceTradeId: string) {
  return db.trade.findUnique({
    where: { source_sourceTradeId: { source, sourceTradeId } },
  })
}

/**
 * Get source trade IDs of open trades placed via a specific source (e.g. "ut_bot_alerts").
 * Used for self-healing: rebuilds auto-trade tracking from durable DB metadata
 * when the in-memory Set becomes stale.
 */
export async function getOpenTradeIdsByPlacedVia(placedVia: string): Promise<string[]> {
  const openTrades = await db.trade.findMany({
    where: { status: "open", metadata: { not: null } },
    select: { sourceTradeId: true, metadata: true },
  })

  return openTrades
    .filter((t) => {
      if (!t.metadata) return false
      try {
        const meta = JSON.parse(t.metadata) as Record<string, unknown>
        return meta.placedVia === placedVia
      } catch {
        return false
      }
    })
    .map((t) => t.sourceTradeId)
}

/** List trades with filtering, sorting, and pagination. */
export async function listTrades(opts: ListTradesOptions = {}): Promise<TradeListResponse> {
  const {
    status,
    instrument,
    direction,
    outcome,
    from,
    to,
    sort = "closedAt",
    order = "desc",
    limit = 20,
    offset = 0,
    tagIds,
  } = opts

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (instrument) where.instrument = instrument
  if (direction) where.direction = direction

  // Tag filter: only return trades that have ALL specified tags
  if (tagIds && tagIds.length > 0) {
    where.tags = { some: { tagId: { in: tagIds } } }
  }

  // Outcome filter requires checking realizedPL range
  if (outcome === "win") where.realizedPL = { gt: 0 }
  else if (outcome === "loss") where.realizedPL = { lt: 0 }
  else if (outcome === "breakeven") where.realizedPL = 0

  // Date range filtering
  if (from || to) {
    const dateFilter: Record<string, Date> = {}
    if (from) dateFilter.gte = from
    if (to) dateFilter.lte = to
    where.closedAt = dateFilter
  }

  const [trades, totalCount] = await Promise.all([
    db.trade.findMany({
      where,
      orderBy: { [sort]: order },
      take: limit,
      skip: offset,
      include: { tags: { include: { tag: true } } },
    }),
    db.trade.count({ where }),
  ])

  return {
    trades: trades.map(toClosedTradeData),
    totalCount,
    page: Math.floor(offset / limit) + 1,
    pageSize: limit,
  }
}

/** Get today's closed trades for the WebSocket payload. */
export async function getClosedTradesToday(forexDayStart: Date): Promise<ClosedTradeData[]> {
  const trades = await db.trade.findMany({
    where: {
      status: "closed",
      closedAt: { gte: forexDayStart },
    },
    orderBy: { closedAt: "desc" },
    include: { tags: { include: { tag: true } } },
  })
  return trades.map(toClosedTradeData)
}

/** Update a trade's units and P&L on partial close. */
export async function updateTradePartialClose(
  source: TradeSource,
  sourceTradeId: string,
  newUnits: number,
  partialPL: number,
  partialFinancing: number,
) {
  const existing = await getTradeBySourceId(source, sourceTradeId)
  if (!existing) return null

  return db.trade.update({
    where: { source_sourceTradeId: { source, sourceTradeId } },
    data: {
      currentUnits: newUnits,
      realizedPL: existing.realizedPL + partialPL,
      financing: existing.financing + partialFinancing,
    },
  })
}

/** Update MFE/MAE watermarks (only writes if new value exceeds stored value). */
export async function updateTradeMfeMae(
  source: TradeSource,
  sourceTradeId: string,
  mfe: number,
  mae: number,
) {
  const existing = await getTradeBySourceId(source, sourceTradeId)
  if (!existing) return null

  const newMfe = existing.mfe === null ? mfe : Math.max(existing.mfe, mfe)
  const newMae = existing.mae === null ? mae : Math.min(existing.mae, mae)

  // Only update if values actually changed
  if (newMfe === existing.mfe && newMae === existing.mae) return existing

  return db.trade.update({
    where: { source_sourceTradeId: { source, sourceTradeId } },
    data: { mfe: newMfe, mae: newMae },
  })
}

/** Create an audit trail event for a trade. */
export async function createTradeEvent(input: CreateTradeEventInput) {
  return db.tradeEvent.create({
    data: {
      tradeId: input.tradeId,
      eventType: input.eventType,
      detail: input.detail,
    },
  })
}

/** Update a trade's notes field. */
export async function updateTradeNotes(tradeId: string, notes: string | null) {
  return db.trade.update({
    where: { id: tradeId },
    data: { notes },
  })
}

/** Update a trade's timeframe field. */
export async function updateTradeTimeframe(tradeId: string, timeframe: string | null) {
  return db.trade.update({
    where: { id: tradeId },
    data: { timeframe },
  })
}

/** Update a trade's metadata JSON field. */
export async function updateTradeMetadata(tradeId: string, metadata: string | null) {
  return db.trade.update({
    where: { id: tradeId },
    data: { metadata },
  })
}

/** Append text to a trade's notes field (preserves existing notes). */
export async function appendTradeNotes(tradeId: string, text: string) {
  const trade = await db.trade.findUnique({ where: { id: tradeId }, select: { notes: true } })
  const existing = trade?.notes ?? ""
  const updated = existing ? `${existing}\n${text}` : text
  return db.trade.update({
    where: { id: tradeId },
    data: { notes: updated },
  })
}

/** Delete all closed trades (and their cascaded tags/events). */
export async function deleteClosedTrades() {
  return db.trade.deleteMany({
    where: { status: "closed" },
  })
}

/** Delete a single trade by ID. */
export async function deleteTrade(tradeId: string) {
  return db.trade.delete({
    where: { id: tradeId },
  })
}

/** Get a trade with its tags and events (for the detail drawer). */
export async function getTradeWithDetails(tradeId: string): Promise<TradeDetailData | null> {
  const trade = await db.trade.findUnique({
    where: { id: tradeId },
    include: {
      tags: { include: { tag: true }, orderBy: { tag: { name: "asc" } } },
      events: { orderBy: { createdAt: "desc" } },
    },
  })

  if (!trade) return null

  return {
    id: trade.id,
    source: enrichSource(trade.source, trade.metadata),
    sourceTradeId: trade.sourceTradeId,
    status: trade.status,
    instrument: trade.instrument,
    direction: trade.direction,
    orderType: trade.orderType,
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice,
    stopLoss: trade.stopLoss,
    takeProfit: trade.takeProfit,
    trailingStopDistance: trade.trailingStopDistance,
    initialUnits: trade.initialUnits,
    currentUnits: trade.currentUnits,
    realizedPL: trade.realizedPL,
    unrealizedPL: trade.unrealizedPL,
    financing: trade.financing,
    closeReason: trade.closeReason,
    timeInForce: trade.timeInForce,
    gtdTime: trade.gtdTime,
    mfe: trade.mfe,
    mae: trade.mae,
    notes: trade.notes,
    timeframe: (trade.timeframe as Timeframe) ?? null,
    openedAt: trade.openedAt.toISOString(),
    closedAt: trade.closedAt?.toISOString() ?? null,
    tags: trade.tags.map((tt) => ({
      tagId: tt.tagId,
      tag: { id: tt.tag.id, name: tt.tag.name, color: tt.tag.color },
      assignedAt: tt.assignedAt.toISOString(),
    })),
    events: trade.events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      detail: e.detail,
      createdAt: e.createdAt.toISOString(),
    })),
  }
}
