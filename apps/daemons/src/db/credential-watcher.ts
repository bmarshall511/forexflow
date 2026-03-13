import { getSettings, revealToken } from "@fxflow/db"
import type { TradingMode } from "@fxflow/types"
import type { StateManager } from "../state-manager.js"

export class CredentialWatcher {
  private intervalId: ReturnType<typeof setInterval> | null = null
  private lastMode: TradingMode | null = null
  private lastHasToken = false
  private lastAccountId: string | null = null

  constructor(
    private stateManager: StateManager,
    private pollIntervalMs: number,
  ) {}

  async start(): Promise<void> {
    await this.check()
    this.intervalId = setInterval(() => this.check(), this.pollIntervalMs)
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  /** Force an immediate credential check (e.g. after a mode switch). */
  async checkNow(): Promise<void> {
    return this.check()
  }

  private async check(): Promise<void> {
    try {
      const settings = await getSettings()
      const mode = settings.tradingMode
      const modeCredentials = settings.oanda[mode]
      const hasToken = modeCredentials.hasToken
      const hasAccountId = !!modeCredentials.accountId

      // Detect changes
      const modeChanged = this.lastMode !== mode
      const tokenChanged = this.lastHasToken !== hasToken
      const accountChanged = this.lastAccountId !== modeCredentials.accountId
      this.lastMode = mode
      this.lastHasToken = hasToken
      this.lastAccountId = modeCredentials.accountId

      if (modeChanged || tokenChanged || accountChanged) {
        if (hasToken && hasAccountId) {
          const token = await revealToken(mode)
          this.stateManager.updateCredentials({
            token,
            accountId: modeCredentials.accountId,
            mode,
          })
          console.log(
            `[cred-watcher] Loaded ${mode} credentials (account: ${modeCredentials.accountId})`,
          )
        } else {
          this.stateManager.updateCredentials(null)
          console.log(`[cred-watcher] No credentials for ${mode} mode`)
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error("[cred-watcher] Error checking credentials:", msg)
      if (msg.includes("DATABASE_URL")) {
        console.error(
          "[cred-watcher] DATABASE_URL is not set. Create apps/daemons/.env.local with DATABASE_URL and ENCRYPTION_KEY.",
        )
      }
    }
  }
}
