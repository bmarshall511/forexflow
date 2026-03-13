import { db } from "./client"
import { encrypt, decrypt } from "./encryption"
import type {
  AiSettingsData,
  AiAutoAnalysisSettings,
  AiClaudeModel,
} from "@fxflow/types"
import { AI_AUTO_ANALYSIS_DEFAULTS as DEFAULTS } from "@fxflow/types"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function keyLastFour(encrypted: string | null): string {
  if (!encrypted) return ""
  try {
    const decrypted = decrypt(encrypted)
    return decrypted.slice(-4)
  } catch {
    return ""
  }
}

function parseAutoAnalysis(json: string): AiAutoAnalysisSettings {
  try {
    return { ...DEFAULTS, ...(JSON.parse(json) as Partial<AiAutoAnalysisSettings>) }
  } catch {
    return { ...DEFAULTS }
  }
}

async function getOrCreate() {
  const existing = await db.aiSettings.findUnique({ where: { id: 1 } })
  if (existing) return existing
  return db.aiSettings.create({ data: { id: 1 } })
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function getAiSettings(): Promise<AiSettingsData> {
  const row = await getOrCreate()
  return {
    hasClaudeKey: !!row.claudeApiKey,
    claudeKeyLastFour: keyLastFour(row.claudeApiKey),
    hasFinnhubKey: !!row.finnhubApiKey,
    finnhubKeyLastFour: keyLastFour(row.finnhubApiKey),
    defaultModel: row.defaultModel as AiClaudeModel,
    autoAnalysis: parseAutoAnalysis(row.autoAnalysisJson),
  }
}

export async function saveClaudeApiKey(key: string): Promise<void> {
  await getOrCreate()
  await db.aiSettings.update({
    where: { id: 1 },
    data: { claudeApiKey: encrypt(key) },
  })
}

export async function saveFinnhubApiKey(key: string): Promise<void> {
  await getOrCreate()
  await db.aiSettings.update({
    where: { id: 1 },
    data: { finnhubApiKey: encrypt(key) },
  })
}

export async function deleteClaudeApiKey(): Promise<void> {
  await getOrCreate()
  await db.aiSettings.update({ where: { id: 1 }, data: { claudeApiKey: null } })
}

export async function deleteFinnhubApiKey(): Promise<void> {
  await getOrCreate()
  await db.aiSettings.update({ where: { id: 1 }, data: { finnhubApiKey: null } })
}

export async function saveAiPreferences(opts: {
  defaultModel?: AiClaudeModel
  autoAnalysis?: Partial<AiAutoAnalysisSettings>
}): Promise<void> {
  const row = await getOrCreate()
  const current = parseAutoAnalysis(row.autoAnalysisJson)

  await db.aiSettings.update({
    where: { id: 1 },
    data: {
      ...(opts.defaultModel ? { defaultModel: opts.defaultModel } : {}),
      ...(opts.autoAnalysis
        ? { autoAnalysisJson: JSON.stringify({ ...current, ...opts.autoAnalysis }) }
        : {}),
    },
  })
}

/** Decrypt and return the raw Claude API key — for internal daemon use only */
export async function getDecryptedClaudeKey(): Promise<string | null> {
  const row = await getOrCreate()
  if (!row.claudeApiKey) return null
  try {
    return decrypt(row.claudeApiKey)
  } catch (err) {
    console.error("[ai-settings] Failed to decrypt Claude API key:", (err as Error).message)
    return null
  }
}

/** Validate that the stored Claude API key can be decrypted */
export async function validateClaudeApiKey(): Promise<{ valid: boolean; error?: string }> {
  const row = await getOrCreate()
  if (!row.claudeApiKey) return { valid: false, error: "No Claude API key configured" }
  try {
    const key = decrypt(row.claudeApiKey)
    if (!key || key.length < 10) return { valid: false, error: "Stored API key appears invalid" }
    return { valid: true }
  } catch (err) {
    return { valid: false, error: `Key decryption failed: ${(err as Error).message}` }
  }
}

/** Decrypt and return the raw FinnHub API key — for internal daemon use only */
export async function getDecryptedFinnhubKey(): Promise<string | null> {
  const row = await getOrCreate()
  if (!row.finnhubApiKey) return null
  try {
    return decrypt(row.finnhubApiKey)
  } catch (err) {
    console.error("[ai-settings] Failed to decrypt Finnhub API key:", (err as Error).message)
    return null
  }
}

/** Get auto-analysis settings parsed — for daemon auto-trigger logic */
export async function getAutoAnalysisSettings(): Promise<AiAutoAnalysisSettings> {
  const row = await getOrCreate()
  return parseAutoAnalysis(row.autoAnalysisJson)
}

/** Disable auto-analysis due to repeated failures — called by daemon */
export async function disableAutoAnalysis(reason: string): Promise<void> {
  const row = await getOrCreate()
  const current = parseAutoAnalysis(row.autoAnalysisJson)
  await db.aiSettings.update({
    where: { id: 1 },
    data: {
      autoAnalysisJson: JSON.stringify({
        ...current,
        enabled: false,
        autoDisabledReason: reason,
        autoDisabledAt: new Date().toISOString(),
      }),
    },
  })
  console.warn(`[ai-settings] Auto-analysis disabled: ${reason}`)
}

/** Clear auto-disable state (when user manually re-enables) */
export async function clearAutoDisableReason(): Promise<void> {
  const row = await getOrCreate()
  const current = parseAutoAnalysis(row.autoAnalysisJson)
  await db.aiSettings.update({
    where: { id: 1 },
    data: {
      autoAnalysisJson: JSON.stringify({
        ...current,
        autoDisabledReason: null,
        autoDisabledAt: null,
      }),
    },
  })
}
