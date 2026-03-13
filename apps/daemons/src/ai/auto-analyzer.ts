import type { AiClaudeModel, AiAnalysisDepth, AiAnalysisTriggeredBy } from "@fxflow/types"
import type { StateManager } from "../state-manager.js"
import type { OandaTradeSyncer } from "../oanda/trade-syncer.js"
import type { ConditionMonitor } from "./condition-monitor.js"
import type { AnyDaemonMessage } from "@fxflow/types"
import { executeAnalysis } from "./analysis-executor.js"

interface QueueItem {
  tradeId: string
  tradeStatus: string
  triggeredBy: AiAnalysisTriggeredBy
  model: AiClaudeModel
  depth: AiAnalysisDepth
  retryCount: number
}

const MAX_RETRIES = 3
const RETRY_DELAYS_MS = [30_000, 120_000, 300_000] // 30s, 2min, 5min
const CONSECUTIVE_FAILURE_THRESHOLD = 3

/**
 * AutoAnalyzer listens to trade lifecycle events and automatically triggers
 * AI analysis based on user-configured settings.
 *
 * All analyses are queued to prevent concurrent Claude API calls.
 * Includes retry with exponential backoff and auto-disable after
 * repeated consecutive failures.
 */
export class AutoAnalyzer {
  private readonly queue: QueueItem[] = []
  private isProcessing = false
  private intervalTimer: NodeJS.Timeout | null = null
  private readonly recentFailures: number[] = [] // timestamps of recent failures
  private readonly FAILURE_WINDOW_MS = 30 * 60 * 1000 // 30-minute sliding window
  private readonly stateManager: StateManager
  private readonly tradeSyncer: OandaTradeSyncer
  private readonly broadcast: (msg: AnyDaemonMessage) => void
  private conditionMonitor: ConditionMonitor | null = null

  constructor(
    stateManager: StateManager,
    tradeSyncer: OandaTradeSyncer,
    broadcast: (msg: AnyDaemonMessage) => void,
  ) {
    this.stateManager = stateManager
    this.tradeSyncer = tradeSyncer
    this.broadcast = broadcast
  }

  setConditionMonitor(monitor: ConditionMonitor): void {
    this.conditionMonitor = monitor
  }

  /** Called when a new pending order is detected */
  async onPendingCreated(tradeId: string): Promise<void> {
    const settings = await this.getSettings()
    if (!settings?.enabled || !settings.onPendingCreate) {
      if (settings && !settings.enabled) console.log(`[auto-analyzer] Skipping pending-create — auto-analysis disabled`)
      return
    }
    this.enqueue({
      tradeId,
      tradeStatus: "pending",
      triggeredBy: "auto_pending",
      model: settings.defaultModel,
      depth: settings.defaultDepth,
      retryCount: 0,
    })
  }

  /** Called when a pending order fills (becomes an open trade) */
  async onOrderFilled(tradeId: string): Promise<void> {
    const settings = await this.getSettings()
    if (!settings?.enabled || !settings.onOrderFill) {
      if (settings && !settings.enabled) console.log(`[auto-analyzer] Skipping order-fill — auto-analysis disabled`)
      return
    }
    this.enqueue({
      tradeId,
      tradeStatus: "open",
      triggeredBy: "auto_fill",
      model: settings.defaultModel,
      depth: settings.defaultDepth,
      retryCount: 0,
    })
  }

  /** Called when a trade closes */
  async onTradeClosed(tradeId: string): Promise<void> {
    const settings = await this.getSettings()
    if (!settings?.enabled || !settings.onTradeClose) {
      if (settings && !settings.enabled) console.log(`[auto-analyzer] Skipping trade-close — auto-analysis disabled`)
      return
    }
    this.enqueue({
      tradeId,
      tradeStatus: "closed",
      triggeredBy: "auto_close",
      model: settings.defaultModel,
      depth: settings.defaultDepth,
      retryCount: 0,
    })
  }

  /** Start the interval analysis timer */
  start(): void {
    this.scheduleIntervalCheck()
  }

  stop(): void {
    if (this.intervalTimer) {
      clearTimeout(this.intervalTimer)
      this.intervalTimer = null
    }
    this.queue.length = 0
  }

  private async getSettings() {
    try {
      const { getAutoAnalysisSettings } = await import("@fxflow/db")
      return getAutoAnalysisSettings()
    } catch (err) {
      console.error("[auto-analyzer] Failed to load settings:", (err as Error).message)
      return null
    }
  }

  private enqueue(item: QueueItem): void {
    // Prevent duplicate queuing for the same trade + trigger (except retries)
    if (item.retryCount === 0) {
      const alreadyQueued = this.queue.some((q) => q.tradeId === item.tradeId && q.triggeredBy === item.triggeredBy)
      if (alreadyQueued) return
    }

    this.queue.push(item)
    console.log(`[auto-analyzer] Queued ${item.triggeredBy} analysis for trade ${item.tradeId}${item.retryCount > 0 ? ` (retry ${item.retryCount}/${MAX_RETRIES})` : ""} (queue: ${this.queue.length})`)
    void this.processQueue()
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return
    this.isProcessing = true

    try {
      while (this.queue.length > 0) {
        const item = this.queue.shift()!
        try {
          await this.runAnalysis(item)
        } catch (err) {
          console.error(`[auto-analyzer] Unhandled error processing ${item.tradeId}:`, (err as Error).message)
        }
      }
    } finally {
      this.isProcessing = false
    }
  }

  private async runAnalysis(item: QueueItem): Promise<void> {
    try {
      // Validate API key before attempting analysis (prevents wasting DB records)
      if (item.retryCount === 0) {
        const { validateClaudeApiKey } = await import("@fxflow/db")
        const keyStatus = await validateClaudeApiKey()
        if (!keyStatus.valid) {
          console.error(`[auto-analyzer] API key invalid: ${keyStatus.error}`)
          await this.handleFailure(item, keyStatus.error ?? "API key validation failed")
          return
        }
      }

      // Check if already recently analyzed
      const { getRecentAnalysisForTrade, createAnalysis } = await import("@fxflow/db")
      const recent = await getRecentAnalysisForTrade(item.tradeId, 30)
      if (recent && recent.triggeredBy !== "user") {
        console.log(`[auto-analyzer] Skipping ${item.tradeId} — analyzed ${recent.createdAt}`)
        return
      }

      const analysis = await createAnalysis({
        tradeId: item.tradeId,
        depth: item.depth,
        model: item.model,
        tradeStatus: item.tradeStatus,
        triggeredBy: item.triggeredBy,
      })

      await executeAnalysis({
        analysisId: analysis.id,
        tradeId: item.tradeId,
        depth: item.depth,
        model: item.model,
        tradeStatus: item.tradeStatus,
        triggeredBy: item.triggeredBy,
        stateManager: this.stateManager,
        tradeSyncer: this.tradeSyncer,
        broadcast: this.broadcast,
        conditionMonitor: this.conditionMonitor,
      })

      // Success: no need to reset — sliding window self-prunes old failures
    } catch (err) {
      const errorMessage = (err as Error).message
      console.error(`[auto-analyzer] Failed analysis for ${item.tradeId}:`, errorMessage)
      await this.handleFailure(item, errorMessage)
    }
  }

  private async handleFailure(item: QueueItem, errorMessage: string): Promise<void> {
    const now = Date.now()
    this.recentFailures.push(now)
    // Prune old failures outside the sliding window
    while (this.recentFailures.length > 0 && this.recentFailures[0]! < now - this.FAILURE_WINDOW_MS) {
      this.recentFailures.shift()
    }

    // Auto-disable after threshold failures within the sliding window
    if (this.recentFailures.length >= CONSECUTIVE_FAILURE_THRESHOLD) {
      await this.disableAutoAnalysis(errorMessage)
      return // Don't retry if auto-disabled
    }

    // Retry with backoff if under max retries
    if (item.retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAYS_MS[item.retryCount] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]!
      const nextRetry = item.retryCount + 1
      console.log(`[auto-analyzer] Scheduling retry ${nextRetry}/${MAX_RETRIES} for ${item.tradeId} in ${delay / 1000}s`)

      setTimeout(() => {
        this.enqueue({ ...item, retryCount: nextRetry })
      }, delay)
    } else {
      console.warn(`[auto-analyzer] Max retries (${MAX_RETRIES}) exhausted for ${item.tradeId}`)
    }
  }

  private async disableAutoAnalysis(lastError: string): Promise<void> {
    console.error(`[auto-analyzer] ${CONSECUTIVE_FAILURE_THRESHOLD} consecutive failures — disabling auto-analysis`)

    try {
      const { disableAutoAnalysis, createNotification } = await import("@fxflow/db")
      const reason = `${CONSECUTIVE_FAILURE_THRESHOLD} consecutive analysis failures. Last error: ${lastError}`
      await disableAutoAnalysis(reason)

      await createNotification({
        severity: "critical",
        source: "ai_analysis",
        title: "Auto-Analysis Disabled",
        message: `Auto-analysis was automatically disabled after ${CONSECUTIVE_FAILURE_THRESHOLD} consecutive failures. Last error: ${lastError}. Re-enable in Settings > AI & Claude.`,
      })

      this.broadcast({
        type: "ai_auto_analysis_disabled",
        timestamp: new Date().toISOString(),
        data: {
          reason,
          disabledAt: new Date().toISOString(),
          lastFailureMessage: lastError,
        },
      })
    } catch (err) {
      console.error("[auto-analyzer] Failed to disable auto-analysis:", (err as Error).message)
    }
  }

  private scheduleIntervalCheck(): void {
    const check = async () => {
      try {
        const settings = await this.getSettings()
        if (settings?.enabled && settings.intervalEnabled && settings.intervalHours > 0) {
          await this.runIntervalAnalysis(settings.defaultModel, settings.defaultDepth)
        }
      } catch (err) {
        console.error("[auto-analyzer] Interval check error:", (err as Error).message)
      }
      // Reschedule
      this.intervalTimer = setTimeout(check, 30 * 60 * 1000) // Check every 30 min
    }
    this.intervalTimer = setTimeout(check, 5 * 60 * 1000) // First check after 5 min
  }

  private async runIntervalAnalysis(model: AiClaudeModel, depth: AiAnalysisDepth): Promise<void> {
    const settings = await this.getSettings()
    if (!settings) return

    const intervalMs = settings.intervalHours * 60 * 60 * 1000
    const cutoff = new Date(Date.now() - intervalMs)

    const positions = this.stateManager.getPositions()
    if (!positions) return

    const openTradeIds = positions.open.map((t) => t.id)
    if (openTradeIds.length === 0) return

    // Batch query instead of N+1
    const { getLatestAnalysisByTradeIds } = await import("@fxflow/db")
    const latestByTrade = await getLatestAnalysisByTradeIds(openTradeIds)

    for (const tradeId of openTradeIds) {
      const lastAnalysis = latestByTrade[tradeId]
      if (!lastAnalysis || new Date(lastAnalysis.createdAt) < cutoff) {
        this.enqueue({
          tradeId,
          tradeStatus: "open",
          triggeredBy: "auto_interval",
          model,
          depth,
          retryCount: 0,
        })
      }
    }
  }
}
