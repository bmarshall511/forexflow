import type {
  PositionsData,
  PositionsSummary,
  PendingOrderData,
  OpenTradeData,
  ClosedTradeData,
  TradeDirection,
} from "@fxflow/types"
import { getPipSize } from "@fxflow/shared"

type PositionsListener = (data: PositionsData) => void

interface MfeMaeState {
  mfe: number // pips, positive
  mae: number // pips, negative
}

export class PositionManager {
  private pending: PendingOrderData[] = []
  private open: OpenTradeData[] = []
  private closedToday: ClosedTradeData[] = []
  private listeners: PositionsListener[] = []

  /** In-memory MFE/MAE watermarks per open trade (keyed by sourceTradeId). */
  private mfeMaeMap = new Map<string, MfeMaeState>()

  // ─── Getters ──────────────────────────────────────────────────────────────

  getPositions(): PositionsData {
    return {
      pending: [...this.pending],
      open: [...this.open],
      closed: [...this.closedToday],
      lastUpdated: new Date().toISOString(),
    }
  }

  getSummary(): PositionsSummary {
    const todayWins = this.closedToday.filter((t) => t.outcome === "win").length
    const todayLosses = this.closedToday.filter((t) => t.outcome === "loss").length
    const todayNetPL = this.closedToday.reduce((sum, t) => sum + t.realizedPL + t.financing, 0)

    return {
      pendingCount: this.pending.length,
      openCount: this.open.length,
      closedTodayCount: this.closedToday.length,
      todayWins,
      todayLosses,
      todayNetPL,
    }
  }

  /** Returns unique instruments across all pending orders and open trades. */
  getActiveInstruments(): string[] {
    const instruments = new Set<string>()
    for (const order of this.pending) instruments.add(order.instrument)
    for (const trade of this.open) instruments.add(trade.instrument)
    return Array.from(instruments).sort()
  }

  /** Get current MFE/MAE for a trade (for DB persistence). */
  getMfeMae(sourceTradeId: string): MfeMaeState | undefined {
    return this.mfeMaeMap.get(sourceTradeId)
  }

  /** Get all dirty MFE/MAE entries for batch persistence. */
  getAllMfeMae(): Map<string, MfeMaeState> {
    return new Map(this.mfeMaeMap)
  }

  // ─── Batch update (called by TradeSyncer.reconcile) ─────────────────────

  /** Update all position data in a single batch, emitting only once. */
  batchUpdate(
    pending: PendingOrderData[],
    open: OpenTradeData[],
    closedToday: ClosedTradeData[],
  ): void {
    this.pending = pending
    this.mergeOpenMfeMae(open)
    this.open = open
    this.closedToday = closedToday
    this.emit()
  }

  // ─── Individual updaters (for rare single-field changes) ────────────────

  updatePending(orders: PendingOrderData[]): void {
    this.pending = orders
    this.emit()
  }

  updateOpen(trades: OpenTradeData[]): void {
    this.mergeOpenMfeMae(trades)
    this.open = trades
    this.emit()
  }

  updateClosedToday(trades: ClosedTradeData[]): void {
    this.closedToday = trades
    this.emit()
  }

  /**
   * Update live prices for open trades. Computes MFE/MAE watermarks in memory.
   * Does NOT emit — the PositionPriceTracker handles broadcasting prices separately
   * via throttled positions_price_update messages.
   */
  updateTradePrice(instrument: string, bid: number, ask: number): void {
    for (const trade of this.open) {
      if (trade.instrument !== instrument) continue

      const currentPrice = trade.direction === "long" ? bid : ask
      trade.currentPrice = currentPrice

      const pipSize = getPipSize(instrument)
      const plPips = computePLPips(trade.direction, trade.entryPrice, currentPrice, pipSize)

      let state = this.mfeMaeMap.get(trade.sourceTradeId)
      if (!state) {
        state = { mfe: Math.max(0, plPips), mae: Math.min(0, plPips) }
        this.mfeMaeMap.set(trade.sourceTradeId, state)
      } else {
        if (plPips > state.mfe) state.mfe = plPips
        if (plPips < state.mae) state.mae = plPips
      }

      trade.mfe = state.mfe
      trade.mae = state.mae
    }
    // No emit() — prices flow through positions_price_update (throttled at 500ms)
  }

  // ─── Events ───────────────────────────────────────────────────────────────

  onPositionsChange(fn: PositionsListener): void {
    this.listeners.push(fn)
  }

  private emit(): void {
    const data = this.getPositions()
    for (const fn of this.listeners) fn(data)
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────

  private mergeOpenMfeMae(trades: OpenTradeData[]): void {
    for (const trade of trades) {
      const existing = this.mfeMaeMap.get(trade.sourceTradeId)
      if (existing) {
        trade.mfe = existing.mfe
        trade.mae = existing.mae
      }
    }

    const openIds = new Set(trades.map((t) => t.sourceTradeId))
    for (const key of this.mfeMaeMap.keys()) {
      if (!openIds.has(key)) this.mfeMaeMap.delete(key)
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function computePLPips(
  direction: TradeDirection,
  entryPrice: number,
  currentPrice: number,
  pipSize: number,
): number {
  const distance = direction === "long"
    ? currentPrice - entryPrice
    : entryPrice - currentPrice
  return distance / pipSize
}
