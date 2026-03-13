import type { PeriodPnL, PnLPeriod, AccountOverviewData } from "@fxflow/types"
import { getForexPeriodBoundaries } from "@fxflow/shared"
import type { StateManager } from "../state-manager.js"
import type { OandaHealthChecker } from "./health-checker.js"
import {
  oandaGet,
  type OandaTransactionPagesResponse,
  type OandaTransactionPageResponse,
  type OandaOrderFillTransaction,
  type OandaDailyFinancingTransaction,
} from "./api-client.js"

const EMPTY_PNL: PeriodPnL = {
  realizedPL: 0,
  financing: 0,
  commission: 0,
  net: 0,
  tradeCount: 0,
}

export class AccountDataCollector {
  private pnlCache: Record<PnLPeriod, PeriodPnL> = {
    today: { ...EMPTY_PNL },
    yesterday: { ...EMPTY_PNL },
    thisWeek: { ...EMPTY_PNL },
    thisMonth: { ...EMPTY_PNL },
    thisYear: { ...EMPTY_PNL },
    allTime: { ...EMPTY_PNL },
  }

  private todayTimer: ReturnType<typeof setInterval> | null = null
  private shortTimer: ReturnType<typeof setInterval> | null = null
  private longTimer: ReturnType<typeof setInterval> | null = null
  /** Track all in-flight fetch controllers so stop/credential-change can cancel them all. */
  private activeControllers = new Set<AbortController>()

  constructor(
    private stateManager: StateManager,
    private healthChecker: OandaHealthChecker,
    private config: {
      todayPnlIntervalMs: number
      shortPnlIntervalMs: number
      longPnlIntervalMs: number
    },
  ) {
    // Rebuild overview whenever health check fires (new summary data)
    stateManager.onOandaChange(() => this.rebuildOverview())

    // Re-fetch all P&L when credentials change
    stateManager.onCredentialChange((creds) => {
      this.abortAll()
      if (creds) {
        this.clearCache()
        this.fetchAllPnL()
      } else {
        this.clearCache()
      }
    })
  }

  start(): void {
    this.fetchAllPnL()
    this.todayTimer = setInterval(() => this.fetchTodayPnL(), this.config.todayPnlIntervalMs)
    this.shortTimer = setInterval(() => this.fetchShortPnL(), this.config.shortPnlIntervalMs)
    this.longTimer = setInterval(() => this.fetchLongPnL(), this.config.longPnlIntervalMs)
  }

  stop(): void {
    if (this.todayTimer) {
      clearInterval(this.todayTimer)
      this.todayTimer = null
    }
    if (this.shortTimer) {
      clearInterval(this.shortTimer)
      this.shortTimer = null
    }
    if (this.longTimer) {
      clearInterval(this.longTimer)
      this.longTimer = null
    }
    this.abortAll()
  }

  /** Called by TransactionStreamClient on ORDER_FILL for instant P&L update. */
  refreshTodayPnL(): void {
    this.fetchTodayPnL()
  }

  // ─── P&L fetching ──────────────────────────────────────────────────────────

  private async fetchTodayPnL(): Promise<void> {
    const boundaries = getForexPeriodBoundaries(new Date())
    const result = await this.fetchPeriodPnL(boundaries.todayStart, new Date())
    if (result) {
      this.pnlCache.today = result
      this.rebuildOverview()
    }
  }

  private async fetchShortPnL(): Promise<void> {
    const boundaries = getForexPeriodBoundaries(new Date())
    const now = new Date()

    const [yesterday, thisWeek] = await Promise.all([
      this.fetchPeriodPnL(boundaries.yesterdayStart, boundaries.yesterdayEnd),
      this.fetchPeriodPnL(boundaries.weekStart, now),
    ])

    if (yesterday) this.pnlCache.yesterday = yesterday
    if (thisWeek) this.pnlCache.thisWeek = thisWeek
    this.rebuildOverview()
  }

  private async fetchLongPnL(): Promise<void> {
    const boundaries = getForexPeriodBoundaries(new Date())
    const now = new Date()

    const [thisMonth, thisYear] = await Promise.all([
      this.fetchPeriodPnL(boundaries.monthStart, now),
      this.fetchPeriodPnL(boundaries.yearStart, now),
    ])

    if (thisMonth) this.pnlCache.thisMonth = thisMonth
    if (thisYear) this.pnlCache.thisYear = thisYear
    this.rebuildOverview()
  }

  private async fetchAllPnL(): Promise<void> {
    const boundaries = getForexPeriodBoundaries(new Date())
    const now = new Date()

    const [today, yesterday, thisWeek, thisMonth, thisYear] = await Promise.all([
      this.fetchPeriodPnL(boundaries.todayStart, now),
      this.fetchPeriodPnL(boundaries.yesterdayStart, boundaries.yesterdayEnd),
      this.fetchPeriodPnL(boundaries.weekStart, now),
      this.fetchPeriodPnL(boundaries.monthStart, now),
      this.fetchPeriodPnL(boundaries.yearStart, now),
    ])

    if (today) this.pnlCache.today = today
    if (yesterday) this.pnlCache.yesterday = yesterday
    if (thisWeek) this.pnlCache.thisWeek = thisWeek
    if (thisMonth) this.pnlCache.thisMonth = thisMonth
    if (thisYear) this.pnlCache.thisYear = thisYear
    this.rebuildOverview()
  }

  private async fetchPeriodPnL(from: Date, to: Date): Promise<PeriodPnL | null> {
    const creds = this.stateManager.getCredentials()
    if (!creds) return null

    // Each fetch gets its own AbortController so concurrent calls don't cancel each other
    const controller = new AbortController()
    this.activeControllers.add(controller)

    try {
      const fromISO = from.toISOString()
      const toISO = to.toISOString()

      // Step 1: Get pagination URLs for ORDER_FILL and DAILY_FINANCING
      // DAILY_FINANCING captures overnight swap/financing charges that accrue daily.
      // ORDER_FILL.financing only captures the small closing-time financing charge.
      const [fillPages, financingPages] = await Promise.all([
        oandaGet<OandaTransactionPagesResponse>({
          mode: creds.mode,
          token: creds.token,
          path: `/v3/accounts/${creds.accountId}/transactions?from=${fromISO}&to=${toISO}&type=ORDER_FILL`,
          signal: controller.signal,
        }),
        oandaGet<OandaTransactionPagesResponse>({
          mode: creds.mode,
          token: creds.token,
          path: `/v3/accounts/${creds.accountId}/transactions?from=${fromISO}&to=${toISO}&type=DAILY_FINANCING`,
          signal: controller.signal,
        }),
      ])

      const allPageUrls = [
        ...(fillPages.pages ?? []),
        ...(financingPages.pages ?? []),
      ]

      // If no transactions of either type, return zeros
      if (allPageUrls.length === 0) {
        return { ...EMPTY_PNL }
      }

      // Step 2: Fetch each page and sum P&L
      let totalPL = 0
      let totalFinancing = 0
      let totalCommission = 0
      let tradeCount = 0

      for (const pageUrl of allPageUrls) {
        const parsed = new URL(pageUrl)
        const pathAndSearch = parsed.pathname + parsed.search

        const page = await oandaGet<OandaTransactionPageResponse>({
          mode: creds.mode,
          token: creds.token,
          path: pathAndSearch,
          signal: controller.signal,
        })

        for (const tx of page.transactions) {
          if (tx.type === "ORDER_FILL") {
            const fill = tx as OandaOrderFillTransaction
            totalPL += parseFloat(fill.pl) || 0
            totalFinancing += parseFloat(fill.financing) || 0
            totalCommission += parseFloat(fill.commission) || 0
            tradeCount++
          } else if (tx.type === "DAILY_FINANCING") {
            const daily = tx as OandaDailyFinancingTransaction
            totalFinancing += parseFloat(daily.financing) || 0
          }
        }
      }

      return {
        realizedPL: totalPL,
        financing: totalFinancing,
        commission: totalCommission,
        net: totalPL + totalFinancing + totalCommission,
        tradeCount,
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") return null

      console.error("[account-data] P&L fetch failed:", (error as Error).message)
      return null // Preserve stale cache by returning null
    } finally {
      this.activeControllers.delete(controller)
    }
  }

  // ─── Overview assembly ──────────────────────────────────────────────────────

  private rebuildOverview(): void {
    const summary = this.healthChecker.getLastSummary()
    if (!summary) return

    // All-time P&L comes directly from the account summary's lifetime fields
    this.pnlCache.allTime = {
      realizedPL: summary.pl,
      financing: summary.financing,
      commission: summary.commission,
      net: summary.pl + summary.financing + summary.commission,
      tradeCount: -1, // Not available without full transaction scan
    }

    const overview: AccountOverviewData = {
      summary,
      pnl: { ...this.pnlCache },
      lastUpdated: new Date().toISOString(),
    }

    this.stateManager.updateAccountOverview(overview)
  }

  private abortAll(): void {
    for (const controller of this.activeControllers) {
      controller.abort()
    }
    this.activeControllers.clear()
  }

  private clearCache(): void {
    for (const key of Object.keys(this.pnlCache) as PnLPeriod[]) {
      this.pnlCache[key] = { ...EMPTY_PNL }
    }
  }
}
