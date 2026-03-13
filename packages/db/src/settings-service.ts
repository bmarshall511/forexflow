import { db } from "./client"
import { encrypt, decrypt } from "./encryption"
import type {
  TradingMode,
  OandaCredentials,
  SettingsResponse,
  SaveCredentialsRequest,
  TestConnectionResponse,
} from "@fxflow/types"

const OANDA_URLS: Record<TradingMode, string> = {
  practice: "https://api-fxpractice.oanda.com",
  live: "https://api-fxtrade.oanda.com",
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tokenLastFour(encrypted: string | null): string {
  if (!encrypted) return ""
  try {
    const decrypted = decrypt(encrypted)
    return decrypted.slice(-4)
  } catch {
    return ""
  }
}

function toCredentials(
  token: string | null,
  accountId: string | null,
): OandaCredentials {
  return {
    accountId: accountId ?? "",
    hasToken: !!token,
    tokenLastFour: tokenLastFour(token),
  }
}

async function getOrCreateSettings() {
  const existing = await db.settings.findUnique({ where: { id: 1 } })
  if (existing) return existing

  return db.settings.create({ data: { id: 1 } })
}

// ─── Public API ──────────────────────────────────────────────────────────────

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

export async function saveCredentials(
  req: SaveCredentialsRequest,
): Promise<OandaCredentials> {
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

export async function revealToken(mode: TradingMode): Promise<string> {
  const settings = await getOrCreateSettings()
  const encrypted = mode === "practice" ? settings.practiceToken : settings.liveToken

  if (!encrypted) {
    throw new Error(`No ${mode} token stored`)
  }

  return decrypt(encrypted)
}

export async function getRiskPercent(): Promise<number> {
  const settings = await getOrCreateSettings()
  return settings.riskPercent
}

export async function setRiskPercent(percent: number): Promise<void> {
  await getOrCreateSettings()
  await db.settings.update({
    where: { id: 1 },
    data: { riskPercent: Math.max(0.1, Math.min(10, percent)) },
  })
}

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
