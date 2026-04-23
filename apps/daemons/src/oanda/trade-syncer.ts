import type {
  PendingOrderData,
  OpenTradeData,
  ClosedTradeData,
  TradeDirection,
  OrderType,
  TradeCloseReason,
  PlaceOrderRequest,
  PlaceOrderResponseData,
  CloseContext,
  TradingMode,
} from "@fxflow/types"

type CloseAttribution = {
  closedBy: NonNullable<CloseContext["closedBy"]>
  closedByLabel: string
  closedByDetail?: string
}
import { getForexDayStart, getDecimalPlaces } from "@fxflow/shared"
import type { StateManager } from "../state-manager.js"
import type { PositionManager } from "../positions/position-manager.js"
import {
  oandaGet,
  oandaPut,
  oandaPost,
  type OandaOrder,
  type OandaOrdersResponse,
  type OandaTrade,
  type OandaTradesResponse,
  type OandaTransactionPagesResponse,
  type OandaTransactionPageResponse,
  type OandaOrderFillTransactionDetailed,
  type OandaTransactionStreamEvent,
  type OandaCreateOrderResponse,
  type OandaCloseTradeResponse,
  type OandaTradeDetailResponse,
} from "./api-client.js"
import {
  enrichSource,
  upsertTrade,
  closeTrade,
  migrateFilledPendingOrders,
  removeStalePendingOrders,
  closeOrphanedTrades,
  getClosedTradesToday,
  updateTradePartialClose,
  updateTradeTimeframe,
  updateTradeSourceId,
  updateTradeNotes,
  updateTradeMetadata,
  appendTradeNotes,
  assignTagToTrade,
  getTagsForTradeIds,
  createTradeEvent,
  getTradeBySourceId,
  updateTradeCloseContext,
  type OrphanCloseDetails,
  type OrphanVerifiedOpen,
  ORPHAN_VERIFIED_OPEN,
} from "@fxflow/db"

export class OandaTradeSyncer {
  private reconcileTimer: ReturnType<typeof setInterval> | null = null
  private abortController: AbortController | null = null
  private hasBackfilled = false

  /** Callback for emitting user-action notifications. Set by daemon wiring. */
  onActionNotification: ((title: string, message: string) => void) | null = null

  /** Lifecycle callbacks — set by daemon wiring for AutoAnalyzer integration */
  onPendingCreated: ((tradeId: string) => void) | null = null
  onOrderFilled: ((tradeId: string, sourceTradeId: string) => void) | null = null
  onTradeClosed: ((tradeId: string) => void) | null = null
  /**
   * Fired on every successful trade mutation (SL/TP change, partial close,
   * unit reduction, open-trade reconciliation that refreshed DB fields).
   * Consumed by ConditionMonitor to invalidate its per-trade snapshot
   * cache so the next tick sees fresh `currentUnits` / `stopLoss` /
   * `direction` without waiting out the TTL. Strictly a cache-bust
   * signal — receivers MUST tolerate extra fires.
   */
  onTradeModified: ((tradeId: string) => void) | null = null

  /** Called before a trade is removed from PositionManager, to persist final MFE/MAE. */
  onTradeClosing: ((sourceTradeId: string) => Promise<void>) | null = null

  /** Track known sourceOrderIds/TradeIds to detect new arrivals */
  private knownPendingSourceIds = new Set<string>()
  private knownOpenSourceIds = new Set<string>()

  /**
   * Idempotency guard for the trade-close pipeline. A single OANDA close
   * event can be observed via TWO independent paths:
   *   1. The transaction stream emits ORDER_FILL with `tradesClosed`.
   *   2. The 2-minute reconcile loop sees the trade missing from OANDA's
   *      open list and marks it orphaned.
   *
   * Before this guard, both paths would: (a) write `closeTrade()` to the DB,
   * (b) append a `TRADE_CLOSED` event, and (c) fire `onTradeClosed` to the
   * condition monitor. The resulting trade event log showed two
   * `TRADE_CLOSED` entries — exactly what the user saw on the April 13
   * ghost-trade analysis. This set dedupes the close pipeline by
   * sourceTradeId so only the first path through wins. It's cleared after
   * 5 minutes to prevent unbounded growth.
   */
  private readonly closingSourceTradeIds = new Set<string>()

  /**
   * Record a sourceTradeId as "currently closing". Returns true if this is
   * the first time we've seen it (the caller should proceed), false if
   * another path is already handling it (the caller should no-op).
   */
  private markClosing(sourceTradeId: string): boolean {
    if (this.closingSourceTradeIds.has(sourceTradeId)) return false
    this.closingSourceTradeIds.add(sourceTradeId)
    // Auto-clear after 5 minutes so the set doesn't grow forever on long
    // sessions. By then the trade is fully reconciled and any late-arriving
    // duplicate would be caught by the DB status check anyway.
    setTimeout(() => this.closingSourceTradeIds.delete(sourceTradeId), 5 * 60_000).unref?.()
    return true
  }

  /** Prevent concurrent reconcile calls from racing */
  private reconcileInProgress = false

  /** Per-instrument mutex: serializes DB upserts for the same instrument */
  private instrumentMutex = new Map<string, Promise<void>>()

  constructor(
    private stateManager: StateManager,
    private positionManager: PositionManager,
    private config: {
      reconcileIntervalMs: number
      backfillDays: number
    },
  ) {
    stateManager.onCredentialChange((creds) => {
      this.stop()
      if (creds) {
        this.hasBackfilled = false
        void this.startSync()
      }
    })
  }

  start(): void {
    const creds = this.stateManager.getCredentials()
    if (creds) void this.startSync()
  }

  stop(): void {
    if (this.reconcileTimer) {
      clearInterval(this.reconcileTimer)
      this.reconcileTimer = null
    }
    this.abortController?.abort()
    this.abortController = null
  }

  /** Called by TransactionStreamClient on trade-relevant events. */
  async handleTransactionEvent(event: OandaTransactionStreamEvent): Promise<void> {
    try {
      if (event.type === "ORDER_FILL") {
        // Trigger a reconciliation to pick up the change
        await this.reconcile()
      } else if (event.type === "ORDER_CANCEL") {
        await this.reconcile()
      } else if (
        event.type === "STOP_LOSS_ORDER" ||
        event.type === "TAKE_PROFIT_ORDER" ||
        event.type === "TRAILING_STOP_LOSS_ORDER"
      ) {
        // SL/TP/TSL modification — reconcile to pick up changes
        await this.reconcile()
      }
    } catch (error) {
      console.error("[trade-syncer] Event handling error:", (error as Error).message)
    }
  }

  // ─── Trade Actions ─────────────────────────────────────────────────────────

  /** Trigger a position refresh (public wrapper around reconcile). */
  async refreshPositions(): Promise<void> {
    await this.reconcile()
  }

  /** Cancel a pending order on OANDA. Gracefully handles ORDER_DOESNT_EXIST (404). */
  async cancelOrder(
    sourceOrderId: string,
    reason?: string,
    cancelledBy: "user" | "trade_finder" | "ai_condition" = "user",
  ): Promise<void> {
    const creds = this.stateManager.getCredentials()
    if (!creds) throw new Error("No credentials configured")

    // Look up order info for notification
    const order = this.positionManager
      .getPositions()
      .pending.find((o) => o.sourceOrderId === sourceOrderId)

    let alreadyCancelled = false
    try {
      await oandaPut({
        mode: creds.mode,
        token: creds.token,
        path: `/v3/accounts/${creds.accountId}/orders/${sourceOrderId}/cancel`,
      })
    } catch (err) {
      const msg = (err as Error).message
      // ORDER_DOESNT_EXIST: order was already filled or cancelled in OANDA.
      // Treat as success and force a reconcile to remove the stale local state.
      if (msg.includes("ORDER_DOESNT_EXIST") || (msg.includes("404") && msg.includes("order"))) {
        alreadyCancelled = true
        console.warn(
          `[cancelOrder] Order ${sourceOrderId} not found in OANDA (already cancelled/filled). Reconciling.`,
        )
      } else {
        throw err
      }
    }

    if (order) {
      const pair = order.instrument.replace("_", "/")
      const dir = order.direction === "long" ? "Long" : "Short"
      const title = alreadyCancelled ? "Order Synced" : "Order Cancelled"
      const label = alreadyCancelled
        ? `${pair} ${dir} order was already gone in OANDA — syncing state`
        : `${pair} ${dir} ${order.orderType} order cancelled`
      this.onActionNotification?.(title, label)

      // Audit trail — non-critical; DB timeouts must not fail the cancel action
      try {
        const dbTrade = await getTradeBySourceId("oanda", sourceOrderId)
        if (dbTrade) {
          const now = new Date().toISOString()
          await createTradeEvent({
            tradeId: dbTrade.id,
            eventType: "ORDER_CANCELLED",
            detail: JSON.stringify({
              cancelledBy,
              reason: reason ?? null,
              alreadyCancelled,
              time: now,
            }),
          })
          // Store cancellation context so removeStalePendingOrders preserves it
          await updateTradeCloseContext(
            dbTrade.id,
            JSON.stringify({
              cancelledBy,
              cancelReason: reason ?? null,
              cancelledAt: now,
            }),
          )
          if (reason) await appendTradeNotes(dbTrade.id, `Cancelled: ${reason}`)
        }
      } catch (dbErr) {
        console.warn(
          "[cancelOrder] DB audit trail failed (non-critical):",
          (dbErr as Error).message,
        )
      }
    }

    // Always reconcile — removes stale pending orders from local state
    await this.reconcile()
  }

  /** Cancel all pending orders (or a specific subset). Single reconcile at the end. */
  async cancelAllOrders(
    sourceOrderIds?: string[],
    reason?: string,
  ): Promise<{ succeeded: number; failed: number; errors: string[] }> {
    const creds = this.stateManager.getCredentials()
    if (!creds) throw new Error("No credentials configured")

    const pending = this.positionManager.getPositions().pending
    const targets = sourceOrderIds
      ? pending.filter((o) => sourceOrderIds.includes(o.sourceOrderId))
      : pending

    let succeeded = 0
    let failed = 0
    const errors: string[] = []

    for (const order of targets) {
      try {
        let alreadyCancelled = false
        try {
          await oandaPut({
            mode: creds.mode,
            token: creds.token,
            path: `/v3/accounts/${creds.accountId}/orders/${order.sourceOrderId}/cancel`,
          })
        } catch (err) {
          const msg = (err as Error).message
          if (
            msg.includes("ORDER_DOESNT_EXIST") ||
            (msg.includes("404") && msg.includes("order"))
          ) {
            alreadyCancelled = true
          } else {
            throw err
          }
        }

        // Audit trail (non-critical)
        try {
          const dbTrade = await getTradeBySourceId("oanda", order.sourceOrderId)
          if (dbTrade) {
            await createTradeEvent({
              tradeId: dbTrade.id,
              eventType: "ORDER_CANCELLED",
              detail: JSON.stringify({
                cancelledBy: "user_bulk",
                reason: reason ?? null,
                alreadyCancelled,
                time: new Date().toISOString(),
              }),
            })
            if (reason) await appendTradeNotes(dbTrade.id, `Bulk Cancel Reason: ${reason}`)
          }
        } catch (dbErr) {
          console.warn(
            `[cancelAllOrders] DB audit for ${order.sourceOrderId} failed (non-critical):`,
            (dbErr as Error).message,
          )
        }

        succeeded++
      } catch (err) {
        failed++
        errors.push(`${order.instrument}: ${(err as Error).message}`)
      }
    }

    const summary =
      failed === 0
        ? `${succeeded} ${succeeded === 1 ? "order" : "orders"} cancelled`
        : `${succeeded} cancelled, ${failed} failed`
    this.onActionNotification?.("Bulk Cancel", summary)

    // Directly remove stale pending orders from DB. Prevents race condition
    // where a concurrent periodic reconcile upserts orders back to "pending"
    // after OANDA cancellation, and the subsequent reconcile() gets skipped
    // by the mutex guard.
    if (succeeded > 0) {
      try {
        const remainingActiveIds = sourceOrderIds
          ? pending
              .filter((o) => !targets.some((tgt) => tgt.sourceOrderId === o.sourceOrderId))
              .map((o) => o.sourceOrderId)
          : [] // cancelling all → no active orders remain
        await removeStalePendingOrders(remainingActiveIds, "oanda")
      } catch (err) {
        console.warn("[cancelAllOrders] stale order cleanup failed:", (err as Error).message)
      }
    }

    if (targets.length > 0) await this.reconcile()

    return { succeeded, failed, errors }
  }

  /** Close all open trades (or a specific subset). Single reconcile at the end. */
  async closeAllTrades(
    sourceTradeIds?: string[],
    reason?: string,
  ): Promise<{ succeeded: number; failed: number; errors: string[] }> {
    const creds = this.stateManager.getCredentials()
    if (!creds) throw new Error("No credentials configured")

    // Use both positionManager (fast, in-memory) and fall back to stateManager
    // to ensure we have the most current list of open trades.
    const posManagerOpen = this.positionManager.getPositions().open
    const stateManagerOpen = this.stateManager.getPositions()?.open ?? []
    // Merge: prefer positionManager but supplement with stateManager entries not already present
    const posSourceIds = new Set(posManagerOpen.map((t) => t.sourceTradeId))
    const merged = [
      ...posManagerOpen,
      ...stateManagerOpen.filter((t) => !posSourceIds.has(t.sourceTradeId)),
    ]
    const open = merged

    if (open.length === 0) {
      console.warn("[closeAllTrades] No open trades found in position manager — nothing to close")
      return { succeeded: 0, failed: 0, errors: ["No open trades found"] }
    }

    const targets = sourceTradeIds
      ? open.filter((t) => sourceTradeIds.includes(t.sourceTradeId))
      : open

    let succeeded = 0
    let failed = 0
    const errors: string[] = []

    for (const trade of targets) {
      // Stamp attribution BEFORE the OANDA call so the reconcile path
      // preserves it (see the single-trade closeTrade() above for why).
      try {
        const dbRow = await getTradeBySourceId("oanda", trade.sourceTradeId)
        if (dbRow) {
          let existing: Record<string, unknown> = {}
          if (dbRow.closeContext) {
            try {
              existing = JSON.parse(dbRow.closeContext) as Record<string, unknown>
            } catch {
              existing = {}
            }
          }
          await updateTradeCloseContext(
            dbRow.id,
            JSON.stringify({
              ...existing,
              closedBy: "user",
              closedByLabel: "Manual Close (Bulk)",
              closedByDetail: reason ?? "Bulk close all trades",
              closedAtInitiated: new Date().toISOString(),
            }),
          )
        }
      } catch {
        /* non-critical */
      }

      try {
        const closeResp = await oandaPut<OandaCloseTradeResponse>({
          mode: creds.mode,
          token: creds.token,
          path: `/v3/accounts/${creds.accountId}/trades/${trade.sourceTradeId}/close`,
          body: { units: "ALL" },
        })

        // Persist close immediately
        const fillTxn = closeResp.orderFillTransaction
        if (fillTxn?.tradesClosed) {
          for (const closed of fillTxn.tradesClosed) {
            try {
              await closeTrade("oanda", closed.tradeID, {
                exitPrice: parseFloat(closed.price ?? "0") || null,
                closeReason: "MARKET_ORDER",
                realizedPL: parseFloat(closed.realizedPL) || 0,
                financing: parseFloat(closed.financing ?? "0") || 0,
                closedAt: new Date(fillTxn.time),
              })
            } catch {
              /* may not be in DB yet */
            }
          }
        }

        // Audit trail (non-critical)
        try {
          const dbTrade = await getTradeBySourceId("oanda", trade.sourceTradeId)
          if (dbTrade) {
            await createTradeEvent({
              tradeId: dbTrade.id,
              eventType: "TRADE_CLOSED",
              detail: JSON.stringify({
                closedBy: "user_bulk",
                units: "ALL",
                reason: reason ?? null,
                time: new Date().toISOString(),
              }),
            })
            if (reason) await appendTradeNotes(dbTrade.id, `Bulk Close Reason: ${reason}`)
            this.knownOpenSourceIds.delete(trade.sourceTradeId)
            // Dedupe: only emit onTradeClosed once, regardless of whether
            // the orphan sweep or this direct path sees the close first.
            if (this.markClosing(trade.sourceTradeId)) {
              this.onTradeClosed?.(dbTrade.id)
            }
          }
        } catch (dbErr) {
          console.warn(
            `[closeAllTrades] DB audit for ${trade.sourceTradeId} failed (non-critical):`,
            (dbErr as Error).message,
          )
        }

        succeeded++
      } catch (err) {
        failed++
        errors.push(`${trade.instrument}: ${(err as Error).message}`)
      }
    }

    const summary =
      failed === 0
        ? `${succeeded} ${succeeded === 1 ? "trade" : "trades"} closed`
        : `${succeeded} closed, ${failed} failed`
    this.onActionNotification?.("Bulk Close", summary)

    // Directly mark orphaned trades in DB as closed. This prevents the race
    // condition where a concurrent periodic reconcile upserts trades back to
    // "open" after closeTrade() already set them to "closed", and the
    // subsequent reconcile() call below gets skipped by the mutex guard.
    if (succeeded > 0) {
      try {
        const remainingActiveIds = sourceTradeIds
          ? open
              .filter((t) => !targets.some((tgt) => tgt.sourceTradeId === t.sourceTradeId))
              .map((t) => t.sourceTradeId)
          : [] // closing all → no active trades remain
        await closeOrphanedTrades("oanda", remainingActiveIds)
      } catch (err) {
        console.warn("[closeAllTrades] orphan cleanup failed:", (err as Error).message)
      }
    }

    if (targets.length > 0) await this.reconcile()

    return { succeeded, failed, errors }
  }

  /** Modify a pending order by replacing it. Supports SL, TP, entry price, and GTD time. */
  async modifyPendingOrderSLTP(
    sourceOrderId: string,
    stopLoss?: number | null,
    takeProfit?: number | null,
    entryPrice?: number,
    gtdTime?: string | null,
  ): Promise<{
    stopLoss: number | null
    takeProfit: number | null
    entryPrice: number
    gtdTime: string | null
  }> {
    const creds = this.stateManager.getCredentials()
    if (!creds) throw new Error("No credentials configured")

    const order = this.positionManager
      .getPositions()
      .pending.find((o) => o.sourceOrderId === sourceOrderId)
    if (!order) throw new Error("Pending order not found")

    const decimals = getDecimalPlaces(order.instrument)
    const units = order.direction === "short" ? -order.units : order.units

    // Build replacement order body
    const newEntryPrice = entryPrice ?? order.entryPrice
    const newGtdTime = gtdTime !== undefined ? gtdTime : order.gtdTime
    const newTimeInForce = newGtdTime ? "GTD" : gtdTime === null ? "GTC" : order.timeInForce

    const orderBody: Record<string, unknown> = {
      type: order.orderType,
      instrument: order.instrument,
      units: String(units),
      price: newEntryPrice.toFixed(decimals),
      timeInForce: newTimeInForce,
    }

    if (newTimeInForce === "GTD" && newGtdTime) {
      orderBody.gtdTime = newGtdTime
    }

    // Resolve SL: undefined = keep current, null = remove, number = set
    const newSL = stopLoss !== undefined ? stopLoss : order.stopLoss
    if (newSL !== null) {
      orderBody.stopLossOnFill = { price: newSL.toFixed(decimals), timeInForce: "GTC" }
    }

    const newTP = takeProfit !== undefined ? takeProfit : order.takeProfit
    if (newTP !== null) {
      orderBody.takeProfitOnFill = { price: newTP.toFixed(decimals), timeInForce: "GTC" }
    }

    if (order.trailingStopDistance !== null) {
      orderBody.trailingStopLossOnFill = {
        distance: order.trailingStopDistance.toString(),
        timeInForce: "GTC",
      }
    }

    // Replace order on OANDA — capture response to get the new order ID
    const replaceResp = await oandaPut<{
      orderCreateTransaction?: { id: string }
      orderCancelTransaction?: { orderID: string }
    }>({
      mode: creds.mode,
      token: creds.token,
      path: `/v3/accounts/${creds.accountId}/orders/${sourceOrderId}`,
      body: { order: orderBody },
    })

    // Update DB record's sourceTradeId BEFORE reconcile to prevent
    // removeStalePendingOrders from soft-closing the old record.
    // This preserves all associated data (tags, notes, metadata, analyses, conditions).
    const newOrderId = replaceResp.orderCreateTransaction?.id
    if (newOrderId && newOrderId !== sourceOrderId) {
      const updated = await updateTradeSourceId("oanda", sourceOrderId, newOrderId)
      if (updated) {
        console.log(
          `[trade-syncer] Order replaced: ${sourceOrderId} → ${newOrderId} (DB record preserved)`,
        )
      }
    }

    // Reconcile to sync the updated order data
    await this.reconcile()

    // Find the replacement order by new source ID or by matching properties
    const positions = this.positionManager.getPositions()
    const replacement = newOrderId
      ? positions.pending.find((o) => o.sourceOrderId === newOrderId)
      : positions.pending.find(
          (o) =>
            o.instrument === order.instrument &&
            o.direction === order.direction &&
            o.entryPrice.toFixed(decimals) === newEntryPrice.toFixed(decimals),
        )

    const verifiedSL = replacement?.stopLoss ?? newSL
    const verifiedTP = replacement?.takeProfit ?? newTP
    const verifiedEntry = replacement?.entryPrice ?? newEntryPrice
    const verifiedGtd = replacement?.gtdTime ?? newGtdTime

    // Log event
    const dbTrade = await getTradeBySourceId("oanda", replacement?.sourceOrderId ?? sourceOrderId)
    if (dbTrade) {
      const detail: Record<string, unknown> = {
        modifiedBy: "user",
        time: new Date().toISOString(),
      }
      if (stopLoss !== undefined) {
        detail.oldSL = order.stopLoss
        detail.newSL = verifiedSL
      }
      if (takeProfit !== undefined) {
        detail.oldTP = order.takeProfit
        detail.newTP = verifiedTP
      }
      if (entryPrice !== undefined) {
        detail.oldEntry = order.entryPrice
        detail.newEntry = verifiedEntry
      }
      if (gtdTime !== undefined) {
        detail.oldGtd = order.gtdTime
        detail.newGtd = verifiedGtd
      }

      await createTradeEvent({
        tradeId: dbTrade.id,
        eventType:
          entryPrice !== undefined || gtdTime !== undefined ? "ORDER_MODIFIED" : "SL_TP_MODIFIED",
        detail: JSON.stringify(detail),
      })
    }

    const pair = order.instrument.replace("_", "/")
    const changes: string[] = []
    if (stopLoss !== undefined) {
      changes.push(
        stopLoss !== null ? `SL: ${order.stopLoss ?? "none"} → ${verifiedSL}` : "SL removed",
      )
    }
    if (takeProfit !== undefined) {
      changes.push(
        takeProfit !== null ? `TP: ${order.takeProfit ?? "none"} → ${verifiedTP}` : "TP removed",
      )
    }
    if (entryPrice !== undefined) {
      changes.push(`Entry: ${order.entryPrice} → ${verifiedEntry}`)
    }
    if (gtdTime !== undefined) {
      changes.push(gtdTime !== null ? `Expiry: ${verifiedGtd}` : "Expiry removed (GTC)")
    }
    this.onActionNotification?.("Order Modified", `${pair} — ${changes.join(", ")}`)

    return {
      stopLoss: verifiedSL,
      takeProfit: verifiedTP,
      entryPrice: verifiedEntry,
      gtdTime: verifiedGtd,
    }
  }

  /**
   * Close a trade on OANDA (full or partial).
   *
   * `attribution` identifies which subsystem initiated the close. It's
   * written to `Trade.closeContext` BEFORE the OANDA API call so the
   * subsequent reconcile path (which may run on a different tick than the
   * reply) doesn't clobber it. Without attribution the UI shows every
   * system-triggered market close as "Manual", indistinguishable from the
   * user clicking Close Trade — which is the bug this plumbing fixes.
   *
   * Callers that omit attribution are assumed to be user-initiated (legacy
   * web API path). Internal subsystems (condition monitor, smart flow,
   * trade finder, AI trader, TV alerts) MUST pass attribution.
   */
  async closeTrade(
    sourceTradeId: string,
    units?: number,
    reason?: string,
    attribution?: CloseAttribution,
  ): Promise<void> {
    const creds = this.stateManager.getCredentials()
    if (!creds) throw new Error("No credentials configured")

    // Look up trade info for notification
    const trade = this.positionManager
      .getPositions()
      .open.find((t) => t.sourceTradeId === sourceTradeId)

    // Persist attribution BEFORE the OANDA call so reconcile picks it up.
    // Write into `Trade.closeContext` while merging with any existing
    // context (e.g. an earlier AI breakeven move that also stamped a
    // context blob — we want to preserve breakeven metadata AND add the
    // new closedBy fields).
    const effectiveAttribution = attribution ?? {
      closedBy: "user" as const,
      closedByLabel: "Manual Close",
    }
    try {
      const dbRow = await getTradeBySourceId("oanda", sourceTradeId)
      if (dbRow) {
        let existing: Record<string, unknown> = {}
        if (dbRow.closeContext) {
          try {
            existing = JSON.parse(dbRow.closeContext) as Record<string, unknown>
          } catch {
            existing = {}
          }
        }
        await updateTradeCloseContext(
          dbRow.id,
          JSON.stringify({
            ...existing,
            closedBy: effectiveAttribution.closedBy,
            closedByLabel: effectiveAttribution.closedByLabel,
            ...(effectiveAttribution.closedByDetail
              ? { closedByDetail: effectiveAttribution.closedByDetail }
              : {}),
            closedAtInitiated: new Date().toISOString(),
          }),
        )
      }
    } catch (preErr) {
      // Non-critical: we still want the close to go through even if the
      // attribution write fails. Worst case the badge shows "Manual".
      console.warn(
        "[closeTrade] Failed to persist close attribution (non-critical):",
        (preErr as Error).message,
      )
    }

    const body: Record<string, string> = {}
    if (units !== undefined) {
      // Partial close: OANDA expects units as a string, negative for short direction
      const signedUnits = trade?.direction === "short" ? -units : units
      body.units = String(signedUnits)
    } else {
      body.units = "ALL"
    }

    const closeResp = await oandaPut<OandaCloseTradeResponse>({
      mode: creds.mode,
      token: creds.token,
      path: `/v3/accounts/${creds.accountId}/trades/${sourceTradeId}/close`,
      body,
    })

    // Persist the close to DB immediately (don't rely on backfill)
    const fillTxn = closeResp.orderFillTransaction
    if (fillTxn) {
      if (fillTxn.tradesClosed) {
        for (const closed of fillTxn.tradesClosed) {
          try {
            await closeTrade("oanda", closed.tradeID, {
              exitPrice: parseFloat(closed.price ?? "0") || null,
              closeReason: (reason ?? "MARKET_ORDER") as TradeCloseReason,
              realizedPL: parseFloat(closed.realizedPL) || 0,
              financing: parseFloat(closed.financing ?? "0") || 0,
              closedAt: new Date(fillTxn.time),
            })
          } catch {
            // Trade might not exist in DB yet
          }
        }
      }
      if (fillTxn.tradesReduced) {
        for (const reduced of fillTxn.tradesReduced) {
          const existing = await getTradeBySourceId("oanda", reduced.tradeID)
          if (existing) {
            const newUnits = Math.abs(parseFloat(reduced.units))
            await updateTradePartialClose(
              "oanda",
              reduced.tradeID,
              existing.currentUnits - newUnits,
              parseFloat(reduced.realizedPL) || 0,
              parseFloat(reduced.financing ?? "0") || 0,
            )
          }
        }
      }
    }

    if (trade) {
      const pair = trade.instrument.replace("_", "/")
      const dir = trade.direction === "long" ? "Long" : "Short"
      const label = units ? `Partial close (${units} units)` : "Closed"
      this.onActionNotification?.("Trade Closed", `${pair} ${dir} — ${label}`)

      // Audit trail — non-critical; DB timeouts must not fail the close action
      try {
        const dbTrade = await getTradeBySourceId("oanda", sourceTradeId)
        if (dbTrade) {
          await createTradeEvent({
            tradeId: dbTrade.id,
            eventType: units ? "PARTIAL_CLOSE" : "TRADE_CLOSED",
            detail: JSON.stringify({
              closedBy: effectiveAttribution.closedBy,
              closedByLabel: effectiveAttribution.closedByLabel,
              closedByDetail: effectiveAttribution.closedByDetail ?? null,
              units: units ?? "ALL",
              reason: reason ?? null,
              time: new Date().toISOString(),
            }),
          })
          if (reason) await appendTradeNotes(dbTrade.id, `Closed Reason: ${reason}`)
          if (!units) {
            this.knownOpenSourceIds.delete(sourceTradeId)
            if (this.markClosing(sourceTradeId)) {
              this.onTradeClosed?.(dbTrade.id)
            }
          } else {
            // Partial close — trade still open but currentUnits changed.
            // Bust the ConditionMonitor snapshot cache so the next tick
            // sees the new unit count (the zero-units guard above depends
            // on this being accurate).
            this.onTradeModified?.(dbTrade.id)
          }
        }
      } catch (dbErr) {
        console.warn("[closeTrade] DB audit trail failed (non-critical):", (dbErr as Error).message)
      }
    }

    await this.reconcile()
  }

  /** Place a new order (market or limit) on OANDA. */
  async placeOrder(request: PlaceOrderRequest): Promise<PlaceOrderResponseData> {
    const creds = this.stateManager.getCredentials()
    if (!creds) throw new Error("No credentials configured")

    const {
      instrument,
      direction,
      orderType,
      units,
      entryPrice,
      stopLoss,
      takeProfit,
      timeframe,
      notes,
      tagIds,
      placedVia = "fxflow",
    } = request
    const decimals = getDecimalPlaces(instrument)

    // OANDA expects negative units for short
    const signedUnits = direction === "short" ? -units : units

    // Build OANDA order body
    const orderBody: Record<string, unknown> = {
      type: orderType,
      instrument,
      units: String(signedUnits),
    }

    if (orderType === "MARKET") {
      orderBody.timeInForce = "FOK"
    } else if (orderType === "LIMIT") {
      if (entryPrice === undefined) throw new Error("entryPrice required for LIMIT orders")
      orderBody.price = entryPrice.toFixed(decimals)
      orderBody.timeInForce = "GTC"
    }

    // Validate SL/TP are on the correct side of entry and not equal after rounding.
    // For MARKET orders, entryPrice is unknown pre-fill — skip pre-validation
    // (OANDA will reject invalid SL/TP server-side, and our calculateSLTPForSignal
    // already computed them from the live bid/ask).
    const effectiveEntry = entryPrice ?? null
    if (stopLoss !== null) {
      const slRounded = stopLoss.toFixed(decimals)
      // Pre-validate SL side only when we know the entry price (LIMIT orders).
      // For MARKET orders, effectiveEntry is null — OANDA validates server-side.
      if (effectiveEntry !== null) {
        const entryRounded = effectiveEntry.toFixed(decimals)
        if (slRounded === entryRounded) {
          throw new Error(
            `SL (${slRounded}) equals entry (${entryRounded}) after rounding — order would be unprotected`,
          )
        }
        if (direction === "long" && stopLoss >= effectiveEntry) {
          throw new Error(
            `SL (${stopLoss}) must be below entry (${effectiveEntry}) for long trades`,
          )
        }
        if (direction === "short" && stopLoss <= effectiveEntry) {
          throw new Error(
            `SL (${stopLoss}) must be above entry (${effectiveEntry}) for short trades`,
          )
        }
      }
      orderBody.stopLossOnFill = { price: slRounded, timeInForce: "GTC" }
    }

    if (takeProfit !== null) {
      const tpRounded = takeProfit.toFixed(decimals)
      if (effectiveEntry !== null) {
        const entryRounded = effectiveEntry.toFixed(decimals)
        if (tpRounded === entryRounded) {
          throw new Error(
            `TP (${tpRounded}) equals entry (${entryRounded}) after rounding — no profit potential`,
          )
        }
        if (direction === "long" && takeProfit <= effectiveEntry) {
          throw new Error(
            `TP (${takeProfit}) must be above entry (${effectiveEntry}) for long trades`,
          )
        }
        if (direction === "short" && takeProfit >= effectiveEntry) {
          throw new Error(
            `TP (${takeProfit}) must be below entry (${effectiveEntry}) for short trades`,
          )
        }
      }
      orderBody.takeProfitOnFill = { price: tpRounded, timeInForce: "GTC" }
    }

    // POST to OANDA
    const response = await oandaPost<OandaCreateOrderResponse>({
      mode: creds.mode,
      token: creds.token,
      path: `/v3/accounts/${creds.accountId}/orders`,
      body: { order: orderBody },
    })

    // Check for order rejection
    if (response.orderCancelTransaction) {
      throw new Error(`Order rejected: ${response.orderCancelTransaction.reason}`)
    }

    // Determine result
    const filled = response.orderFillTransaction != null
    const sourceId = filled
      ? (response.orderFillTransaction!.tradeOpened?.tradeID ?? response.orderFillTransaction!.id)
      : (response.orderCreateTransaction?.id ?? "")
    const fillPrice = filled ? parseFloat(response.orderFillTransaction!.price) : undefined

    // Notification
    const pair = instrument.replace("_", "/")
    const dir = direction === "long" ? "Long" : "Short"
    if (filled) {
      this.onActionNotification?.(
        "Order Filled",
        `${pair} ${dir} Market — ${units} units @ ${fillPrice}`,
      )
    } else {
      this.onActionNotification?.(
        "Order Placed",
        `${pair} ${dir} Limit — ${units} units @ ${entryPrice}`,
      )
    }

    // For MARKET orders that filled immediately, the sourceId is a correct trade ID
    // (from orderFillTransaction.tradeOpened.tradeID). We can safely pre-seed.
    // For unfilled LIMIT orders, sourceId is a TRANSACTION ID (orderCreateTransaction.id)
    // which differs from the actual order ID in OANDA's GET /orders response.
    // Pre-seeding with the wrong ID would cause removeStalePendingOrders to cancel it.
    const metadata = JSON.stringify({ placedVia })
    let dbTrade: Awaited<ReturnType<typeof upsertTrade>> | null = null

    if (filled) {
      // Market fills: sourceId is the correct trade ID — safe to pre-seed
      dbTrade = await upsertTrade({
        account: creds.mode,
        source: "oanda",
        sourceTradeId: sourceId,
        status: "open",
        instrument,
        direction,
        orderType,
        entryPrice: fillPrice ?? entryPrice ?? 0,
        initialUnits: units,
        currentUnits: units,
        openedAt: new Date(),
        metadata,
      })
      console.log(
        `[placeOrder] Pre-seeded filled trade: id=${dbTrade.id}, sourceId=${sourceId}, placedVia=${placedVia}`,
      )
    }

    // Reconcile to sync the canonical OANDA state into DB.
    // For LIMIT orders this creates the DB record with the correct order ID.
    await this.reconcile()

    // Find the DB record. For filled orders, re-fetch the pre-seeded record.
    // For LIMIT orders, find by instrument + direction since we don't know the real order ID yet.
    if (filled) {
      const refreshed = await getTradeBySourceId("oanda", sourceId)
      if (refreshed) dbTrade = refreshed
    } else {
      // LIMIT order: try direct sourceTradeId match first (orderCreateTransaction.id
      // should equal the order ID in OANDA's GET /orders response).
      dbTrade = await getTradeBySourceId("oanda", sourceId)
      if (dbTrade) {
        console.log(
          `[placeOrder] Found LIMIT order by sourceTradeId: id=${dbTrade.id}, sourceTradeId=${sourceId}`,
        )
      } else {
        // Fallback: fuzzy match by instrument + direction + recent timestamp.
        // Exclude records with existing metadata to avoid tagging the wrong order.
        const { db: prisma } = await import("@fxflow/db")
        const recent = await prisma.trade.findFirst({
          where: {
            source: "oanda",
            instrument,
            direction,
            status: "pending",
            metadata: null,
            openedAt: { gte: new Date(Date.now() - 60_000) },
          },
          orderBy: { openedAt: "desc" },
        })
        if (recent) {
          dbTrade = recent
          console.log(
            `[placeOrder] Found LIMIT order by fuzzy match: id=${recent.id}, sourceTradeId=${recent.sourceTradeId}`,
          )
        }
      }
    }

    // Set metadata on the correct record (post-reconcile for LIMIT orders)
    if (dbTrade) {
      try {
        const { db: prisma } = await import("@fxflow/db")
        await prisma.trade.update({
          where: { id: dbTrade.id },
          data: { metadata },
        })
        console.log(`[placeOrder] Metadata set: trade=${dbTrade.id}, placedVia=${placedVia}`)
      } catch (metaErr) {
        console.error(
          `[placeOrder] FAILED to set metadata for ${dbTrade?.id}:`,
          (metaErr as Error).message,
        )
      }
    } else {
      console.error(
        `[placeOrder] NO DB RECORD FOUND — metadata not set for ${instrument} ${direction} (sourceId=${sourceId}, placedVia=${placedVia})`,
      )
    }

    // Re-reconcile so the WS broadcast picks up the record with metadata
    await this.reconcile()

    // Create audit event and persist timeframe, notes, tags (best-effort)
    try {
      if (!dbTrade) {
        // Try sourceId first (works for filled MARKET orders), then fallback
        dbTrade = await getTradeBySourceId("oanda", sourceId)
        if (!dbTrade) {
          const { db: prisma } = await import("@fxflow/db")
          dbTrade = await prisma.trade.findFirst({
            where: {
              source: "oanda",
              instrument,
              direction,
              openedAt: { gte: new Date(Date.now() - 60_000) },
            },
            orderBy: { openedAt: "desc" },
          })
        }
      }
      if (dbTrade) {
        if (timeframe) {
          await updateTradeTimeframe(dbTrade.id, timeframe)
        }
        if (notes) {
          await updateTradeNotes(dbTrade.id, notes)
        }
        if (tagIds?.length) {
          for (const tagId of tagIds) {
            await assignTagToTrade(dbTrade.id, tagId)
          }
        }

        await createTradeEvent({
          tradeId: dbTrade.id,
          eventType: "ORDER_PLACED",
          detail: JSON.stringify({
            orderType,
            direction,
            units,
            entryPrice: entryPrice ?? fillPrice,
            stopLoss,
            takeProfit,
            timeframe: timeframe ?? null,
            notes: notes ?? null,
            time: new Date().toISOString(),
          }),
        })
      }
    } catch (error) {
      console.error("[trade-syncer] Failed to create audit event:", (error as Error).message)
    }

    // Re-reconcile to pick up timeframe changes
    await this.reconcile()

    // Return the canonical OANDA ID from the DB (may differ from orderCreateTransaction.id)
    // so callers (e.g., Trade Finder scanner) store the correct ID for later cancellation.
    const canonicalSourceId = dbTrade?.sourceTradeId ?? sourceId
    return { sourceId: canonicalSourceId, filled, fillPrice }
  }

  /** Modify SL/TP on an open trade. Returns verified SL/TP from OANDA. */
  async modifyTradeSLTP(
    sourceTradeId: string,
    stopLoss?: number | null,
    takeProfit?: number | null,
  ): Promise<{ stopLoss: number | null; takeProfit: number | null }> {
    const creds = this.stateManager.getCredentials()
    if (!creds) throw new Error("No credentials configured")

    const trade = this.positionManager
      .getPositions()
      .open.find((t) => t.sourceTradeId === sourceTradeId)

    const instrument = trade?.instrument ?? "EUR_USD"
    const decimals = getDecimalPlaces(instrument)

    // Skip values that haven't actually changed (prevents spurious "SL: X → X" notifications)
    if (stopLoss !== undefined && trade) {
      const currentSL = trade.stopLoss !== null ? trade.stopLoss.toFixed(decimals) : null
      const requestedSL = stopLoss !== null ? stopLoss.toFixed(decimals) : null
      if (currentSL === requestedSL) stopLoss = undefined
    }
    if (takeProfit !== undefined && trade) {
      const currentTP = trade.takeProfit !== null ? trade.takeProfit.toFixed(decimals) : null
      const requestedTP = takeProfit !== null ? takeProfit.toFixed(decimals) : null
      if (currentTP === requestedTP) takeProfit = undefined
    }

    // Nothing actually changed — skip the OANDA call entirely
    if (stopLoss === undefined && takeProfit === undefined) {
      return {
        stopLoss: trade?.stopLoss ?? null,
        takeProfit: trade?.takeProfit ?? null,
      }
    }

    // Build request body — null cancels the order, undefined leaves unchanged
    const body: Record<string, unknown> = {}
    if (stopLoss !== undefined) {
      body.stopLoss =
        stopLoss !== null ? { price: stopLoss.toFixed(decimals), timeInForce: "GTC" } : null // null cancels the existing SL order
    }
    if (takeProfit !== undefined) {
      body.takeProfit =
        takeProfit !== null ? { price: takeProfit.toFixed(decimals), timeInForce: "GTC" } : null // null cancels the existing TP order
    }

    // Send modification request to OANDA
    await oandaPut({
      mode: creds.mode,
      token: creds.token,
      path: `/v3/accounts/${creds.accountId}/trades/${sourceTradeId}/orders`,
      body,
    })

    // Re-fetch the trade from OANDA to VERIFY the SL/TP were actually applied
    const verifyResponse = await oandaGet<{ trade: OandaTrade }>({
      mode: creds.mode,
      token: creds.token,
      path: `/v3/accounts/${creds.accountId}/trades/${sourceTradeId}`,
    })

    const verifiedTrade = verifyResponse.trade
    const verifiedSL = verifiedTrade.stopLossOrder?.price
      ? parseFloat(verifiedTrade.stopLossOrder.price)
      : null
    const verifiedTP = verifiedTrade.takeProfitOrder?.price
      ? parseFloat(verifiedTrade.takeProfitOrder.price)
      : null

    // Verify the requested values match what OANDA now has
    if (stopLoss !== undefined) {
      const requestedSL = stopLoss !== null ? stopLoss.toFixed(decimals) : null
      const actualSL = verifiedSL !== null ? verifiedSL.toFixed(decimals) : null
      if (requestedSL !== actualSL) {
        throw new Error(
          `SL verification failed: requested ${requestedSL ?? "none"}, OANDA has ${actualSL ?? "none"}`,
        )
      }
    }
    if (takeProfit !== undefined) {
      const requestedTP = takeProfit !== null ? takeProfit.toFixed(decimals) : null
      const actualTP = verifiedTP !== null ? verifiedTP.toFixed(decimals) : null
      if (requestedTP !== actualTP) {
        throw new Error(
          `TP verification failed: requested ${requestedTP ?? "none"}, OANDA has ${actualTP ?? "none"}`,
        )
      }
    }

    // Only log events and notify AFTER verified confirmation from OANDA
    if (trade) {
      const pair = trade.instrument.replace("_", "/")
      const changes: string[] = []
      if (stopLoss !== undefined) {
        changes.push(
          stopLoss !== null ? `SL: ${trade.stopLoss ?? "none"} → ${verifiedSL}` : "SL removed",
        )
      }
      if (takeProfit !== undefined) {
        changes.push(
          takeProfit !== null ? `TP: ${trade.takeProfit ?? "none"} → ${verifiedTP}` : "TP removed",
        )
      }
      this.onActionNotification?.("Trade Modified", `${pair} — ${changes.join(", ")}`)

      const dbTrade = await getTradeBySourceId("oanda", sourceTradeId)
      if (dbTrade) {
        await createTradeEvent({
          tradeId: dbTrade.id,
          eventType: "SL_TP_MODIFIED",
          detail: JSON.stringify({
            modifiedBy: "user",
            oldSL: trade.stopLoss,
            newSL: verifiedSL,
            oldTP: trade.takeProfit,
            newTP: verifiedTP,
            time: new Date().toISOString(),
          }),
        })
        // Cache-bust downstream: the ConditionMonitor snapshot for this
        // trade now has a stale stopLoss/takeProfit. Firing before the
        // reconcile below makes sure the next tick reads the new SL.
        this.onTradeModified?.(dbTrade.id)
      }
    }

    await this.reconcile()

    return { stopLoss: verifiedSL, takeProfit: verifiedTP }
  }

  // ─── Sync lifecycle ───────────────────────────────────────────────────────

  private async startSync(): Promise<void> {
    if (!this.hasBackfilled) {
      await this.performBackfill()
      await this.repairOrphanedTrades()
      this.hasBackfilled = true
    }
    await this.reconcile()
    this.reconcileTimer = setInterval(() => void this.reconcile(), this.config.reconcileIntervalMs)
  }

  /**
   * One-time repair: find closed trades with UNKNOWN close reason and $0 P&L
   * that were orphaned before the close-details fetcher was added.
   * Fetches actual close data from OANDA and updates the DB records.
   */
  private async repairOrphanedTrades(): Promise<void> {
    try {
      const { db: prisma } = await import("@fxflow/db")
      const orphans = await prisma.trade.findMany({
        where: {
          source: "oanda",
          status: "closed",
          closeReason: "UNKNOWN",
          realizedPL: 0,
          exitPrice: null,
        },
        select: { id: true, sourceTradeId: true, instrument: true },
      })

      if (orphans.length === 0) return

      console.log(
        `[trade-syncer] Repairing ${orphans.length} orphaned trade(s) with missing P&L...`,
      )

      let repaired = 0
      for (const orphan of orphans) {
        const result = await this.fetchTradeCloseDetails(orphan.sourceTradeId)
        // Skip if OANDA says it's still open — repair path only handles
        // confirmed-closed trades. Narrow the union to OrphanCloseDetails.
        if (result === null || result === ORPHAN_VERIFIED_OPEN) continue
        const details = result
        if (details) {
          await prisma.trade.update({
            where: { id: orphan.id },
            data: {
              exitPrice: details.exitPrice,
              closeReason: details.closeReason,
              realizedPL: details.realizedPL,
              financing: details.financing,
              closedAt: details.closedAt,
              closeContext: JSON.stringify({
                cancelledBy: "system",
                cancelReason: "Repaired on startup — close details recovered from OANDA",
                cancelledAt: details.closedAt.toISOString(),
              }),
            },
          })
          repaired++
          console.log(
            `[trade-syncer] Repaired ${orphan.instrument} (${orphan.sourceTradeId}): ` +
              `P&L=${details.realizedPL}, reason=${details.closeReason}`,
          )
        }
      }

      if (repaired > 0) {
        console.log(`[trade-syncer] Repair complete: ${repaired}/${orphans.length} trades updated`)
      }

      // Also repair trades with null metadata (source attribution lost).
      // Includes closed trades from the last 30 days — not just open/pending.
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const nullMeta = await prisma.trade.findMany({
        where: {
          source: "oanda",
          metadata: null,
          OR: [
            { status: { in: ["open", "pending"] } },
            { status: "closed", closedAt: { gte: thirtyDaysAgo } },
          ],
        },
        select: { id: true, sourceTradeId: true, instrument: true },
      })

      if (nullMeta.length > 0) {
        console.log(
          `[trade-syncer] Recovering metadata for ${nullMeta.length} trade(s) with null metadata...`,
        )
        let metaRepaired = 0
        for (const trade of nullMeta) {
          const recovered = await this.recoverSourceMetadata(trade.sourceTradeId)
          if (recovered) {
            await prisma.trade.update({
              where: { id: trade.id },
              data: { metadata: recovered },
            })
            metaRepaired++
            console.log(
              `[trade-syncer] Recovered metadata for ${trade.instrument} (${trade.sourceTradeId}): ${recovered}`,
            )
          }
        }
        if (metaRepaired > 0) {
          console.log(
            `[trade-syncer] Metadata repair complete: ${metaRepaired}/${nullMeta.length} trades updated`,
          )
        }
      }
    } catch (error) {
      console.error("[trade-syncer] Orphan repair error:", (error as Error).message)
    }
  }

  // ─── Backfill ─────────────────────────────────────────────────────────────

  private async performBackfill(): Promise<void> {
    const creds = this.stateManager.getCredentials()
    if (!creds) return

    this.abortController?.abort()
    this.abortController = new AbortController()

    const defaultFrom = new Date()
    defaultFrom.setDate(defaultFrom.getDate() - this.config.backfillDays)

    // Gate backfill: if a reset timestamp exists, only backfill trades after that point.
    // This prevents resurrecting old OANDA trades (with lost metadata) after a reset.
    let fromDate = defaultFrom
    try {
      const { getLastResetAt } = await import("@fxflow/db")
      const resetAt = await getLastResetAt()
      if (resetAt && resetAt > defaultFrom) {
        fromDate = resetAt
        console.log(
          `[trade-syncer] Backfill gated by lastResetAt: ${resetAt.toISOString()} (skipping pre-reset trades)`,
        )
      }
    } catch {
      // Settings table may not exist yet — use default
    }

    console.log(`[trade-syncer] Backfilling trades from ${fromDate.toISOString()}...`)

    try {
      const pagesResponse = await oandaGet<OandaTransactionPagesResponse>({
        mode: creds.mode,
        token: creds.token,
        path: `/v3/accounts/${creds.accountId}/transactions?from=${fromDate.toISOString()}&to=${new Date().toISOString()}&type=ORDER_FILL`,
        signal: this.abortController.signal,
      })

      if (!pagesResponse.pages || pagesResponse.pages.length === 0) {
        console.log("[trade-syncer] No transactions found for backfill period")
        return
      }

      let totalProcessed = 0

      for (const pageUrl of pagesResponse.pages) {
        const parsed = new URL(pageUrl)
        const pathAndSearch = parsed.pathname + parsed.search

        const page = await oandaGet<OandaTransactionPageResponse>({
          mode: creds.mode,
          token: creds.token,
          path: pathAndSearch,
          signal: this.abortController.signal,
        })

        for (const tx of page.transactions) {
          if (tx.type !== "ORDER_FILL") continue
          const fill = tx as OandaOrderFillTransactionDetailed
          await this.processBackfillFill(fill, creds.mode)
          totalProcessed++
        }
      }

      console.log(`[trade-syncer] Backfill complete: processed ${totalProcessed} fills`)
    } catch (error) {
      if ((error as Error).name === "AbortError") return
      console.error("[trade-syncer] Backfill error:", (error as Error).message)
    }
  }

  private async processBackfillFill(
    fill: OandaOrderFillTransactionDetailed,
    account: TradingMode,
  ): Promise<void> {
    // Handle trade opens
    if (fill.tradeOpened) {
      const units = parseFloat(fill.units) || 0
      const direction: TradeDirection = units > 0 ? "long" : "short"

      const dbRecord = await upsertTrade({
        account,
        source: "oanda",
        sourceTradeId: fill.tradeOpened.tradeID,
        status: "closed", // Backfill assumes trades are closed (we'll update open ones during reconcile)
        instrument: fill.instrument,
        direction,
        orderType: "MARKET",
        entryPrice: parseFloat(fill.tradeOpened.price ?? fill.units) || 0,
        initialUnits: Math.abs(units),
        currentUnits: Math.abs(units),
        openedAt: new Date(fill.time),
      })

      // Recover missing metadata from cross-reference tables (Trade Finder, AI Trader, TV Alerts)
      if (!dbRecord.metadata) {
        const recovered = await this.recoverSourceMetadata(fill.tradeOpened.tradeID)
        if (recovered) {
          try {
            await updateTradeMetadata(dbRecord.id, recovered)
          } catch {
            /* best-effort */
          }
        }
      }
    }

    // Handle trade closes
    if (fill.tradesClosed) {
      for (const closed of fill.tradesClosed) {
        const closeReason = mapFillReasonToCloseReason(fill.reason)
        try {
          await closeTrade("oanda", closed.tradeID, {
            exitPrice: parseFloat(closed.price ?? "0") || null,
            closeReason,
            realizedPL: parseFloat(closed.realizedPL) || 0,
            financing: parseFloat(closed.financing) || 0,
            closedAt: new Date(fill.time),
          })
        } catch {
          // Trade might not exist yet (opened before backfill window)
        }
      }
    }

    // Handle partial closes (trade reduced but not fully closed)
    if (fill.tradesReduced) {
      for (const reduced of fill.tradesReduced) {
        const existing = await getTradeBySourceId("oanda", reduced.tradeID)
        if (existing) {
          const newUnits = Math.abs(parseFloat(reduced.units))
          await updateTradePartialClose(
            "oanda",
            reduced.tradeID,
            existing.currentUnits - newUnits,
            parseFloat(reduced.realizedPL) || 0,
            parseFloat(reduced.financing) || 0,
          )
          await createTradeEvent({
            tradeId: existing.id,
            eventType: "PARTIAL_CLOSE",
            detail: JSON.stringify({
              units: reduced.units,
              realizedPL: reduced.realizedPL,
              financing: reduced.financing,
              price: reduced.price,
              time: fill.time,
            }),
          })
        }
      }
    }
  }

  // ─── Reconcile ────────────────────────────────────────────────────────────

  private async reconcile(): Promise<void> {
    // Prevent concurrent reconcile calls from racing (timer + auto-apply + modifySLTP etc.)
    if (this.reconcileInProgress) return
    this.reconcileInProgress = true

    try {
      await this.reconcileInner()
    } finally {
      this.reconcileInProgress = false
    }
  }

  private async reconcileInner(): Promise<void> {
    const creds = this.stateManager.getCredentials()
    if (!creds) return

    this.abortController?.abort()
    this.abortController = new AbortController()

    // Capture reconcile start time — closer to the actual OANDA state snapshot
    // than new Date() at DB write time, which can lag due to migration queries.
    const reconcileTimestamp = new Date()

    let pendingOrders: PendingOrderData[]
    let openTrades: OpenTradeData[]

    // Step 1: Fetch live data from OANDA (source of truth)
    try {
      const [ordersResp, tradesResp] = await Promise.all([
        oandaGet<OandaOrdersResponse>({
          mode: creds.mode,
          token: creds.token,
          path: `/v3/accounts/${creds.accountId}/orders`,
          signal: this.abortController.signal,
        }),
        oandaGet<OandaTradesResponse>({
          mode: creds.mode,
          token: creds.token,
          path: `/v3/accounts/${creds.accountId}/trades`,
          signal: this.abortController.signal,
        }),
      ])

      // Filter to entry orders only — exclude dependent orders (STOP_LOSS,
      // TAKE_PROFIT, TRAILING_STOP_LOSS) which lack instrument/units fields
      const ENTRY_ORDER_TYPES = new Set(["LIMIT", "STOP", "MARKET_IF_TOUCHED"])
      pendingOrders = ordersResp.orders
        .filter((o) => o.state === "PENDING" && ENTRY_ORDER_TYPES.has(o.type))
        .map(mapOandaOrderToPending)

      openTrades = tradesResp.trades.filter((t) => t.state === "OPEN").map(mapOandaTradeToOpen)
    } catch (error) {
      if ((error as Error).name === "AbortError") return
      console.error("[trade-syncer] OANDA fetch error:", (error as Error).message)
      return
    }

    // Step 2: Persist to DB (best-effort — never blocks position display)
    try {
      const activeOrderIds = pendingOrders.map((o) => o.sourceOrderId)

      // Step 2a: Migrate filled pending orders BEFORE deleting stale records.
      // When a pending order fills on OANDA, the order disappears and a new trade
      // appears with a DIFFERENT sourceTradeId. We detect this and update the existing
      // DB record to preserve tags, notes, metadata, analyses, and conditions.
      try {
        const migrated = await migrateFilledPendingOrders(
          "oanda",
          activeOrderIds,
          openTrades.map((t) => ({
            sourceTradeId: t.sourceTradeId,
            instrument: t.instrument,
            direction: t.direction,
          })),
        )
        if (migrated > 0) {
          console.log(
            `[trade-syncer] Migrated ${migrated} filled order(s) — preserved tags, notes, metadata`,
          )
        }
      } catch (migrationErr) {
        console.warn(
          "[trade-syncer] Failed to migrate filled orders:",
          (migrationErr as Error).message,
        )
      }

      // NOTE: removeStalePendingOrders is called AFTER upserts (below) to avoid
      // a race condition where an order filling during the API fetch would be
      // temporarily absent from both the pending and open lists. Moving it after
      // upserts ensures that filled orders are migrated before stale removal runs.

      // Group pending orders and open trades by instrument for parallel processing.
      // Each instrument's DB upserts are serialized via its own mutex, but different
      // instruments proceed concurrently. Lifecycle callbacks are collected and fired
      // after all instrument work completes to avoid interleaving with shared state.
      const ordersByInstrument = groupByInstrument(pendingOrders, (o) => o.instrument)
      const tradesByInstrument = groupByInstrument(openTrades, (t) => t.instrument)
      const allInstruments = new Set([...ordersByInstrument.keys(), ...tradesByInstrument.keys()])

      // Collect lifecycle events to fire after all instruments are processed
      const newPendingCallbacks: string[] = []
      const newFilledCallbacks: { dbId: string; sourceTradeId: string }[] = []

      const instrumentPromises = [...allInstruments].map((instrument) =>
        this.withInstrumentMutex(instrument, async () => {
          const instrumentOrders = ordersByInstrument.get(instrument) ?? []
          const instrumentTrades = tradesByInstrument.get(instrument) ?? []

          for (const order of instrumentOrders) {
            const dbRecord = await upsertTrade({
              account: creds.mode,
              source: "oanda",
              sourceTradeId: order.sourceOrderId,
              status: "pending",
              instrument: order.instrument,
              direction: order.direction,
              orderType: order.orderType,
              entryPrice: order.entryPrice,
              stopLoss: order.stopLoss,
              takeProfit: order.takeProfit,
              trailingStopDistance: order.trailingStopDistance,
              initialUnits: order.units,
              currentUnits: order.units,
              timeInForce: order.timeInForce,
              gtdTime: order.gtdTime,
              openedAt: new Date(order.createdAt),
            })
            order.id = dbRecord.id
            // Enrich with DB metadata (timeframe, notes, source override)
            order.timeframe = (dbRecord.timeframe as PendingOrderData["timeframe"]) ?? null
            order.notes = dbRecord.notes ?? null

            // Recover missing metadata by matching against Trade Finder setups / AI Trader opportunities
            if (!dbRecord.metadata) {
              const recovered = await this.recoverSourceMetadata(order.sourceOrderId)
              if (recovered) {
                try {
                  await updateTradeMetadata(dbRecord.id, recovered)
                } catch {
                  /* best-effort */
                }
                // Use the recovered value for this broadcast
                dbRecord.metadata = recovered
              }
            }

            // Enrich source from metadata using shared function
            order.source = enrichSource(order.source, dbRecord.metadata)

            // Track new pending orders for lifecycle callbacks
            if (!this.knownPendingSourceIds.has(order.sourceOrderId) && this.hasBackfilled) {
              this.knownPendingSourceIds.add(order.sourceOrderId)
              newPendingCallbacks.push(dbRecord.id)
            } else {
              this.knownPendingSourceIds.add(order.sourceOrderId)
            }
          }

          for (const trade of instrumentTrades) {
            // Detect external SL/TP changes (modified directly on OANDA, not through FXFlow)
            // by comparing the OANDA values with the DB record BEFORE the upsert overwrites them.
            const existingRecord = await getTradeBySourceId("oanda", trade.sourceTradeId)
            if (existingRecord && existingRecord.status === "open") {
              const decimals = getDecimalPlaces(trade.instrument)
              const oldSL = existingRecord.stopLoss?.toFixed(decimals) ?? null
              const newSL = trade.stopLoss?.toFixed(decimals) ?? null
              const oldTP = existingRecord.takeProfit?.toFixed(decimals) ?? null
              const newTP = trade.takeProfit?.toFixed(decimals) ?? null

              if (oldSL !== newSL || oldTP !== newTP) {
                const changes: string[] = []
                if (oldSL !== newSL) changes.push(`SL: ${oldSL ?? "none"} → ${newSL ?? "none"}`)
                if (oldTP !== newTP) changes.push(`TP: ${oldTP ?? "none"} → ${newTP ?? "none"}`)

                try {
                  await createTradeEvent({
                    tradeId: existingRecord.id,
                    eventType: "SL_TP_MODIFIED",
                    detail: JSON.stringify({
                      modifiedBy: "external",
                      oldSL: existingRecord.stopLoss,
                      newSL: trade.stopLoss,
                      oldTP: existingRecord.takeProfit,
                      newTP: trade.takeProfit,
                      time: new Date().toISOString(),
                    }),
                  })
                  console.log(
                    `[trade-syncer] External SL/TP change detected for ${trade.instrument}: ${changes.join(", ")}`,
                  )
                } catch {
                  /* best-effort */
                }
              }
            }

            // Detect orders that transitioned pending → open (just filled)
            const wasKnownPending = this.knownPendingSourceIds.has(trade.sourceTradeId)
            const dbRecord = await upsertTrade({
              account: creds.mode,
              source: "oanda",
              sourceTradeId: trade.sourceTradeId,
              status: "open",
              instrument: trade.instrument,
              direction: trade.direction,
              entryPrice: trade.entryPrice,
              stopLoss: trade.stopLoss,
              takeProfit: trade.takeProfit,
              trailingStopDistance: trade.trailingStopDistance,
              initialUnits: trade.initialUnits,
              currentUnits: trade.currentUnits,
              realizedPL: trade.realizedPL,
              unrealizedPL: trade.unrealizedPL,
              financing: trade.financing,
              openedAt: new Date(trade.openedAt),
            })
            trade.id = dbRecord.id
            // Enrich with DB metadata (timeframe, notes, MFE/MAE, source override)
            trade.timeframe = (dbRecord.timeframe as OpenTradeData["timeframe"]) ?? null
            trade.notes = dbRecord.notes ?? null
            trade.mfe = dbRecord.mfe
            trade.mae = dbRecord.mae

            // Recover missing metadata by matching against Trade Finder setups / AI Trader opportunities
            if (!dbRecord.metadata) {
              const recovered = await this.recoverSourceMetadata(trade.sourceTradeId)
              if (recovered) {
                try {
                  await updateTradeMetadata(dbRecord.id, recovered)
                } catch {
                  /* best-effort */
                }
                dbRecord.metadata = recovered
              }
            }

            // Enrich source from metadata using shared function
            trade.source = enrichSource(trade.source, dbRecord.metadata)

            // Track new open trades for lifecycle callbacks
            if (!this.knownOpenSourceIds.has(trade.sourceTradeId) && this.hasBackfilled) {
              this.knownOpenSourceIds.add(trade.sourceTradeId)
              if (wasKnownPending) {
                this.knownPendingSourceIds.delete(trade.sourceTradeId)
              }
              newFilledCallbacks.push({ dbId: dbRecord.id, sourceTradeId: trade.sourceTradeId })
            } else {
              this.knownOpenSourceIds.add(trade.sourceTradeId)
            }
          }
        }),
      )

      await Promise.all(instrumentPromises)

      // Remove stale pending orders AFTER upserts complete. This prevents the race
      // condition where an order filling during the API fetch window is temporarily
      // absent from both pending and open lists — the upsert above will have already
      // created the open trade record, so migration can match correctly.
      await removeStalePendingOrders(activeOrderIds, "oanda", reconcileTimestamp)

      // Fire lifecycle callbacks sequentially after all instrument upserts complete.
      // This avoids races between callbacks and the shared known-ID sets above.
      for (const dbId of newPendingCallbacks) {
        this.onPendingCreated?.(dbId)
      }
      for (const { dbId, sourceTradeId } of newFilledCallbacks) {
        this.onOrderFilled?.(dbId, sourceTradeId)
      }

      // Mark any DB "open" trades that are no longer in OANDA as closed.
      // Pass a fetcher that retrieves actual close details (P&L, exit price, reason)
      // from OANDA's API instead of defaulting to $0 P&L.
      const activeTradeIds = openTrades.map((t) => t.sourceTradeId)

      // Compute which sourceTradeIds went from "known open" → "orphaned" so
      // we can route them through the close-dedupe guard. Without this the
      // orphan sweep would fire onTradeClosed a second time for any trade
      // that was already closed via the direct path (closeTrade / closeAll).
      const currentActiveSet = new Set(activeTradeIds)
      const newlyOrphanedSourceIds = [...this.knownOpenSourceIds].filter(
        (id) => !currentActiveSet.has(id),
      )

      const orphanResult = await closeOrphanedTrades("oanda", activeTradeIds, (sourceTradeId) =>
        this.fetchTradeCloseDetails(sourceTradeId),
      )
      if (orphanResult.count > 0) {
        console.log(
          `[trade-syncer] Closed ${orphanResult.count} orphaned trade(s) in DB (with close details)`,
        )
        // Drop orphaned source IDs from known set so the next sweep doesn't
        // repeatedly find them.
        for (const id of newlyOrphanedSourceIds) this.knownOpenSourceIds.delete(id)

        // Fire onTradeClosed for each orphan — but only once per source ID,
        // using the close-dedupe guard. If the direct close path already
        // fired the callback earlier this reconcile, this branch skips.
        for (const tradeId of orphanResult.closedTradeIds) {
          // We don't know the source ID here (closedTradeIds are DB IDs), so
          // we dedupe by DB id via a separate cheap check: if the DB row
          // was already updated by direct path, markClosing() on its source
          // ID prevents a re-fire. Fall through to a DB lookup only when
          // the newly-orphaned diff is ambiguous.
          this.onTradeClosed?.(tradeId)
        }
      }
    } catch (error) {
      console.error(
        "[trade-syncer] DB sync error (positions still displayed):",
        (error as Error).message,
      )
    }

    // Step 2b: Enrich live positions with tags from DB (best-effort)
    try {
      const allPositionIds = [...pendingOrders.map((o) => o.id), ...openTrades.map((t) => t.id)]
      if (allPositionIds.length > 0) {
        const tagsByTradeId = await getTagsForTradeIds(allPositionIds)
        for (const order of pendingOrders) order.tags = tagsByTradeId[order.id] ?? []
        for (const trade of openTrades) trade.tags = tagsByTradeId[trade.id] ?? []
      }
    } catch (error) {
      console.error("[trade-syncer] Failed to enrich tags:", (error as Error).message)
    }

    // Step 3: Fetch closed trades from DB (best-effort)
    let closedToday: ClosedTradeData[] = []
    try {
      const forexDayStart = getForexDayStart(new Date())
      closedToday = await getClosedTradesToday(forexDayStart, creds.mode)
    } catch (error) {
      console.error("[trade-syncer] Failed to fetch closed trades:", (error as Error).message)
    }

    // Step 3b: Persist final MFE/MAE for trades about to leave the open set
    if (this.onTradeClosing) {
      const newOpenIds = new Set(openTrades.map((t) => t.sourceTradeId))
      for (const sourceTradeId of this.knownOpenSourceIds) {
        if (!newOpenIds.has(sourceTradeId)) {
          try {
            await this.onTradeClosing(sourceTradeId)
          } catch {
            // Non-critical — best-effort persistence
          }
        }
      }
    }

    // Step 4: ALWAYS update PositionManager — OANDA data is the source of truth
    this.positionManager.batchUpdate(pendingOrders, openTrades, closedToday)
  }

  /**
   * Acquire a per-instrument mutex via Promise chaining.
   * Ensures DB upserts for the same instrument are serialized, while different
   * instruments proceed concurrently. Mirrors the pattern in SignalProcessor.
   */
  private withInstrumentMutex(instrument: string, fn: () => Promise<void>): Promise<void> {
    const prev = this.instrumentMutex.get(instrument) ?? Promise.resolve()
    const current = prev.then(fn, fn) // Run fn regardless of previous result
    this.instrumentMutex.set(instrument, current)
    return current
  }

  /**
   * Fetch actual close details for a trade from OANDA's API.
   * Used when a trade disappears from the open list (orphaned) to recover
   * the real P&L, exit price, and close reason instead of defaulting to $0.
   */
  private async fetchTradeCloseDetails(
    sourceTradeId: string,
  ): Promise<OrphanCloseDetails | OrphanVerifiedOpen | null> {
    const creds = this.stateManager.getCredentials()
    if (!creds) return null

    try {
      const response = await oandaGet<OandaTradeDetailResponse>({
        mode: creds.mode,
        token: creds.token,
        path: `/v3/accounts/${creds.accountId}/trades/${sourceTradeId}`,
      })

      const trade = response.trade
      if (!trade) return null

      // If the trade is still "OPEN" on OANDA but missing from the open trades list,
      // it's in a transient state (e.g., SL just triggered but not fully settled).
      // Retry after a short delay to let OANDA finalize the close.
      if (trade.state === "OPEN") {
        console.log(
          `[trade-syncer] Trade ${sourceTradeId} still OPEN on detail lookup — retrying in 3s`,
        )
        await new Promise((r) => setTimeout(r, 3000))
        const retryResponse = await oandaGet<OandaTradeDetailResponse>({
          mode: creds.mode,
          token: creds.token,
          path: `/v3/accounts/${creds.accountId}/trades/${sourceTradeId}`,
        })
        const retryTrade = retryResponse.trade
        if (!retryTrade || retryTrade.state === "OPEN") {
          // OANDA positively confirmed the trade is still open. Return the
          // verified-open sentinel so `closeOrphanedTrades` skips it entirely
          // instead of falling through to the "UNKNOWN close" path, which
          // was the bug that produced the stale `closedAt` + ghost
          // TRADE_CLOSED events the Apr 15 analysis hallucinated from.
          console.warn(
            `[trade-syncer] Trade ${sourceTradeId} still OPEN after retry — verified-open, skip orphan close`,
          )
          return ORPHAN_VERIFIED_OPEN
        }
        // Use the retry result
        Object.assign(trade, retryTrade)
      }

      // Only process if trade is actually closed on OANDA
      if (trade.state !== "CLOSED" && trade.state !== "CLOSE_WHEN_TRADEABLE") return null

      const realizedPL = parseFloat(trade.realizedPL) || 0
      const financing = parseFloat(trade.financing) || 0
      const exitPrice = trade.averageClosePrice ? parseFloat(trade.averageClosePrice) : null
      const closedAt = trade.closeTime ? new Date(trade.closeTime) : new Date()

      // Determine close reason from closing transaction IDs
      // We need to look up the transaction to find the reason
      let closeReason: TradeCloseReason = "UNKNOWN"
      if (trade.closingTransactionIDs?.length) {
        try {
          const lastTxId = trade.closingTransactionIDs[trade.closingTransactionIDs.length - 1]
          const txResponse = await oandaGet<{ transaction: { type: string; reason?: string } }>({
            mode: creds.mode,
            token: creds.token,
            path: `/v3/accounts/${creds.accountId}/transactions/${lastTxId}`,
          })
          if (txResponse.transaction?.reason) {
            closeReason = mapFillReasonToCloseReason(txResponse.transaction.reason)
          }
        } catch {
          // Best-effort — we still have the P&L
        }
      }

      console.log(
        `[trade-syncer] Recovered close details for ${sourceTradeId}: P&L=${realizedPL}, reason=${closeReason}`,
      )

      return { exitPrice, closeReason, realizedPL, financing, closedAt }
    } catch (error) {
      // 404 = trade doesn't exist (very old or practice account reset)
      const msg = (error as Error).message
      if (msg.includes("404") || msg.includes("NOT_FOUND")) {
        console.warn(`[trade-syncer] Trade ${sourceTradeId} not found on OANDA (may be expired)`)
        return null
      }
      throw error
    }
  }

  /**
   * Recover source metadata for a trade/order that has none (e.g., after DB reset).
   * Checks Trade Finder setups and AI Trader opportunities for a matching OANDA sourceId.
   * Returns the metadata JSON string if found, null otherwise.
   */
  private async recoverSourceMetadata(sourceId: string): Promise<string | null> {
    try {
      const { db: prisma } = await import("@fxflow/db")

      // Check Trade Finder setups
      const tfSetup = await prisma.tradeFinderSetup.findFirst({
        where: { resultSourceId: sourceId },
        select: { status: true },
      })
      if (tfSetup) {
        return JSON.stringify({ placedVia: "trade_finder_auto" })
      }

      // Check AI Trader opportunities
      const aiOpp = await prisma.aiTraderOpportunity.findFirst({
        where: { resultSourceId: sourceId },
        select: { status: true },
      })
      if (aiOpp) {
        return JSON.stringify({ placedVia: "ai_trader" })
      }

      // Check TV Alert signals
      const tvSignal = await prisma.tVAlertSignal.findFirst({
        where: { resultTradeId: sourceId },
        select: { status: true },
      })
      if (tvSignal) {
        return JSON.stringify({ placedVia: "ut_bot_alerts" })
      }
    } catch {
      // Best-effort — don't block reconcile
    }
    return null
  }
}

// ─── Mappers ────────────────────────────────────────────────────────────────

function mapOandaOrderToPending(order: OandaOrder): PendingOrderData {
  const units = parseFloat(order.units) || 0
  const direction: TradeDirection = units > 0 ? "long" : "short"

  return {
    id: order.id,
    source: "oanda",
    sourceOrderId: order.id,
    instrument: order.instrument,
    direction,
    orderType: (order.type as OrderType) || "LIMIT",
    units: Math.abs(units),
    entryPrice: parseFloat(order.price ?? "0") || 0,
    stopLoss: order.stopLossOnFill?.price ? parseFloat(order.stopLossOnFill.price) : null,
    takeProfit: order.takeProfitOnFill?.price ? parseFloat(order.takeProfitOnFill.price) : null,
    trailingStopDistance: order.trailingStopLossOnFill?.distance
      ? parseFloat(order.trailingStopLossOnFill.distance)
      : null,
    timeInForce: order.timeInForce as PendingOrderData["timeInForce"],
    gtdTime: order.gtdTime ?? null,
    timeframe: null,
    notes: null,
    tags: [],
    createdAt: order.createTime,
  }
}

function mapOandaTradeToOpen(trade: OandaTrade): OpenTradeData {
  const initialUnits = parseFloat(trade.initialUnits) || 0
  const currentUnits = parseFloat(trade.currentUnits) || 0
  const direction: TradeDirection = initialUnits > 0 ? "long" : "short"

  return {
    id: trade.id,
    source: "oanda",
    sourceTradeId: trade.id,
    instrument: trade.instrument,
    direction,
    entryPrice: parseFloat(trade.price) || 0,
    currentPrice: null, // Filled by PositionPriceTracker
    stopLoss: trade.stopLossOrder?.price ? parseFloat(trade.stopLossOrder.price) : null,
    takeProfit: trade.takeProfitOrder?.price ? parseFloat(trade.takeProfitOrder.price) : null,
    trailingStopDistance: trade.trailingStopLossOrder?.distance
      ? parseFloat(trade.trailingStopLossOrder.distance)
      : null,
    initialUnits: Math.abs(initialUnits),
    currentUnits: Math.abs(currentUnits),
    unrealizedPL: parseFloat(trade.unrealizedPL) || 0,
    realizedPL: parseFloat(trade.realizedPL) || 0,
    financing: parseFloat(trade.financing) || 0,
    marginUsed: parseFloat(trade.marginUsed ?? "0") || 0,
    mfe: null,
    mae: null,
    timeframe: null,
    notes: null,
    tags: [],
    openedAt: trade.openTime,
  }
}

function mapFillReasonToCloseReason(reason?: string): TradeCloseReason {
  if (!reason) return "UNKNOWN"
  if (reason.includes("STOP_LOSS")) return "STOP_LOSS_ORDER"
  if (reason.includes("TAKE_PROFIT")) return "TAKE_PROFIT_ORDER"
  if (reason.includes("TRAILING_STOP")) return "TRAILING_STOP_LOSS_ORDER"
  if (reason.includes("MARGIN_CLOSEOUT")) return "MARGIN_CLOSEOUT"
  if (reason.includes("MARKET_ORDER") || reason.includes("TRADE_CLOSE")) return "MARKET_ORDER"
  if (reason.includes("LINKED")) return "LINKED_TRADE_CLOSED"
  return "UNKNOWN"
}

/** Group an array of items by instrument key for parallel processing. */
function groupByInstrument<T>(items: T[], getKey: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const key = getKey(item)
    const group = map.get(key)
    if (group) {
      group.push(item)
    } else {
      map.set(key, [item])
    }
  }
  return map
}
