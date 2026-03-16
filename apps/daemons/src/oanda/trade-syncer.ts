import type {
  PendingOrderData,
  OpenTradeData,
  ClosedTradeData,
  TradeDirection,
  OrderType,
  TradeCloseReason,
  PlaceOrderRequest,
  PlaceOrderResponseData,
} from "@fxflow/types"
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
} from "./api-client.js"
import {
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
} from "@fxflow/db"

export class OandaTradeSyncer {
  private reconcileTimer: ReturnType<typeof setInterval> | null = null
  private abortController: AbortController | null = null
  private hasBackfilled = false

  /** Callback for emitting user-action notifications. Set by daemon wiring. */
  onActionNotification: ((title: string, message: string) => void) | null = null

  /** Lifecycle callbacks — set by daemon wiring for AutoAnalyzer integration */
  onPendingCreated: ((tradeId: string) => void) | null = null
  onOrderFilled: ((tradeId: string) => void) | null = null
  onTradeClosed: ((tradeId: string) => void) | null = null

  /** Called before a trade is removed from PositionManager, to persist final MFE/MAE. */
  onTradeClosing: ((sourceTradeId: string) => Promise<void>) | null = null

  /** Track known sourceOrderIds/TradeIds to detect new arrivals */
  private knownPendingSourceIds = new Set<string>()
  private knownOpenSourceIds = new Set<string>()

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
            this.onTradeClosed?.(dbTrade.id)
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

  /** Close a trade on OANDA (full or partial). */
  async closeTrade(sourceTradeId: string, units?: number, reason?: string): Promise<void> {
    const creds = this.stateManager.getCredentials()
    if (!creds) throw new Error("No credentials configured")

    // Look up trade info for notification
    const trade = this.positionManager
      .getPositions()
      .open.find((t) => t.sourceTradeId === sourceTradeId)

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
              closedBy: "user",
              units: units ?? "ALL",
              reason: reason ?? null,
              time: new Date().toISOString(),
            }),
          })
          if (reason) await appendTradeNotes(dbTrade.id, `Closed Reason: ${reason}`)
          if (!units) {
            this.knownOpenSourceIds.delete(sourceTradeId)
            this.onTradeClosed?.(dbTrade.id)
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

    if (stopLoss !== null) {
      orderBody.stopLossOnFill = { price: stopLoss.toFixed(decimals), timeInForce: "GTC" }
    }

    if (takeProfit !== null) {
      orderBody.takeProfitOnFill = { price: takeProfit.toFixed(decimals), timeInForce: "GTC" }
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

    // Reconcile FIRST so OANDA's canonical order/trade ID is in the DB.
    // Then we apply metadata, notes, tags to the reconciled record.
    await this.reconcile()

    // Find the DB record by sourceId. For LIMIT orders, OANDA's orderCreateTransaction.id
    // may differ from the order.id in the pending list. If not found by sourceId, search
    // by instrument + direction + status as a fallback to handle ID mismatches.
    let dbTrade = await getTradeBySourceId("oanda", sourceId)
    console.log(
      `[placeOrder] sourceId=${sourceId}, found by sourceId: ${!!dbTrade}${dbTrade ? ` (id=${dbTrade.id})` : ""}`,
    )
    if (!dbTrade) {
      // Fallback: find by instrument + direction + recent creation
      const { db: prisma } = await import("@fxflow/db")
      const recent = await prisma.trade.findFirst({
        where: {
          source: "oanda",
          instrument,
          direction,
          status: filled ? "open" : "pending",
          openedAt: { gte: new Date(Date.now() - 60_000) }, // within last 60 seconds
        },
        orderBy: { openedAt: "desc" },
      })
      if (recent) {
        dbTrade = recent
        console.log(
          `[placeOrder] Fallback found: id=${recent.id}, sourceTradeId=${recent.sourceTradeId}`,
        )
      } else {
        console.warn(
          `[placeOrder] FAILED to find DB record for ${instrument} ${direction} (sourceId=${sourceId})`,
        )
        // Last resort: list all recent trades for debugging
        const allRecent = await prisma.trade.findMany({
          where: {
            source: "oanda",
            instrument,
            openedAt: { gte: new Date(Date.now() - 120_000) },
          },
          select: { id: true, sourceTradeId: true, status: true, direction: true, openedAt: true },
          orderBy: { openedAt: "desc" },
          take: 5,
        })
        console.warn(`[placeOrder] Recent DB trades for ${instrument}:`, JSON.stringify(allRecent))
      }
    }

    // Apply metadata (placedVia) to the reconciled record — this is the authoritative
    // source attribution. Done post-reconcile to guarantee the record exists with the
    // correct OANDA order/trade ID.
    if (dbTrade) {
      try {
        const { db: prisma } = await import("@fxflow/db")
        await prisma.trade.update({
          where: { id: dbTrade.id },
          data: { metadata: JSON.stringify({ placedVia }) },
        })
        console.log(`[placeOrder] Metadata set: trade=${dbTrade.id}, placedVia=${placedVia}`)
      } catch (metaErr) {
        console.error(
          `[placeOrder] FAILED to set metadata for ${dbTrade.id}:`,
          (metaErr as Error).message,
        )
      }
    } else {
      console.error(
        `[placeOrder] NO DB RECORD FOUND — metadata not set for ${instrument} ${direction} (sourceId=${sourceId}, placedVia=${placedVia})`,
      )
    }

    // Re-reconcile so the WS broadcast picks up the updated metadata
    await this.reconcile()

    // Create audit event and persist timeframe, notes, tags (best-effort)
    try {
      if (!dbTrade) dbTrade = await getTradeBySourceId("oanda", sourceId)
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
      }
    }

    await this.reconcile()

    return { stopLoss: verifiedSL, takeProfit: verifiedTP }
  }

  // ─── Sync lifecycle ───────────────────────────────────────────────────────

  private async startSync(): Promise<void> {
    if (!this.hasBackfilled) {
      await this.performBackfill()
      this.hasBackfilled = true
    }
    await this.reconcile()
    this.reconcileTimer = setInterval(() => void this.reconcile(), this.config.reconcileIntervalMs)
  }

  // ─── Backfill ─────────────────────────────────────────────────────────────

  private async performBackfill(): Promise<void> {
    const creds = this.stateManager.getCredentials()
    if (!creds) return

    this.abortController?.abort()
    this.abortController = new AbortController()

    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - this.config.backfillDays)

    console.log(`[trade-syncer] Backfilling last ${this.config.backfillDays} days of trades...`)

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
          await this.processBackfillFill(fill)
          totalProcessed++
        }
      }

      console.log(`[trade-syncer] Backfill complete: processed ${totalProcessed} fills`)
    } catch (error) {
      if ((error as Error).name === "AbortError") return
      console.error("[trade-syncer] Backfill error:", (error as Error).message)
    }
  }

  private async processBackfillFill(fill: OandaOrderFillTransactionDetailed): Promise<void> {
    // Handle trade opens
    if (fill.tradeOpened) {
      const units = parseFloat(fill.units) || 0
      const direction: TradeDirection = units > 0 ? "long" : "short"

      await upsertTrade({
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

      await removeStalePendingOrders(activeOrderIds, "oanda", reconcileTimestamp)

      // Group pending orders and open trades by instrument for parallel processing.
      // Each instrument's DB upserts are serialized via its own mutex, but different
      // instruments proceed concurrently. Lifecycle callbacks are collected and fired
      // after all instrument work completes to avoid interleaving with shared state.
      const ordersByInstrument = groupByInstrument(pendingOrders, (o) => o.instrument)
      const tradesByInstrument = groupByInstrument(openTrades, (t) => t.instrument)
      const allInstruments = new Set([...ordersByInstrument.keys(), ...tradesByInstrument.keys()])

      // Collect lifecycle events to fire after all instruments are processed
      const newPendingCallbacks: string[] = []
      const newFilledCallbacks: string[] = []

      const instrumentPromises = [...allInstruments].map((instrument) =>
        this.withInstrumentMutex(instrument, async () => {
          const instrumentOrders = ordersByInstrument.get(instrument) ?? []
          const instrumentTrades = tradesByInstrument.get(instrument) ?? []

          for (const order of instrumentOrders) {
            const dbRecord = await upsertTrade({
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

            if (dbRecord.metadata) {
              try {
                const meta = JSON.parse(dbRecord.metadata)
                if (meta.placedVia === "fxflow") order.source = "manual"
                else if (meta.placedVia === "ut_bot_alerts") order.source = "ut_bot_alerts"
                else if (meta.placedVia === "trade_finder") order.source = "trade_finder"
                else if (meta.placedVia === "trade_finder_auto") order.source = "trade_finder_auto"
                else if (meta.placedVia === "ai_trader") order.source = "ai_trader"
                else if (meta.placedVia === "ai_trader_manual") order.source = "ai_trader_manual"
              } catch {
                /* ignore malformed metadata */
              }
            }
            // Track new pending orders for lifecycle callbacks
            if (!this.knownPendingSourceIds.has(order.sourceOrderId) && this.hasBackfilled) {
              this.knownPendingSourceIds.add(order.sourceOrderId)
              newPendingCallbacks.push(dbRecord.id)
            } else {
              this.knownPendingSourceIds.add(order.sourceOrderId)
            }
          }

          for (const trade of instrumentTrades) {
            // Detect orders that transitioned pending → open (just filled)
            const wasKnownPending = this.knownPendingSourceIds.has(trade.sourceTradeId)
            const dbRecord = await upsertTrade({
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

            if (dbRecord.metadata) {
              try {
                const meta = JSON.parse(dbRecord.metadata)
                if (meta.placedVia === "fxflow") trade.source = "manual"
                else if (meta.placedVia === "ut_bot_alerts") trade.source = "ut_bot_alerts"
                else if (meta.placedVia === "trade_finder") trade.source = "trade_finder"
                else if (meta.placedVia === "trade_finder_auto") trade.source = "trade_finder_auto"
                else if (meta.placedVia === "ai_trader") trade.source = "ai_trader"
                else if (meta.placedVia === "ai_trader_manual") trade.source = "ai_trader_manual"
              } catch {
                /* ignore malformed metadata */
              }
            }
            // Track new open trades for lifecycle callbacks
            if (!this.knownOpenSourceIds.has(trade.sourceTradeId) && this.hasBackfilled) {
              this.knownOpenSourceIds.add(trade.sourceTradeId)
              if (wasKnownPending) {
                this.knownPendingSourceIds.delete(trade.sourceTradeId)
              }
              newFilledCallbacks.push(dbRecord.id)
            } else {
              this.knownOpenSourceIds.add(trade.sourceTradeId)
            }
          }
        }),
      )

      await Promise.all(instrumentPromises)

      // Fire lifecycle callbacks sequentially after all instrument upserts complete.
      // This avoids races between callbacks and the shared known-ID sets above.
      for (const dbId of newPendingCallbacks) {
        this.onPendingCreated?.(dbId)
      }
      for (const dbId of newFilledCallbacks) {
        this.onOrderFilled?.(dbId)
      }

      // Mark any DB "open" trades that are no longer in OANDA as closed
      const activeTradeIds = openTrades.map((t) => t.sourceTradeId)
      const orphaned = await closeOrphanedTrades("oanda", activeTradeIds)
      if (orphaned > 0) {
        console.log(`[trade-syncer] Closed ${orphaned} orphaned trade(s) in DB`)
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
      closedToday = await getClosedTradesToday(forexDayStart)
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
