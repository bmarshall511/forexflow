import type {
  DaemonStatusSnapshot,
  OandaHealthData,
  MarketStatusData,
  TradingMode,
  ConnectionStatus,
  AccountOverviewData,
  PositionsData,
  PositionsSummary,
  TVAlertsStatusData,
} from "@fxflow/types"
import { isMarketExpectedOpen, getNextExpectedChange } from "@fxflow/shared"

type Listener<T> = (data: T) => void

export interface ActiveCredentials {
  token: string
  accountId: string
  mode: TradingMode
}

export class StateManager {
  private startedAt = new Date().toISOString()

  private oanda: OandaHealthData = {
    status: "unconfigured",
    streamConnected: false,
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
    errorMessage: null,
    tradingMode: "practice",
  }

  private market: MarketStatusData = (() => {
    const now = new Date()
    return {
      isOpen: isMarketExpectedOpen(now),
      closeReason: null,
      lastStatusChange: now.toISOString(),
      nextExpectedChange: getNextExpectedChange(now).toISOString(),
      closeLabel: null,
    }
  })()

  private credentials: ActiveCredentials | null = null
  private accountOverview: AccountOverviewData | null = null
  private positions: PositionsData | null = null
  private positionsSummary: PositionsSummary | null = null
  private tvAlertsStatus: TVAlertsStatusData | null = null

  // Listeners
  private statusListeners: Listener<void>[] = []
  private oandaListeners: Listener<OandaHealthData>[] = []
  private marketListeners: Listener<MarketStatusData>[] = []
  private credentialChangeListeners: Listener<ActiveCredentials | null>[] = []
  private accountOverviewListeners: Listener<AccountOverviewData>[] = []
  private positionsListeners: Listener<PositionsData>[] = []
  private chartInstruments: string[] = []
  private chartInstrumentListeners: Listener<string[]>[] = []
  private tvAlertsListeners: Listener<TVAlertsStatusData>[] = []

  // ─── Getters ────────────────────────────────────────────────────────────────

  getSnapshot(): DaemonStatusSnapshot {
    return {
      uptimeSeconds: Math.floor((Date.now() - new Date(this.startedAt).getTime()) / 1000),
      startedAt: this.startedAt,
      tradingMode: this.oanda.tradingMode,
      oanda: { ...this.oanda },
      market: { ...this.market },
      accountOverview: this.accountOverview ? { ...this.accountOverview } : null,
      positions: this.positions,
      positionsSummary: this.positionsSummary,
      tvAlerts: this.tvAlertsStatus,
    }
  }

  getOanda(): OandaHealthData {
    return { ...this.oanda }
  }

  getMarket(): MarketStatusData {
    return { ...this.market }
  }

  getCredentials(): ActiveCredentials | null {
    return this.credentials
  }

  getAccountOverview(): AccountOverviewData | null {
    return this.accountOverview ? { ...this.accountOverview } : null
  }

  getPositions(): PositionsData | null {
    return this.positions
  }

  getChartInstruments(): string[] {
    return [...this.chartInstruments]
  }

  // ─── Updaters ───────────────────────────────────────────────────────────────

  updateOanda(partial: Partial<OandaHealthData>): void {
    const prev = JSON.stringify(this.oanda)
    Object.assign(this.oanda, partial)
    this.oanda.status = this.computeOandaStatus()

    if (prev !== JSON.stringify(this.oanda)) {
      this.oandaListeners.forEach((fn) => fn({ ...this.oanda }))
      this.statusListeners.forEach((fn) => fn())
    }
  }

  updateMarket(partial: Partial<MarketStatusData>): void {
    const prev = JSON.stringify(this.market)
    Object.assign(this.market, partial)

    if (prev !== JSON.stringify(this.market)) {
      this.marketListeners.forEach((fn) => fn({ ...this.market }))
      this.statusListeners.forEach((fn) => fn())
    }
  }

  updateCredentials(creds: ActiveCredentials | null): void {
    this.credentials = creds
    if (creds) {
      this.oanda.tradingMode = creds.mode
    } else {
      this.oanda.status = "unconfigured"
      this.accountOverview = null
    }
    this.credentialChangeListeners.forEach((fn) => fn(creds))
    this.statusListeners.forEach((fn) => fn())
  }

  updateAccountOverview(data: AccountOverviewData): void {
    const prev = JSON.stringify(this.accountOverview)
    this.accountOverview = data
    if (prev !== JSON.stringify(data)) {
      this.accountOverviewListeners.forEach((fn) => fn({ ...data }))
    }
  }

  updatePositions(data: PositionsData, summary: PositionsSummary): void {
    this.positions = data
    this.positionsSummary = summary
    this.positionsListeners.forEach((fn) => fn(data))
  }

  setChartInstruments(instruments: string[]): void {
    const sorted = [...new Set(instruments)].sort()
    if (JSON.stringify(sorted) === JSON.stringify(this.chartInstruments)) return
    this.chartInstruments = sorted
    this.chartInstrumentListeners.forEach((fn) => fn(sorted))
  }

  // ─── Computed status ────────────────────────────────────────────────────────

  private computeOandaStatus(): ConnectionStatus {
    if (!this.credentials) return "unconfigured"
    if (this.oanda.lastHealthCheck === null) return "connecting"
    if (!this.oanda.apiReachable || !this.oanda.accountValid) return "disconnected"
    if (this.oanda.marginCallActive) return "warning"
    if (!this.oanda.streamConnected) return "warning"
    return "connected"
  }

  // ─── Event subscription ─────────────────────────────────────────────────────

  onStatusChange(fn: Listener<void>): void {
    this.statusListeners.push(fn)
  }

  onOandaChange(fn: Listener<OandaHealthData>): void {
    this.oandaListeners.push(fn)
  }

  onMarketChange(fn: Listener<MarketStatusData>): void {
    this.marketListeners.push(fn)
  }

  onCredentialChange(fn: Listener<ActiveCredentials | null>): void {
    this.credentialChangeListeners.push(fn)
  }

  onAccountOverviewChange(fn: Listener<AccountOverviewData>): void {
    this.accountOverviewListeners.push(fn)
  }

  onPositionsChange(fn: Listener<PositionsData>): void {
    this.positionsListeners.push(fn)
  }

  onChartInstrumentsChange(fn: Listener<string[]>): void {
    this.chartInstrumentListeners.push(fn)
  }

  // ─── TV Alerts ──────────────────────────────────────────────────────────────

  getTVAlertsStatus(): TVAlertsStatusData | null {
    return this.tvAlertsStatus
  }

  updateTVAlertsStatus(data: TVAlertsStatusData): void {
    this.tvAlertsStatus = data
    this.tvAlertsListeners.forEach((fn) => fn(data))
  }

  onTVAlertsChange(fn: Listener<TVAlertsStatusData>): void {
    this.tvAlertsListeners.push(fn)
  }
}
