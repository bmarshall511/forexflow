import { db } from "./client"
import type { TrendDisplaySettings } from "@fxflow/types"
import { DEFAULT_TREND_DISPLAY_SETTINGS } from "@fxflow/shared"

/** Get global trend display settings, falling back to defaults. */
export async function getTrendSettings(): Promise<TrendDisplaySettings> {
  const row = await db.trendSettings.findUnique({ where: { id: 1 } })

  if (!row) return { ...DEFAULT_TREND_DISPLAY_SETTINGS }

  try {
    const parsed = JSON.parse(row.settingsJson) as Partial<TrendDisplaySettings>
    return {
      ...DEFAULT_TREND_DISPLAY_SETTINGS,
      ...parsed,
      visuals: { ...DEFAULT_TREND_DISPLAY_SETTINGS.visuals, ...(parsed.visuals ?? {}) },
      config: { ...DEFAULT_TREND_DISPLAY_SETTINGS.config, ...(parsed.config ?? {}) },
    }
  } catch {
    return { ...DEFAULT_TREND_DISPLAY_SETTINGS }
  }
}

/** Save global trend display settings (upserts single row). */
export async function saveTrendSettings(settings: TrendDisplaySettings): Promise<void> {
  const json = JSON.stringify(settings)
  await db.trendSettings.upsert({
    where: { id: 1 },
    create: { id: 1, settingsJson: json },
    update: { settingsJson: json },
  })
}
