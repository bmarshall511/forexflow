import type { PositionManager } from "./positions/position-manager.js"
import type {
  PlacementSource,
  SourcePriorityConfigData,
  SourcePriorityAction,
  SourcePriorityLogEntry,
  SourceAutoRank,
  TradeSource,
  TradingMode,
} from "@fxflow/types"
import {
  getSourcePriorityConfig,
  createPriorityLog,
  listPriorityLogs,
  getWinRateBySource,
} from "@fxflow/db"

// ─── Types ────────────────────────────────────────────────────────────────

interface LockEntry {
  source: PlacementSource
  acquiredAt: number
}

type CanPlaceResult =
  | { allowed: true }
  | { allowed: false; reason: string; action: SourcePriorityAction }

/** Minimal TradeSyncer interface — late-bound via setter. */
interface TradeSyncerRef {
  cancelOrder(
    sourceOrderId: string,
    reason?: string,
    cancelledBy?: "user" | "trade_finder" | "ai_condition",
  ): Promise<void>
}

type BroadcastFn = (type: string, payload: unknown) => void

// ─── Helpers ──────────────────────────────────────────────────────────────

const LOCK_TTL_MS = 10_000

/** Map enriched TradeSource values to the canonical PlacementSource. */
function tradeSourceToPlacementSource(source: TradeSource): PlacementSource | null {
  switch (source) {
    case "trade_finder":
    case "trade_finder_auto":
      return "trade_finder"
    case "ut_bot_alerts":
      return "tv_alerts"
    case "ai_trader":
    case "ai_trader_manual":
      return "ai_trader"
    case "smart_flow":
      return "smart_flow"
    default:
      return null
  }
}

// ─── SourcePriorityManager ────────────────────────────────────────────────

/**
 * Coordinates placement across all automation sources with priority-based
 * conflict resolution. Replaces PlacementGate with source-aware logic.
 *
 * - Manual placements ("fxflow") always win.
 * - Higher-priority automation sources can replace pending orders from
 *   lower-priority sources.
 * - In auto_select mode, priority is derived from win rate over a
 *   configurable window.
 */
export class SourcePriorityManager {
  private locks = new Map<string, LockEntry>()
  private config: SourcePriorityConfigData | null = null
  private tradeSyncer: TradeSyncerRef | null = null
  /** Resolver for the active OANDA account — wired from index.ts via setAccountResolver. */
  private accountResolver: (() => TradingMode | null) | null = null

  /** Cached auto-select rankings (null = never computed). */
  private autoRanks: SourceAutoRank[] | null = null
  private autoRanksComputedAt = 0

  constructor(
    private positionManager: PositionManager,
    private broadcast: BroadcastFn,
  ) {}

  // ─── Late-binding ─────────────────────────────────────────────────────

  setTradeSyncer(syncer: TradeSyncerRef): void {
    this.tradeSyncer = syncer
  }

  setAccountResolver(fn: () => TradingMode | null): void {
    this.accountResolver = fn
  }

  // ─── Config ───────────────────────────────────────────────────────────

  async loadConfig(): Promise<SourcePriorityConfigData> {
    try {
      this.config = await getSourcePriorityConfig()
      console.log(
        `[source-priority] Config loaded: enabled=${this.config.enabled}, mode=${this.config.mode}`,
      )
    } catch (err) {
      console.error("[source-priority] Failed to load config:", (err as Error).message)
      // Fallback: disabled (backwards compatible)
      this.config = {
        enabled: false,
        mode: "manual",
        priorityOrder: ["trade_finder", "tv_alerts", "ai_trader", "smart_flow"],
        autoSelectWindowDays: 30,
        autoSelectRecalcMinutes: 60,
      }
    }
    return this.config
  }

  getConfig(): SourcePriorityConfigData | null {
    return this.config
  }

  // ─── Priority Calculation ─────────────────────────────────────────────

  /**
   * Returns the numeric priority for a source (0 = highest).
   * In auto_select mode, recalculates from win rates if the cache is stale.
   */
  async getEffectivePriority(source: PlacementSource): Promise<number> {
    const config = this.config
    if (!config) return 999

    if (config.mode === "auto_select") {
      await this.ensureAutoRanksFresh()
      if (this.autoRanks) {
        const rank = this.autoRanks.find((r) => r.source === source)
        return rank ? rank.rank : 999
      }
    }

    // Manual mode: use the configured order
    const idx = config.priorityOrder.indexOf(source)
    return idx >= 0 ? idx : 999
  }

  getPriorityOrder(): PlacementSource[] {
    if (!this.config) return []

    if (this.config.mode === "auto_select" && this.autoRanks) {
      return this.autoRanks
        .slice()
        .sort((a, b) => a.rank - b.rank)
        .map((r) => r.source)
    }

    return [...this.config.priorityOrder]
  }

  getAutoSelectRanks(): SourceAutoRank[] | null {
    return this.autoRanks ? [...this.autoRanks] : null
  }

  // ─── Core Placement Check ─────────────────────────────────────────────

  /**
   * Determines whether a source is allowed to place a trade on an instrument.
   * If a lower-priority pending order exists, it will be cancelled and the
   * placement will be allowed.
   */
  async canPlace(instrument: string, source: PlacementSource): Promise<CanPlaceResult> {
    this.pruneExpired()

    const config = this.config
    if (!config || !config.enabled) {
      // System disabled — always allow (backwards compatible)
      return { allowed: true }
    }

    // Manual placements always allowed (they go through a different path,
    // but this handles the edge case where source="fxflow" is passed)
    // Note: "fxflow" is not a PlacementSource, so this is defensive only.

    const positions = this.positionManager.getPositions()

    // 1. Check for existing OPEN trade on the instrument — block everyone
    const openTrade = positions.open.find((t) => t.instrument === instrument)
    if (openTrade) {
      const reason = `Open trade already exists on ${instrument} (${openTrade.sourceTradeId})`
      this.logDecision(instrument, source, "blocked_open", reason, null, openTrade.id)
      return { allowed: false, reason, action: "blocked_open" }
    }

    // 2. Check for existing PENDING order on the instrument
    const pendingOrder = positions.pending.find((o) => o.instrument === instrument)
    if (pendingOrder) {
      const pendingSource = tradeSourceToPlacementSource(pendingOrder.source)

      // 2a. If the pending order is manual, block (manual always wins)
      if (!pendingSource) {
        const reason = `Manual pending order on ${instrument} (${pendingOrder.sourceOrderId}) — manual always wins`
        this.logDecision(instrument, source, "blocked_manual", reason, "fxflow", pendingOrder.id)
        return { allowed: false, reason, action: "blocked_manual" }
      }

      // 2b. Compare priorities
      const requestingPriority = await this.getEffectivePriority(source)
      const pendingPriority = await this.getEffectivePriority(pendingSource)

      if (requestingPriority < pendingPriority) {
        // Requesting source has HIGHER priority (lower number) — replace
        await this.cancelPendingForReplacement(instrument, pendingOrder.sourceOrderId)
        const reason = `Replaced ${pendingSource} pending order on ${instrument} (priority ${requestingPriority} < ${pendingPriority})`
        this.logDecision(
          instrument,
          source,
          "replaced_pending",
          reason,
          pendingSource,
          pendingOrder.id,
        )

        this.broadcast("source_priority_replaced", {
          instrument,
          replacedSource: pendingSource,
          replacedBy: source,
          cancelledOrderId: pendingOrder.sourceOrderId,
        })

        // Fall through to lock acquisition below
      } else {
        // Requesting source has LOWER or EQUAL priority — block
        const reason = `${pendingSource} pending order on ${instrument} has equal or higher priority (${pendingPriority} <= ${requestingPriority})`
        this.logDecision(
          instrument,
          source,
          "blocked_pending",
          reason,
          pendingSource,
          pendingOrder.id,
        )
        return { allowed: false, reason, action: "blocked_pending" }
      }
    }

    // 3. Check for in-flight lock from another source
    const existingLock = this.locks.get(instrument)
    if (existingLock && existingLock.source !== source) {
      const reason = `${existingLock.source} is already placing on ${instrument}`
      this.logDecision(instrument, source, "blocked_pending", reason, existingLock.source, null)
      return { allowed: false, reason, action: "blocked_pending" }
    }

    // 4. Allowed — acquire lock
    this.locks.set(instrument, { source, acquiredAt: Date.now() })
    this.logDecision(instrument, source, "placed", `Placement allowed on ${instrument}`, null, null)
    return { allowed: true }
  }

  // ─── Lock Management ──────────────────────────────────────────────────

  /**
   * Acquires the in-flight placement lock. Use this when canPlace() has
   * already been called and returned allowed=true but the caller needs
   * to re-acquire after an async gap.
   */
  acquireLock(instrument: string, source: PlacementSource): void {
    this.locks.set(instrument, { source, acquiredAt: Date.now() })
  }

  /** Release the lock after placement completes (success or failure). */
  releaseLock(instrument: string, source: PlacementSource): void {
    const entry = this.locks.get(instrument)
    if (entry && entry.source === source) {
      this.locks.delete(instrument)
    }
  }

  /** Number of active locks (for diagnostics). */
  get activeLockCount(): number {
    return this.locks.size
  }

  // ─── Pending Replacement ──────────────────────────────────────────────

  /**
   * Cancels the pending order on an instrument so a higher-priority source
   * can replace it. Returns true if cancellation succeeded.
   */
  private async cancelPendingForReplacement(
    instrument: string,
    sourceOrderId: string,
  ): Promise<boolean> {
    if (!this.tradeSyncer) {
      console.error("[source-priority] Cannot cancel pending — tradeSyncer not bound")
      return false
    }

    try {
      console.log(
        `[source-priority] Cancelling pending order ${sourceOrderId} on ${instrument} for replacement`,
      )
      await this.tradeSyncer.cancelOrder(
        sourceOrderId,
        "Replaced by higher-priority source",
        "user",
      )
      return true
    } catch (err) {
      console.error(
        `[source-priority] Failed to cancel pending order ${sourceOrderId}:`,
        (err as Error).message,
      )
      return false
    }
  }

  // ─── Auto-Select Rankings ─────────────────────────────────────────────

  /**
   * Queries win rates from DB and caches the result. Called on interval
   * or when manually triggered.
   */
  async refreshAutoSelectRanks(): Promise<SourceAutoRank[]> {
    const windowDays = this.config?.autoSelectWindowDays ?? 30

    try {
      const stats = await getWinRateBySource(windowDays)

      // Sort by win rate descending, break ties by total trades descending
      const ranked: SourceAutoRank[] = []
      for (const [source, data] of stats) {
        ranked.push({ source, winRate: data.winRate, trades: data.total, rank: 0 })
      }

      ranked.sort((a, b) => {
        if (b.winRate !== a.winRate) return b.winRate - a.winRate
        return b.trades - a.trades
      })

      // Assign ranks (0 = highest)
      for (let i = 0; i < ranked.length; i++) {
        const entry = ranked[i]
        if (entry) entry.rank = i
      }

      // Ensure all known sources have a rank (even if no trades)
      const allSources: PlacementSource[] = ["trade_finder", "tv_alerts", "ai_trader", "smart_flow"]
      for (const src of allSources) {
        if (!ranked.find((r) => r.source === src)) {
          ranked.push({ source: src, winRate: 0, trades: 0, rank: ranked.length })
        }
      }

      this.autoRanks = ranked
      this.autoRanksComputedAt = Date.now()

      console.log(
        "[source-priority] Auto-select ranks refreshed:",
        ranked.map((r) => `${r.source}=${r.winRate.toFixed(2)} (${r.trades} trades)`).join(", "),
      )

      this.broadcast("source_priority_ranks_updated", { ranks: ranked })

      return ranked
    } catch (err) {
      console.error(
        "[source-priority] Failed to refresh auto-select ranks:",
        (err as Error).message,
      )
      return this.autoRanks ?? []
    }
  }

  /** Ensures auto-select ranks are fresh, recomputing if stale. */
  private async ensureAutoRanksFresh(): Promise<void> {
    const recalcMs = (this.config?.autoSelectRecalcMinutes ?? 60) * 60 * 1000
    const elapsed = Date.now() - this.autoRanksComputedAt

    if (!this.autoRanks || elapsed > recalcMs) {
      await this.refreshAutoSelectRanks()
    }
  }

  // ─── Logs ─────────────────────────────────────────────────────────────

  async getRecentLogs(limit?: number): Promise<SourcePriorityLogEntry[]> {
    try {
      return await listPriorityLogs({ limit })
    } catch (err) {
      console.error("[source-priority] Failed to fetch logs:", (err as Error).message)
      return []
    }
  }

  // ─── Internal Helpers ─────────────────────────────────────────────────

  /** Fire-and-forget log to DB. Skips the write if no active OANDA account
   *  is resolvable — an unattributed row would dirty cross-account analytics. */
  private logDecision(
    instrument: string,
    requestingSource: PlacementSource,
    action: SourcePriorityAction,
    reason: string,
    existingSource: string | null,
    existingTradeId: string | null,
  ): void {
    const account = this.accountResolver?.() ?? null
    if (!account) {
      console.warn(
        `[source-priority] Skipping ${action} log for ${instrument}: no active OANDA account`,
      )
      return
    }
    createPriorityLog({
      account,
      instrument,
      requestingSource,
      action,
      reason,
      existingSource,
      existingTradeId,
    }).catch((err) => {
      console.error("[source-priority] Failed to write log:", (err as Error).message)
    })
  }

  private pruneExpired(): void {
    const now = Date.now()
    for (const [instrument, entry] of this.locks) {
      if (now - entry.acquiredAt > LOCK_TTL_MS) {
        console.warn(
          `[source-priority] Pruning stale lock: ${instrument} held by ${entry.source} for ${now - entry.acquiredAt}ms`,
        )
        this.locks.delete(instrument)
      }
    }
  }
}
