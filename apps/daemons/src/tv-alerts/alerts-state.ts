import type { TVAlertsStatusData, TVAlertsConfig } from "@fxflow/types"

type Listener = (status: TVAlertsStatusData) => void

/**
 * In-memory state tracking for the TV Alerts module.
 * Tracks kill switch, cooldowns, daily P&L, circuit breaker, etc.
 */
export class TVAlertsState {
  private enabled = false
  private killSwitchActive = false
  private cfWorkerConnected = false
  private activeAutoPositions = 0
  private dailyPL = 0
  private dailyLossLimit = 0
  private circuitBreakerTripped = false
  private signalCountToday = 0
  private lastSignalTimestamp: string | null = null
  private cooldownMap = new Map<string, number>() // instrument → expiry timestamp
  private autoTradeIds = new Set<string>() // OANDA trade IDs opened by signal processor
  private listeners: Listener[] = []

  // ─── Getters ──────────────────────────────────────────────────────────────

  getStatus(): TVAlertsStatusData {
    return {
      enabled: this.enabled && !this.killSwitchActive,
      cfWorkerConnected: this.cfWorkerConnected,
      activeAutoPositions: this.activeAutoPositions,
      todayAutoPL: this.dailyPL,
      circuitBreakerTripped: this.circuitBreakerTripped,
      signalCountToday: this.signalCountToday,
      lastSignalAt: this.lastSignalTimestamp,
      cooldowns: Object.fromEntries(this.cooldownMap),
    }
  }

  isEnabled(): boolean {
    return this.enabled && !this.killSwitchActive
  }

  isKillSwitchActive(): boolean {
    return this.killSwitchActive
  }

  isCFWorkerConnected(): boolean {
    return this.cfWorkerConnected
  }

  isCircuitBreakerTripped(): boolean {
    return this.circuitBreakerTripped
  }

  // ─── Updaters ─────────────────────────────────────────────────────────────

  loadFromConfig(config: TVAlertsConfig): void {
    this.enabled = config.enabled
    this.dailyLossLimit = config.dailyLossLimit
    // Kill switch state: disabled = not active (module can trade)
    // We only toggle kill switch via setKillSwitch(), not from config.enabled
    this.emit()
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    this.emit()
  }

  setKillSwitch(active: boolean): void {
    this.killSwitchActive = active
    this.emit()
  }

  setCFWorkerConnected(connected: boolean): void {
    this.cfWorkerConnected = connected
    this.emit()
  }

  setActiveAutoPositions(count: number): void {
    this.activeAutoPositions = count
    this.emit()
  }

  updateDailyPL(pl: number): void {
    this.dailyPL = pl
    // Check circuit breaker
    if (this.dailyLossLimit > 0 && pl <= -this.dailyLossLimit) {
      if (!this.circuitBreakerTripped) {
        this.circuitBreakerTripped = true
        this.emit()
        return
      }
    }
    this.emit()
  }

  resetCircuitBreaker(): void {
    this.circuitBreakerTripped = false
    this.emit()
  }

  recordSignal(): void {
    this.signalCountToday++
    this.lastSignalTimestamp = new Date().toISOString()
    this.emit()
  }

  /** Sync signal count after an external DB change (e.g. history cleared). */
  setSignalCountToday(count: number): void {
    this.signalCountToday = count
    if (count === 0) this.lastSignalTimestamp = null
    this.emit()
  }

  // ─── Cooldowns ────────────────────────────────────────────────────────────

  startCooldown(instrument: string, durationSeconds: number): void {
    this.cooldownMap.set(instrument, Date.now() + durationSeconds * 1000)
    this.emit()
  }

  isCooldownActive(instrument: string): boolean {
    const expiry = this.cooldownMap.get(instrument)
    if (!expiry) return false
    if (Date.now() >= expiry) {
      this.cooldownMap.delete(instrument)
      return false
    }
    return true
  }

  clearCooldown(instrument: string): void {
    this.cooldownMap.delete(instrument)
    this.emit()
  }

  // ─── Auto-Trade Tracking ────────────────────────────────────────────────

  /** Mark an OANDA trade ID as opened by the signal processor. */
  addAutoTradeId(sourceTradeId: string): void {
    this.autoTradeIds.add(sourceTradeId)
  }

  /** Remove a trade ID from auto-trade tracking (after close). */
  removeAutoTradeId(sourceTradeId: string): void {
    this.autoTradeIds.delete(sourceTradeId)
  }

  /** Check if a trade was opened by the signal processor. */
  isAutoTrade(sourceTradeId: string): boolean {
    return this.autoTradeIds.has(sourceTradeId)
  }

  /** Get current auto-trade IDs (for diagnostics/audit). */
  getAutoTradeIds(): string[] {
    return [...this.autoTradeIds]
  }

  /**
   * Self-healing: rebuild autoTradeIds from DB metadata truth.
   * Called periodically to recover from stale in-memory state.
   * Additive-only — never removes IDs, only adds missing ones.
   */
  async syncAutoTradeIdsFromDB(getIds: () => Promise<string[]>): Promise<number> {
    const dbIds = await getIds()
    let added = 0
    for (const id of dbIds) {
      if (!this.autoTradeIds.has(id)) {
        this.autoTradeIds.add(id)
        added++
      }
    }
    if (added > 0) {
      console.log(`[alerts-state] Self-heal: added ${added} auto-trade ID(s) from DB metadata`)
    }
    return added
  }

  /** Restore state from DB on daemon startup (before any signals arrive). */
  initializeFromDB(opts: {
    activeAutoTradeIds: string[]
    activeAutoPositions: number
    todayAutoPL: number
    signalCountToday: number
  }): void {
    for (const id of opts.activeAutoTradeIds) this.autoTradeIds.add(id)
    this.activeAutoPositions = opts.activeAutoPositions
    this.dailyPL = opts.todayAutoPL
    this.signalCountToday = opts.signalCountToday
    // Check circuit breaker with restored P&L
    if (this.dailyLossLimit > 0 && opts.todayAutoPL <= -this.dailyLossLimit) {
      this.circuitBreakerTripped = true
    }
    this.emit()
  }

  // ─── Daily Reset ──────────────────────────────────────────────────────────

  resetDaily(): void {
    this.dailyPL = 0
    this.circuitBreakerTripped = false
    this.signalCountToday = 0
    this.cooldownMap.clear()
    this.autoTradeIds.clear()
    this.emit()
  }

  // ─── Events ───────────────────────────────────────────────────────────────

  onChange(fn: Listener): void {
    this.listeners.push(fn)
  }

  private emit(): void {
    const status = this.getStatus()
    for (const fn of this.listeners) fn(status)
  }
}
