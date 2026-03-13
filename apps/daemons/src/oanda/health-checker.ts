import type { AccountSummaryData } from "@fxflow/types"
import type { StateManager } from "../state-manager.js"
import { oandaGet, type OandaAccountSummary } from "./api-client.js"

export class OandaHealthChecker {
  private intervalId: ReturnType<typeof setInterval> | null = null
  private abortController: AbortController | null = null
  private lastSummary: AccountSummaryData | null = null

  constructor(
    private stateManager: StateManager,
    private intervalMs: number,
  ) {
    // Re-check immediately when credentials change
    stateManager.onCredentialChange(() => {
      this.lastSummary = null
      this.checkNow()
    })
  }

  start(): void {
    this.checkNow()
    this.intervalId = setInterval(() => this.checkNow(), this.intervalMs)
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.abortController?.abort()
  }

  /** Get the last fully-parsed account summary (used by AccountDataCollector). */
  getLastSummary(): AccountSummaryData | null {
    return this.lastSummary
  }

  async checkNow(): Promise<void> {
    const creds = this.stateManager.getCredentials()
    if (!creds) {
      this.lastSummary = null
      this.stateManager.updateOanda({
        apiReachable: false,
        accountValid: false,
        marginCallActive: false,
        marginCallPercent: 0,
        balance: 0,
        marginAvailable: 0,
        openTradeCount: 0,
        openPositionCount: 0,
        pendingOrderCount: 0,
        lastHealthCheck: null,
        errorMessage: "No credentials configured",
      })
      return
    }

    // Abort any in-flight request
    this.abortController?.abort()
    this.abortController = new AbortController()

    try {
      const data = await oandaGet<OandaAccountSummary>({
        mode: creds.mode,
        token: creds.token,
        path: `/v3/accounts/${creds.accountId}/summary`,
        signal: this.abortController.signal,
      })

      const acct = data.account
      const marginCallPercent = parseFloat(acct.marginCallPercent) || 0
      const balance = parseFloat(acct.balance) || 0
      const marginAvailable = parseFloat(acct.marginAvailable) || 0
      const openTradeCount = acct.openTradeCount ?? 0
      const openPositionCount = acct.openPositionCount ?? 0
      const pendingOrderCount = acct.pendingOrderCount ?? 0

      // Store the full parsed summary for AccountDataCollector
      this.lastSummary = {
        accountId: acct.id,
        alias: acct.alias ?? "",
        currency: acct.currency ?? "USD",
        balance,
        nav: parseFloat(acct.NAV) || 0,
        unrealizedPL: parseFloat(acct.unrealizedPL) || 0,
        pl: parseFloat(acct.pl) || 0,
        financing: parseFloat(acct.financing) || 0,
        commission: parseFloat(acct.commission) || 0,
        marginUsed: parseFloat(acct.marginUsed) || 0,
        marginAvailable,
        marginCloseoutPercent: parseFloat(acct.marginCloseoutPercent) || 0,
        openTradeCount,
        openPositionCount,
        pendingOrderCount,
        positionValue: parseFloat(acct.positionValue) || 0,
        withdrawalLimit: parseFloat(acct.withdrawalLimit) || 0,
        hedgingEnabled: acct.hedgingEnabled ?? false,
        lastOrderFillTimestamp: acct.lastOrderFillTimestamp ?? null,
        createdTime: acct.createdTime ?? new Date().toISOString(),
      }

      // Update health state (including new trade count fields)
      this.stateManager.updateOanda({
        apiReachable: true,
        accountValid: true,
        marginCallActive: marginCallPercent >= 1.0,
        marginCallPercent,
        balance,
        marginAvailable,
        openTradeCount,
        openPositionCount,
        pendingOrderCount,
        lastHealthCheck: new Date().toISOString(),
        errorMessage: null,
      })
    } catch (error) {
      if ((error as Error).name === "AbortError") return

      const message = error instanceof Error ? error.message : "Health check failed"
      console.error("[health] Check failed:", message)

      this.stateManager.updateOanda({
        apiReachable: false,
        accountValid: false,
        lastHealthCheck: new Date().toISOString(),
        errorMessage: message,
      })
    }
  }
}
