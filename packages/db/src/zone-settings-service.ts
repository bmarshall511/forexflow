/**
 * Zone display settings service — manages user preferences for zone visualization.
 *
 * Uses a singleton row (id=1) for app-wide zone display settings,
 * falling back to defaults when no settings are stored.
 *
 * @module zone-settings-service
 */
import { db } from "./client"
import type { ZoneDisplaySettings } from "@fxflow/types"
import { DEFAULT_ZONE_DISPLAY_SETTINGS } from "@fxflow/shared"

/** Get global zone display settings, falling back to defaults. */
export async function getZoneSettings(): Promise<ZoneDisplaySettings> {
  const row = await db.zoneSettings.findUnique({ where: { id: 1 } })

  if (!row) return { ...DEFAULT_ZONE_DISPLAY_SETTINGS }

  try {
    const parsed = JSON.parse(row.settingsJson) as Partial<ZoneDisplaySettings>
    return { ...DEFAULT_ZONE_DISPLAY_SETTINGS, ...parsed }
  } catch {
    return { ...DEFAULT_ZONE_DISPLAY_SETTINGS }
  }
}

/** Save global zone display settings (upserts single row). */
export async function saveZoneSettings(settings: ZoneDisplaySettings): Promise<void> {
  const json = JSON.stringify(settings)
  await db.zoneSettings.upsert({
    where: { id: 1 },
    create: { id: 1, settingsJson: json },
    update: { settingsJson: json },
  })
}
