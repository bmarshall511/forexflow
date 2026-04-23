import { getSettings, revealToken } from "@fxflow/db"
import type { TradingMode } from "@fxflow/types"
import type { StateManager } from "../state-manager.js"

export class CredentialWatcher {
  private intervalId: ReturnType<typeof setInterval> | null = null
  private lastMode: TradingMode | null = null
  private lastHasToken = false
  private lastAccountId: string | null = null
  private lastError: string | null = null

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
  async checkNow(): Promise<{ ok: true } | { ok: false; error: string }> {
    await this.check()
    return this.lastError ? { ok: false, error: this.lastError } : { ok: true }
  }

  /** Last error message from the most recent check, or null on success. */
  getLastError(): string | null {
    return this.lastError
  }

  private async check(): Promise<void> {
    try {
      const settings = await getSettings()
      const mode = settings.tradingMode
      const modeCredentials = settings.oanda[mode]
      const hasToken = modeCredentials.hasToken
      const hasAccountId = !!modeCredentials.accountId

      // Detect changes relative to last successful state
      const modeChanged = this.lastMode !== mode
      const tokenChanged = this.lastHasToken !== hasToken
      const accountChanged = this.lastAccountId !== modeCredentials.accountId
      const hadError = this.lastError !== null

      // IMPORTANT: defer updating "last" state until AFTER the body succeeds so
      // a failed decrypt (wrong/missing ENCRYPTION_KEY) is retried on the next
      // tick instead of being permanently wedged. Previously we stamped
      // lastHasToken=true before revealToken() ran, so on throw the watcher
      // would silently skip the retry and the daemon would remain
      // "unconfigured" forever.
      if (modeChanged || tokenChanged || accountChanged || hadError) {
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

      this.lastMode = mode
      this.lastHasToken = hasToken
      this.lastAccountId = modeCredentials.accountId
      this.lastError = null
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      this.lastError = msg
      console.error("[cred-watcher] Error checking credentials:", msg)
      if (msg.includes("DATABASE_URL")) {
        console.error(
          "[cred-watcher] DATABASE_URL is not set. Add DATABASE_URL to the repo-root .env.local (single source of truth for both daemon and web).",
        )
      } else if (msg.includes("ENCRYPTION_KEY") || msg.toLowerCase().includes("decrypt")) {
        console.error(
          "[cred-watcher] ENCRYPTION_KEY is missing or has changed since these credentials were saved. The repo-root .env.local must contain the same ENCRYPTION_KEY that was in effect when the credentials were saved via the web UI.",
        )
      }
    }
  }
}
