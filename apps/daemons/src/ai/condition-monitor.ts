import type { TradeConditionData, PositionPriceTick, AnyDaemonMessage } from "@fxflow/types"
import type { OandaTradeSyncer } from "../oanda/trade-syncer.js"
import { derivePipValueUsdFromUnrealizedPL, getPipSize } from "@fxflow/shared"

/** Thrown when a destructive action is blocked by the grace period — condition should retry later */
class GracePeriodError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "GracePeriodError"
  }
}

interface PriceMap {
  [instrument: string]: number // mid price
}

/** Live bid/ask spread per instrument, updated on every tick */
interface SpreadMap {
  [instrument: string]: number // ask - bid (raw spread)
}

/** Tracks sustained PnL trigger state for hysteresis — prevents spike-based breakeven triggers */
interface SustainedTrigger {
  firstTriggerAt: number // epoch ms when condition first met
  count: number // consecutive ticks where condition held
}

interface CachedTradeData {
  id: string
  instrument: string
  entryPrice: number
  direction: "long" | "short"
  currentUnits: number
  stopLoss: number | null
  openedAt: number // epoch ms
  status: string
  /**
   * Last reconciled unrealized P&L in account currency. Used to derive a
   * per-pip USD rate for `pnl_currency` trigger evaluation — without this,
   * the evaluator cannot safely convert pip distances to USD on cross pairs.
   */
  unrealizedPL: number
  fetchedAt: number
}

/**
 * Cache TTL for trade snapshot data. Dropped from 60s → 5s because the old
 * 60s window was the root cause of the "expired condition never fired"
 * class of bugs: if OANDA modified the trade (partial close, SL move,
 * external close) during the window, we'd evaluate incoming ticks against
 * a stale `currentUnits` / `direction` / `stopLoss` snapshot. With a 5s
 * cache the worst-case staleness is 5s, and the trade-closed callback now
 * invalidates it synchronously so closes are observed immediately.
 *
 * Price ticks land at ~2-5 Hz per instrument, so a 5s cache still
 * deduplicates ~10-25 DB reads per instrument per refresh — plenty cheap.
 */
const TRADE_CACHE_TTL_MS = 5_000
/** Minimum time a pnl_pips trigger must sustain before firing a move_stop_loss action */
const PNL_SUSTAIN_MS = 30_000 // 30 seconds
/** Grace period for SL modification actions after trade open / condition creation */
const SL_GRACE_PERIOD_MS = 30_000 // 30 seconds
/** Grace period for destructive actions (close/cancel) */
const DESTRUCTIVE_GRACE_PERIOD_MS = 60_000 // 60 seconds
/** ATR multiplier for breakeven buffer: buffer = spread + (ATR_BUFFER_FACTOR × ATR) */
const ATR_BUFFER_FACTOR = 0.05

/**
 * ConditionMonitor evaluates active trade conditions against live price ticks
 * and time-based triggers. Executes actions via OandaTradeSyncer.
 *
 * Loaded from DB on startup and kept in-memory. Synced on every trade change.
 */
export class ConditionMonitor {
  private readonly conditions = new Map<string, TradeConditionData>() // conditionId → condition
  private readonly priceMap: PriceMap = {}
  private readonly spreadMap: SpreadMap = {}
  private readonly tradeSyncer: OandaTradeSyncer
  private readonly broadcast: (msg: AnyDaemonMessage) => void
  private checkTimer: NodeJS.Timeout | null = null
  private readonly tradeDataCache = new Map<string, CachedTradeData>()
  private lastTrailTime = new Map<string, number>()
  /** Tracks how long a pnl_pips trigger has been sustained (for hysteresis on SL moves) */
  private readonly sustainedTriggers = new Map<string, SustainedTrigger>()

  constructor(tradeSyncer: OandaTradeSyncer, broadcast: (msg: AnyDaemonMessage) => void) {
    this.tradeSyncer = tradeSyncer
    this.broadcast = broadcast
  }

  async start(): Promise<void> {
    // Recover conditions stuck in "executing" state from a previous crash
    try {
      const { recoverExecutingConditions } = await import("@fxflow/db")
      const recovered = await recoverExecutingConditions()
      if (recovered > 0) {
        console.warn(
          `[condition-monitor] Recovered ${recovered} condition(s) stuck in "executing" state from previous crash`,
        )
      }
    } catch (err) {
      console.error(
        "[condition-monitor] Failed to recover executing conditions:",
        (err as Error).message,
      )
    }

    // Crash recovery: activate orphaned child conditions whose parent already triggered
    try {
      const { db } = await import("@fxflow/db")
      const orphanedChildren = await db.tradeCondition.findMany({
        where: {
          status: "waiting",
          parentConditionId: { not: null },
          parentCondition: { status: "triggered" },
        },
        select: { id: true },
      })

      if (orphanedChildren.length > 0) {
        console.log(
          `[condition-monitor] Crash recovery: activating ${orphanedChildren.length} orphaned child conditions`,
        )
        for (const child of orphanedChildren) {
          await db.tradeCondition.update({
            where: { id: child.id },
            data: { status: "active" },
          })
        }
      }
    } catch (err) {
      console.error(
        "[condition-monitor] Failed to recover orphaned child conditions:",
        (err as Error).message,
      )
    }

    await this.loadFromDB()
    this.startTimeBasedChecks()
    console.log(`[condition-monitor] Loaded ${this.conditions.size} active conditions`)
  }

  stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer)
      this.checkTimer = null
    }
  }

  /** Called when a condition is created or updated via the web API */
  async reloadCondition(conditionId: string): Promise<void> {
    try {
      const { db } = await import("@fxflow/db")
      const row = await db.tradeCondition.findUnique({ where: { id: conditionId } })
      if (!row || row.status !== "active") {
        this.conditions.delete(conditionId)
        return
      }

      let triggerValue: Record<string, unknown>
      let actionParams: Record<string, unknown>
      try {
        triggerValue = JSON.parse(row.triggerValue) as Record<string, unknown>
        actionParams = JSON.parse(row.actionParams) as Record<string, unknown>
      } catch (parseErr) {
        console.error(
          `[condition-monitor] Invalid JSON in condition ${conditionId}:`,
          (parseErr as Error).message,
        )
        return // Skip this condition — don't add malformed data to in-memory map
      }

      const condition: TradeConditionData = {
        id: row.id,
        tradeId: row.tradeId,
        triggerType: row.triggerType as TradeConditionData["triggerType"],
        triggerValue,
        actionType: row.actionType as TradeConditionData["actionType"],
        actionParams,
        status: row.status as TradeConditionData["status"],
        label: row.label,
        createdBy: row.createdBy as "user" | "ai",
        analysisId: row.analysisId,
        priority: row.priority,
        expiresAt: row.expiresAt?.toISOString() ?? null,
        parentConditionId: row.parentConditionId ?? null,
        triggeredAt: null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }
      this.conditions.set(conditionId, condition)
    } catch (err) {
      console.error("[condition-monitor] reloadCondition error:", err)
    }
  }

  removeCondition(conditionId: string): void {
    this.conditions.delete(conditionId)
  }

  /** Clear all in-memory conditions (used after bulk DB cancel). */
  clearAll(): void {
    this.conditions.clear()
  }

  /**
   * Called when a trade is closed. Removes all in-memory conditions for the trade
   * and expires them in the DB (fire-and-forget) to prevent the race condition
   * where a condition action executes against an already-closed trade.
   */
  onTradeClosed(tradeId: string): void {
    // Remove all conditions for this trade from the in-memory map immediately
    for (const [id, condition] of this.conditions.entries()) {
      if (condition.tradeId === tradeId) {
        this.conditions.delete(id)
      }
    }

    // Invalidate cached trade data so stale "open" status is not used
    this.tradeDataCache.delete(tradeId)

    // Expire in DB — fire-and-forget so we don't block the close flow
    void import("@fxflow/db")
      .then(({ expireConditionsForTrade }) => expireConditionsForTrade(tradeId))
      .then((count) => {
        if (count > 0) {
          console.log(
            `[condition-monitor] Expired ${count} condition(s) for closed trade ${tradeId}`,
          )
        }
      })
      .catch((err) => {
        console.error(
          `[condition-monitor] Failed to expire conditions for trade ${tradeId}:`,
          (err as Error).message,
        )
      })
  }

  /** Invalidate cached trade data (call when trade status changes) */
  invalidateTradeCache(tradeId: string): void {
    this.tradeDataCache.delete(tradeId)
  }

  /** Called by OandaStreamClient on every price tick */
  onPriceTick(tick: PositionPriceTick): void {
    const mid = (tick.bid + tick.ask) / 2
    this.priceMap[tick.instrument] = mid
    this.spreadMap[tick.instrument] = tick.ask - tick.bid
    this.evaluatePriceConditions(tick.instrument, mid).catch((err) => {
      console.error(
        `[condition-monitor] Price condition evaluation error for ${tick.instrument}:`,
        (err as Error).message,
      )
    })
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async loadFromDB(): Promise<void> {
    try {
      const { listActiveConditions } = await import("@fxflow/db")
      const active = await listActiveConditions()
      this.conditions.clear()
      for (const c of active) {
        this.conditions.set(c.id, c)
      }
    } catch (err) {
      console.error("[condition-monitor] loadFromDB error:", err)
    }
  }

  private startTimeBasedChecks(): void {
    // Check time-based conditions every 60 seconds
    this.checkTimer = setInterval(() => {
      void this.evaluateTimeConditions()
      void this.expireOldConditions()
    }, 60_000)

    // Soft-delete terminal (expired/triggered/cancelled) conditions older
    // than 24 hours on an hourly tick. Without this, expired conditions
    // accumulate on long-lived trades and pollute the re-run AI prompt —
    // the model then wastes output tokens proposing `op: "remove"` for
    // every dead row, which was exactly the behaviour that showed up in
    // the April 15 analysis the user reported. The 24h window leaves
    // recent history visible in the condition-history tab for audit.
    const HOURLY_PRUNE_MS = 60 * 60 * 1000
    const runPrune = async () => {
      try {
        const { pruneTerminalConditions } = await import("@fxflow/db")
        const pruned = await pruneTerminalConditions(24)
        if (pruned > 0) {
          console.log(`[condition-monitor] Pruned ${pruned} terminal condition(s) older than 24h`)
        }
      } catch (err) {
        console.warn("[condition-monitor] Prune sweep failed:", (err as Error).message)
      }
    }
    // Run one immediately on startup (don't block start())
    void runPrune()
    setInterval(() => void runPrune(), HOURLY_PRUNE_MS).unref?.()
  }

  private async evaluatePriceConditions(instrument: string, currentPrice: number): Promise<void> {
    const toCheck: TradeConditionData[] = []

    for (const condition of this.conditions.values()) {
      if (condition.status !== "active") continue

      const triggerType = condition.triggerType
      if (
        triggerType === "price_reaches" ||
        triggerType === "price_breaks_above" ||
        triggerType === "price_breaks_below" ||
        triggerType === "pnl_pips" ||
        triggerType === "pnl_currency" ||
        triggerType === "trailing_stop"
      ) {
        toCheck.push(condition)
      }
    }

    // Sort by priority (lower = higher priority) so important conditions evaluate first.
    // This ensures e.g. a close_trade condition at priority 0 fires before a move_sl at priority 1.
    toCheck.sort((a, b) => a.priority - b.priority)

    // Track trades closed during this tick to skip remaining conditions for the same trade
    const closedTradeIds = new Set<string>()

    for (const condition of toCheck) {
      // Skip if this trade was already closed by a prior condition in this tick
      if (closedTradeIds.has(condition.tradeId)) continue

      const tradeData = await this.getTradeData(condition.tradeId)
      if (!tradeData || tradeData.instrument !== instrument) continue

      // Zero-units guard: if a partial close reduced the trade to 0 units,
      // the snapshot can transiently report currentUnits=0 before the next
      // reconcile tips it into `status: "closed"`. Evaluating conditions
      // against a 0-unit "open" trade is meaningless and would fire wrong
      // actions, so skip and let the reconcile sweep close it cleanly.
      if (tradeData.currentUnits === 0 || tradeData.status !== "open") {
        continue
      }

      // Trailing stop is a persistent condition — handle separately
      if (condition.triggerType === "trailing_stop") {
        const result = this.evaluateTrailingStop(condition, currentPrice, tradeData)
        if (result?.shouldMove) {
          // Throttle: skip if last trail was < 2s ago
          const now = Date.now()
          const lastTrail = this.lastTrailTime.get(condition.id) ?? 0
          if (now - lastTrail < 2000) continue

          try {
            await this.executeConditionAction({
              ...condition,
              actionType: "move_stop_loss",
              actionParams: { price: result.newSL },
            })

            this.lastTrailTime.set(condition.id, now)

            // Invalidate trade data cache so next tick sees new SL
            this.invalidateTradeCache(tradeData.id)

            // Create audit trail
            const { createTradeEvent } = await import("@fxflow/db")
            await createTradeEvent({
              tradeId: condition.tradeId,
              eventType: "CONDITION_TRIGGERED",
              detail: JSON.stringify({
                conditionId: condition.id,
                label: condition.label,
                triggerType: "trailing_stop",
                actionType: "move_stop_loss",
                newSL: result.newSL,
                currentPrice,
              }),
            })
          } catch (err) {
            console.error(
              `[condition-monitor] Trailing stop SL move failed for ${condition.id}:`,
              (err as Error).message,
            )
          }
        }
        continue
      }

      const triggered = this.checkPriceCondition(condition, currentPrice, instrument, tradeData)

      if (triggered) {
        // Hysteresis: pnl_pips triggers paired with move_stop_loss must sustain for 30s
        // to avoid spike-based breakeven moves that immediately get stopped out
        const needsSustain =
          condition.triggerType === "pnl_pips" && condition.actionType === "move_stop_loss"
        if (needsSustain) {
          const now = Date.now()
          const existing = this.sustainedTriggers.get(condition.id)
          if (!existing) {
            this.sustainedTriggers.set(condition.id, { firstTriggerAt: now, count: 1 })
            continue // Don't fire yet — wait for sustained confirmation
          }
          existing.count++
          if (now - existing.firstTriggerAt < PNL_SUSTAIN_MS) {
            continue // Still within sustain window — keep waiting
          }
          // Sustained long enough — clear tracking and proceed to fire
          this.sustainedTriggers.delete(condition.id)
        }

        await this.triggerCondition(condition, currentPrice)

        // If this was a close/cancel action, mark the trade so we skip remaining conditions
        if (condition.actionType === "close_trade" || condition.actionType === "cancel_order") {
          closedTradeIds.add(condition.tradeId)
        }
      } else {
        // Price dropped below threshold — reset sustain tracking
        if (this.sustainedTriggers.has(condition.id)) {
          this.sustainedTriggers.delete(condition.id)
        }
      }
    }
  }

  private checkPriceCondition(
    condition: TradeConditionData,
    currentPrice: number,
    instrument: string,
    tradeData?: CachedTradeData,
  ): boolean {
    const val = condition.triggerValue
    const pip = getPipSize(instrument)

    switch (condition.triggerType) {
      case "price_reaches": {
        const target = val.price as number | undefined
        if (!target) return false
        // Triggered when price is within 0.5 pip of the target
        return Math.abs(currentPrice - target) <= pip * 0.5
      }

      case "price_breaks_above": {
        const target = val.price as number | undefined
        if (!target) return false
        return currentPrice >= target
      }

      case "price_breaks_below": {
        const target = val.price as number | undefined
        if (!target) return false
        return currentPrice <= target
      }

      case "pnl_pips": {
        if (!tradeData) return false
        const targetPips = val.pips as number | undefined
        if (targetPips === undefined) return false
        const priceDiff =
          tradeData.direction === "long"
            ? currentPrice - tradeData.entryPrice
            : tradeData.entryPrice - currentPrice
        const currentPips = priceDiff / pip

        // Support direction: "profit" (default) triggers when profit >= target
        //                     "loss" triggers when unrealized loss >= target (absolute)
        const direction = (val.direction as string) ?? "profit"
        if (direction === "loss") {
          return currentPips <= -Math.abs(targetPips)
        }
        return currentPips >= targetPips
      }

      case "pnl_currency": {
        if (!tradeData) return false
        // UI sends "amount", AI suggestions may send "currency" — accept both
        const targetCurrency = (val.amount ?? val.currency) as number | undefined
        if (targetCurrency === undefined) return false

        // Compute unrealized P&L in ACCOUNT currency. The naive
        // `priceDiff × units` formula gives a value in the QUOTE currency
        // (JPY for EUR/JPY etc.), so for cross and JPY pairs it was wrong
        // by the USD/quote rate (often 100x+). We use the shared
        // `derivePipValueUsdFromUnrealizedPL` helper which inverts OANDA's
        // own math to get an exact per-pip USD value for this trade, then
        // multiplies by the signed pip delta.
        //
        // When no ground truth is available (early in the trade before
        // any reconcile), we fall back to the structural pip-value calc.
        // Cross pairs with no rate info fall through to "cannot evaluate"
        // and return false rather than firing on a wrong number.
        const pipSize = getPipSize(tradeData.instrument)
        const priceDiff =
          tradeData.direction === "long"
            ? currentPrice - tradeData.entryPrice
            : tradeData.entryPrice - currentPrice
        const pipsDelta = priceDiff / pipSize

        const pipValueUsd = derivePipValueUsdFromUnrealizedPL({
          instrument: tradeData.instrument,
          direction: tradeData.direction,
          entryPrice: tradeData.entryPrice,
          currentPrice,
          currentUnits: tradeData.currentUnits,
          unrealizedPL: tradeData.unrealizedPL,
        })
        if (pipValueUsd === null) {
          // Cannot safely compute — don't fire on a wrong number.
          return false
        }
        const estimatedPnl = pipsDelta * pipValueUsd

        const direction = (val.direction as string) ?? "profit"
        if (direction === "loss") {
          return estimatedPnl <= -Math.abs(targetCurrency)
        }
        return estimatedPnl >= targetCurrency
      }

      default:
        return false
    }
  }

  private async evaluateTimeConditions(): Promise<void> {
    const now = new Date()

    for (const condition of this.conditions.values()) {
      if (condition.status !== "active") continue

      if (condition.triggerType === "time_reached") {
        const target = condition.triggerValue.timestamp as string | undefined
        if (target && new Date(target) <= now) {
          await this.triggerCondition(condition, null)
        }
      }

      if (condition.triggerType === "duration_hours") {
        const hours = condition.triggerValue.hours as number | undefined
        if (!hours) continue

        // Use cached trade data instead of direct DB query (M3 fix)
        const tradeData = await this.getTradeData(condition.tradeId)
        if (!tradeData || tradeData.status !== "open") continue

        const durationMs = now.getTime() - tradeData.openedAt
        const durationHours = durationMs / 3600000
        if (durationHours >= hours) {
          await this.triggerCondition(condition, null)
        }
      }
    }
  }

  private async expireOldConditions(): Promise<void> {
    try {
      const { expireOldConditions, db } = await import("@fxflow/db")

      // Before the actual expiry pass, emit a one-time "approaching expiry"
      // notification for AI-created conditions within 24h of expiring. This
      // gives the user a chance to extend the rule before automation stops.
      //
      // Uses `expiredNotified` as an idempotency flag so we never double-send.
      const now = Date.now()
      const warningCutoff = new Date(now + 24 * 60 * 60 * 1000)
      const approaching = await db.tradeCondition.findMany({
        where: {
          status: "active",
          createdBy: "ai",
          deletedAt: null,
          expiredNotified: false,
          expiresAt: { not: null, lt: warningCutoff, gt: new Date(now) },
        },
        include: { trade: { select: { instrument: true } } },
        take: 25,
      })
      for (const cond of approaching) {
        try {
          const { createNotification } = await import("@fxflow/db")
          const pair = cond.trade.instrument.replace("_", "/")
          const hoursLeft = cond.expiresAt
            ? Math.max(1, Math.round((cond.expiresAt.getTime() - now) / 3_600_000))
            : 0
          await createNotification({
            severity: "info",
            source: "trade_condition",
            title: "AI condition expiring soon",
            message: `${pair}: "${cond.label ?? "Unlabeled rule"}" expires in ${hoursLeft}h`,
            metadata: { conditionId: cond.id, tradeId: cond.tradeId },
          })
          await db.tradeCondition.update({
            where: { id: cond.id },
            data: { expiredNotified: true },
          })
        } catch (warnErr) {
          console.warn(
            `[condition-monitor] Failed to emit approaching-expiry notification for ${cond.id}:`,
            (warnErr as Error).message,
          )
        }
      }

      const count = await expireOldConditions()
      if (count > 0) {
        // Remove expired from in-memory map
        for (const [id, condition] of this.conditions.entries()) {
          if (condition.expiresAt && new Date(condition.expiresAt) < new Date()) {
            this.conditions.delete(id)
          }
        }
      }
    } catch {
      // Ignore
    }
  }

  private async triggerCondition(
    condition: TradeConditionData,
    currentPrice: number | null,
  ): Promise<void> {
    // Step 1: Remove from in-memory map immediately (prevent concurrent re-evaluation)
    this.conditions.delete(condition.id)

    const { updateConditionStatus, createTradeEvent, createNotification } =
      await import("@fxflow/db")

    // Step 2: Mark as "executing" in DB BEFORE running the action (C2 crash safety)
    // If daemon crashes after this point, startup recovery will find it
    try {
      await updateConditionStatus(condition.id, "executing")
    } catch (err) {
      console.error(
        `[condition-monitor] Failed to set executing status for ${condition.id}:`,
        (err as Error).message,
      )
      // Re-add to memory so it can be retried on next tick
      this.conditions.set(condition.id, condition)
      return
    }

    let success = false
    let errorMsg: string | undefined

    try {
      console.log(
        `[condition-monitor] Triggering condition ${condition.id}: ${condition.actionType}`,
      )

      // Step 3: Execute the action
      await this.executeConditionAction(condition)
      success = true

      // Step 4a: Mark condition as triggered in DB after successful execution
      await updateConditionStatus(condition.id, "triggered", new Date())

      // Activate child conditions in the chain
      try {
        const { activateChildConditions } = await import("@fxflow/db")
        const activatedIds = await activateChildConditions(condition.id)
        for (const childId of activatedIds) {
          await this.reloadCondition(childId)
        }
        if (activatedIds.length > 0) {
          console.log(
            `[condition-monitor] Activated ${activatedIds.length} child condition(s) for parent ${condition.id}`,
          )
        }
      } catch (chainErr) {
        console.error(
          `[condition-monitor] Failed to activate child conditions for ${condition.id}:`,
          (chainErr as Error).message,
        )
      }

      // Log as trade event for audit trail
      await createTradeEvent({
        tradeId: condition.tradeId,
        eventType: "CONDITION_TRIGGERED",
        detail: JSON.stringify({
          conditionId: condition.id,
          label: condition.label,
          triggerType: condition.triggerType,
          triggerValue: condition.triggerValue,
          actionType: condition.actionType,
          actionParams: condition.actionParams,
          currentPrice,
        }),
      })
    } catch (err) {
      errorMsg = (err as Error).message
      success = false

      // Grace period: silently revert to active for retry — not a real failure
      if (err instanceof GracePeriodError) {
        console.log(`[condition-monitor] ${errorMsg}`)
        try {
          await updateConditionStatus(condition.id, "active")
        } catch {
          /* best effort revert */
        }
        this.conditions.set(condition.id, condition)
        return // Don't broadcast failure or create notification — will retry next tick
      }

      console.error(`[condition-monitor] Failed to execute condition ${condition.id}:`, errorMsg)

      // Step 4b: Execution failed — revert to "active" and re-add to memory for retry
      try {
        await updateConditionStatus(condition.id, "active")
      } catch {
        /* best effort revert */
      }
      this.conditions.set(condition.id, condition)
    }

    // Broadcast condition triggered event
    this.broadcast({
      type: "condition_triggered",
      timestamp: new Date().toISOString(),
      data: {
        conditionId: condition.id,
        tradeId: condition.tradeId,
        instrument: await this.getTradeInstrument(condition.tradeId),
        label: condition.label,
        actionType: condition.actionType,
        success,
        error: errorMsg,
      },
    })

    // Create notification
    await createNotification({
      severity: success ? "info" : "warning",
      source: "trade_condition",
      title: success ? "Trade Condition Triggered" : "Condition Action Failed",
      message: success
        ? `${condition.label ?? condition.actionType}: ${condition.actionType.replace("_", " ")} executed`
        : `${condition.label ?? condition.actionType}: ${errorMsg}`,
      metadata: { conditionId: condition.id, tradeId: condition.tradeId },
    })
  }

  private async executeConditionAction(condition: TradeConditionData): Promise<void> {
    // Get the trade's source trade ID
    const { db } = await import("@fxflow/db")
    const trade = await db.trade.findUnique({
      where: { id: condition.tradeId },
      select: {
        sourceTradeId: true,
        status: true,
        direction: true,
        entryPrice: true,
        openedAt: true,
      },
    })

    if (!trade) throw new Error(`Trade ${condition.tradeId} not found`)

    // Guard: skip execution if the trade is already closed (race condition safety)
    if (trade.status === "closed") {
      console.log(
        `[condition-monitor] Skipping action for condition ${condition.id} — trade ${condition.tradeId} is already closed`,
      )
      // Mark as expired rather than re-throwing so triggerCondition does not retry
      const { updateConditionStatus } = await import("@fxflow/db")
      await updateConditionStatus(condition.id, "expired")
      this.conditions.delete(condition.id)
      return
    }

    // Guard: grace period — prevents premature action execution after trade open
    // or condition creation. Different windows for destructive vs SL-modifying actions.
    const now = Date.now()
    const tradeOpenMs = trade.openedAt ? new Date(trade.openedAt).getTime() : 0
    const conditionCreatedMs = new Date(condition.createdAt).getTime()
    const referenceMs = Math.max(tradeOpenMs, conditionCreatedMs)
    const ageMs = now - referenceMs

    const isDestructive =
      condition.actionType === "close_trade" || condition.actionType === "cancel_order"
    const isSLMove = condition.actionType === "move_stop_loss"
    const gracePeriodMs = isDestructive
      ? DESTRUCTIVE_GRACE_PERIOD_MS
      : isSLMove
        ? SL_GRACE_PERIOD_MS
        : 0

    if (gracePeriodMs > 0 && ageMs < gracePeriodMs) {
      throw new GracePeriodError(
        `Grace period: ${condition.actionType} for condition ${condition.id} — ` +
          `reference age is only ${Math.round(ageMs / 1000)}s (need ${gracePeriodMs / 1000}s)`,
      )
    }

    const params = condition.actionParams

    const attribution = {
      closedBy: "ai_condition" as const,
      closedByLabel: "AI Condition",
      closedByDetail: condition.label ?? undefined,
    }

    switch (condition.actionType) {
      case "close_trade":
        await this.tradeSyncer.closeTrade(
          trade.sourceTradeId,
          undefined,
          `Condition triggered: ${condition.label ?? "automated condition"}`,
          attribution,
        )
        break

      case "partial_close": {
        const units = params.units as number | undefined
        if (!units) throw new Error("partial_close requires units param")
        await this.tradeSyncer.closeTrade(
          trade.sourceTradeId,
          units,
          `Partial close condition: ${condition.label ?? "automated"}`,
          attribution,
        )
        break
      }

      case "move_stop_loss": {
        let stopLoss = params.price as number | undefined
        if (!stopLoss) throw new Error("move_stop_loss requires price param")

        // Smart breakeven buffer: when moving SL to entry price (breakeven),
        // add spread + ATR-based buffer to prevent immediate stop-out from bid/ask spread.
        // Without this, a long trade with SL at exact entry gets stopped when bid dips
        // below entry even though mid price is still above.
        if (trade.status === "open") {
          const instrument = await this.getTradeInstrument(condition.tradeId)
          const pip = getPipSize(instrument)
          const originalSL = stopLoss
          const isBreakevenMove = Math.abs(stopLoss - trade.entryPrice) < pip * 1.5
          if (isBreakevenMove) {
            stopLoss = this.applyBreakevenBuffer(
              trade.entryPrice,
              trade.direction as "long" | "short",
              instrument,
            )
            console.log(
              `[condition-monitor] Breakeven buffer applied: entry=${trade.entryPrice} → buffered SL=${stopLoss} (${trade.direction} ${instrument})`,
            )

            // Persist closeContext for attribution — if this trade later hits SL,
            // we can trace it back to this AI-triggered breakeven move.
            try {
              await db.trade.update({
                where: { id: condition.tradeId },
                data: {
                  closeContext: JSON.stringify({
                    breakeven: true,
                    conditionId: condition.id,
                    conditionLabel: condition.label,
                    createdBy: condition.createdBy,
                    movedAt: new Date().toISOString(),
                    originalSL,
                    bufferedSL: stopLoss,
                    entryPrice: trade.entryPrice,
                  }),
                },
              })
            } catch {
              // Non-critical — don't fail the SL move if context save fails
            }
          }
          await this.tradeSyncer.modifyTradeSLTP(trade.sourceTradeId, stopLoss, undefined)
        } else if (trade.status === "pending") {
          await this.tradeSyncer.modifyPendingOrderSLTP(trade.sourceTradeId, stopLoss, undefined)
        }
        break
      }

      case "move_take_profit": {
        const takeProfit = params.price as number | undefined
        if (!takeProfit) throw new Error("move_take_profit requires price param")
        if (trade.status === "open") {
          await this.tradeSyncer.modifyTradeSLTP(trade.sourceTradeId, undefined, takeProfit)
        } else if (trade.status === "pending") {
          await this.tradeSyncer.modifyPendingOrderSLTP(trade.sourceTradeId, undefined, takeProfit)
        }
        break
      }

      case "cancel_order":
        if (trade.status !== "pending") {
          throw new Error(
            `Cannot cancel order — trade status is "${trade.status}", expected "pending"`,
          )
        }
        await this.tradeSyncer.cancelOrder(
          trade.sourceTradeId,
          `Condition triggered: ${condition.label ?? "automated condition"}`,
          "ai_condition",
        )
        break

      case "notify":
        // Notification is already created above — no additional action needed
        break

      default:
        throw new Error(`Unknown action type: ${condition.actionType}`)
    }
  }

  /**
   * Apply a smart buffer when moving SL to breakeven. Accounts for bid/ask spread
   * and a small ATR-based cushion so the SL doesn't get immediately triggered by
   * normal price noise around the entry level.
   *
   * Formula: buffered_price = entry ± (spread + ATR_BUFFER_FACTOR × ATR × pip)
   * Falls back to entry ± 1.5 pips if spread data is unavailable.
   */
  private applyBreakevenBuffer(
    entryPrice: number,
    direction: "long" | "short",
    instrument: string,
  ): number {
    const pip = getPipSize(instrument)
    const spread = this.spreadMap[instrument] ?? pip * 1.5 // fallback: 1.5 pip spread
    // Buffer = current spread + small ATR factor (ATR_BUFFER_FACTOR is 0.05)
    // We use spread as the primary buffer (it's the minimum distance needed)
    // plus a tiny volatility cushion. Total buffer is typically 1.5-5 pips.
    const buffer = spread + ATR_BUFFER_FACTOR * pip * 10 // ~0.5 pip extra cushion on top of spread
    const buffered =
      direction === "long"
        ? entryPrice + buffer // For longs: SL above entry so bid must drop further to trigger
        : entryPrice - buffer // For shorts: SL below entry so ask must rise further to trigger
    // Round to pip precision
    return Math.round(buffered / pip) * pip
  }

  private evaluateTrailingStop(
    condition: TradeConditionData,
    currentPrice: number,
    tradeData: CachedTradeData,
  ): { shouldMove: boolean; newSL: number } | null {
    const triggerValue =
      typeof condition.triggerValue === "string"
        ? JSON.parse(condition.triggerValue)
        : condition.triggerValue
    const distancePips = triggerValue.distance_pips as number
    const stepPips = (triggerValue.step_pips ?? distancePips) as number
    const instrument = tradeData.instrument
    const direction = tradeData.direction
    const pip = getPipSize(instrument)
    const distance = distancePips * pip
    const step = stepPips * pip

    // Calculate ideal SL based on current price
    let idealSL = direction === "long" ? currentPrice - distance : currentPrice + distance

    // Breakeven floor: if this trailing stop has a breakeven parent, never move SL
    // below the entry price. This preserves the breakeven protection.
    if (condition.parentConditionId) {
      const beFloor = this.applyBreakevenBuffer(tradeData.entryPrice, direction, instrument)
      if (direction === "long" && idealSL < beFloor) {
        idealSL = beFloor
      } else if (direction === "short" && idealSL > beFloor) {
        idealSL = beFloor
      }
    }

    const currentSL = tradeData.stopLoss
    if (!currentSL) return { shouldMove: true, newSL: Math.round(idealSL / pip) * pip }

    // Only move SL in favorable direction by at least step_pips
    if (direction === "long" && idealSL > currentSL + step * 0.5) {
      return { shouldMove: true, newSL: Math.round(idealSL / pip) * pip }
    }
    if (direction === "short" && idealSL < currentSL - step * 0.5) {
      return { shouldMove: true, newSL: Math.round(idealSL / pip) * pip }
    }
    return null
  }

  private async getTradeData(tradeId: string): Promise<CachedTradeData | null> {
    const cached = this.tradeDataCache.get(tradeId)
    if (cached && Date.now() - cached.fetchedAt < TRADE_CACHE_TTL_MS) {
      return cached
    }

    try {
      const { db } = await import("@fxflow/db")
      const trade = await db.trade.findUnique({
        where: { id: tradeId },
        select: {
          id: true,
          instrument: true,
          entryPrice: true,
          direction: true,
          currentUnits: true,
          stopLoss: true,
          openedAt: true,
          status: true,
          unrealizedPL: true,
        },
      })
      if (trade) {
        const data: CachedTradeData = {
          id: trade.id,
          instrument: trade.instrument,
          entryPrice: trade.entryPrice,
          direction: trade.direction as "long" | "short",
          currentUnits: trade.currentUnits,
          stopLoss: trade.stopLoss,
          openedAt: trade.openedAt.getTime(),
          status: trade.status,
          unrealizedPL: trade.unrealizedPL ?? 0,
          fetchedAt: Date.now(),
        }
        this.tradeDataCache.set(tradeId, data)
        return data
      }
    } catch {
      // ignore
    }
    return null
  }

  /** @deprecated Use getTradeData instead */
  private async getTradeInstrument(tradeId: string): Promise<string> {
    const data = await this.getTradeData(tradeId)
    return data?.instrument ?? ""
  }
}
