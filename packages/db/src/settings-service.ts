/**
 * Settings service — manages OANDA credentials, trading mode, and risk settings.
 *
 * Handles encrypted API token storage, practice/live mode switching,
 * credential CRUD, connection testing, and risk percent configuration.
 * Uses a singleton row (id=1) for app-wide settings.
 *
 * @module settings-service
 */
import { db } from "./client"
import { encrypt, decrypt } from "./encryption"
import type {
  TradingMode,
  OandaCredentials,
  SettingsResponse,
  SaveCredentialsRequest,
  TestConnectionResponse,
} from "@fxflow/types"

/** OANDA API base URLs per trading mode. */
const OANDA_URLS: Record<TradingMode, string> = {
  practice: "https://api-fxpractice.oanda.com",
  live: "https://api-fxtrade.oanda.com",
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract the last 4 characters of a decrypted token for display purposes.
 *
 * @param encrypted - The encrypted token string, or null
 * @returns Last 4 characters of the decrypted token, or empty string
 */
function tokenLastFour(encrypted: string | null): string {
  if (!encrypted) return ""
  try {
    const decrypted = decrypt(encrypted)
    return decrypted.slice(-4)
  } catch {
    return ""
  }
}

/**
 * Build an `OandaCredentials` DTO from stored encrypted token and account ID.
 *
 * @param token - Encrypted token string, or null
 * @param accountId - OANDA account ID, or null
 * @returns Credentials DTO with hasToken flag and masked token
 */
function toCredentials(token: string | null, accountId: string | null): OandaCredentials {
  return {
    accountId: accountId ?? "",
    hasToken: !!token,
    tokenLastFour: tokenLastFour(token),
  }
}

/** Get the singleton settings row, creating it with defaults if it does not exist. */
async function getOrCreateSettings() {
  const existing = await db.settings.findUnique({ where: { id: 1 } })
  if (existing) return existing

  return db.settings.create({ data: { id: 1 } })
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Get the current app settings including trading mode and OANDA credentials.
 *
 * @returns Settings response with mode and masked credentials for both environments
 */
export async function getSettings(): Promise<SettingsResponse> {
  const settings = await getOrCreateSettings()

  return {
    tradingMode: settings.tradingMode as TradingMode,
    oanda: {
      practice: toCredentials(settings.practiceToken, settings.practiceAccountId),
      live: toCredentials(settings.liveToken, settings.liveAccountId),
    },
  }
}

/**
 * Switch between practice and live trading modes.
 * Throws if switching to live mode without configured live credentials.
 *
 * @param mode - The trading mode to set ("practice" or "live")
 * @throws Error if live credentials are not configured when switching to live
 */
export async function setTradingMode(mode: TradingMode): Promise<void> {
  const settings = await getOrCreateSettings()

  if (mode === "live") {
    if (!settings.liveToken || !settings.liveAccountId) {
      throw new Error("Live credentials must be configured before switching to Live mode")
    }
  }

  await db.settings.update({
    where: { id: 1 },
    data: { tradingMode: mode },
  })
}

/**
 * Save OANDA credentials (account ID and optionally an API token) for a trading mode.
 * Tokens are encrypted before storage.
 *
 * @param req - Credentials to save including mode, account ID, and optional token
 * @returns Updated credentials DTO with masked token
 */
export async function saveCredentials(req: SaveCredentialsRequest): Promise<OandaCredentials> {
  await getOrCreateSettings()

  const tokenField = req.mode === "practice" ? "practiceToken" : "liveToken"
  const accountField = req.mode === "practice" ? "practiceAccountId" : "liveAccountId"

  const data: Record<string, string | undefined> = {
    [accountField]: req.accountId,
  }

  if (req.token !== undefined) {
    data[tokenField] = encrypt(req.token)
  }

  const updated = await db.settings.update({
    where: { id: 1 },
    data,
  })

  const token = req.mode === "practice" ? updated.practiceToken : updated.liveToken
  const accountId = req.mode === "practice" ? updated.practiceAccountId : updated.liveAccountId

  return toCredentials(token, accountId)
}

/**
 * Delete stored credentials for a trading mode. If deleting live credentials
 * while in live mode, automatically switches back to practice mode.
 *
 * @param mode - The trading mode whose credentials to delete
 * @returns The current trading mode after deletion
 */
export async function deleteCredentials(mode: TradingMode): Promise<TradingMode> {
  const settings = await getOrCreateSettings()

  const tokenField = mode === "practice" ? "practiceToken" : "liveToken"
  const accountField = mode === "practice" ? "practiceAccountId" : "liveAccountId"

  const data: Record<string, null | string> = {
    [tokenField]: null,
    [accountField]: null,
  }

  // Auto-switch to practice if deleting live credentials while in live mode
  if (mode === "live" && settings.tradingMode === "live") {
    data.tradingMode = "practice"
  }

  const updated = await db.settings.update({
    where: { id: 1 },
    data,
  })

  return updated.tradingMode as TradingMode
}

/**
 * Decrypt and return the full API token for a trading mode.
 *
 * @param mode - The trading mode to reveal the token for
 * @returns The decrypted API token
 * @throws Error if no token is stored for the given mode
 */
export async function revealToken(mode: TradingMode): Promise<string> {
  const settings = await getOrCreateSettings()
  const encrypted = mode === "practice" ? settings.practiceToken : settings.liveToken

  if (!encrypted) {
    throw new Error(`No ${mode} token stored`)
  }

  return decrypt(encrypted)
}

/**
 * Get the configured risk percentage per trade.
 *
 * @returns Risk percentage value
 */
export async function getRiskPercent(): Promise<number> {
  const settings = await getOrCreateSettings()
  return settings.riskPercent
}

/**
 * Set the risk percentage per trade, clamped between 0.1% and 10%.
 *
 * @param percent - The risk percentage to set
 */
export async function setRiskPercent(percent: number): Promise<void> {
  await getOrCreateSettings()
  await db.settings.update({
    where: { id: 1 },
    data: { riskPercent: Math.max(0.1, Math.min(10, percent)) },
  })
}

/**
 * Check whether the user has completed the onboarding wizard.
 *
 * @returns true if onboarding has been completed
 */
export async function getOnboardingCompleted(): Promise<boolean> {
  try {
    const settings = await getOrCreateSettings()
    return settings.onboardingCompleted
  } catch {
    // Column may not exist yet if schema hasn't been pushed — skip onboarding
    return true
  }
}

/**
 * Mark onboarding as completed.
 */
export async function setOnboardingCompleted(): Promise<void> {
  await getOrCreateSettings()
  await db.settings.update({
    where: { id: 1 },
    data: { onboardingCompleted: true },
  })
}

/**
 * Test the OANDA API connection for a trading mode by making a live API call.
 *
 * @param mode - The trading mode to test ("practice" or "live")
 * @returns Connection test result with success flag and optional error/account name
 */
export async function testConnection(mode: TradingMode): Promise<TestConnectionResponse> {
  const settings = await getOrCreateSettings()

  const token = mode === "practice" ? settings.practiceToken : settings.liveToken
  const accountId = mode === "practice" ? settings.practiceAccountId : settings.liveAccountId

  if (!token || !accountId) {
    return { success: false, error: `No ${mode} credentials configured` }
  }

  const decryptedToken = decrypt(token)
  const baseUrl = OANDA_URLS[mode]

  try {
    const response = await fetch(`${baseUrl}/v3/accounts/${accountId}`, {
      headers: {
        Authorization: `Bearer ${decryptedToken}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const body = await response.text()
      return {
        success: false,
        error: `OANDA API error (${response.status}): ${body}`,
      }
    }

    const data = (await response.json()) as { account?: { alias?: string } }
    return {
      success: true,
      accountName: data.account?.alias ?? `Account ${accountId}`,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to connect to OANDA",
    }
  }
}
