"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import type { ZoneDisplaySettings, ChartPanelZoneOverrides } from "@fxflow/types"
import { DEFAULT_ZONE_DISPLAY_SETTINGS, getPresetConfig } from "@fxflow/shared"

interface UseZoneSettingsReturn {
  /** Merged settings (global defaults + per-chart overrides) */
  settings: ZoneDisplaySettings
  /** Global settings only */
  globalSettings: ZoneDisplaySettings
  /** Save global settings to DB */
  saveGlobal: (settings: ZoneDisplaySettings) => Promise<void>
  /** Per-chart overrides */
  overrides: ChartPanelZoneOverrides
  /** Update per-chart overrides */
  setOverrides: (overrides: ChartPanelZoneOverrides) => void
  /** Whether settings are still loading */
  isLoading: boolean
}

/**
 * Fetch/save global zone settings and merge with per-chart overrides.
 * Global settings come from /api/zones/settings (persisted in DB).
 * Per-chart overrides come from the caller (stored in ChartPanelConfig).
 */
export function useZoneSettings(
  chartOverrides?: ChartPanelZoneOverrides,
): UseZoneSettingsReturn {
  const [globalSettings, setGlobalSettings] = useState<ZoneDisplaySettings>(DEFAULT_ZONE_DISPLAY_SETTINGS)
  const [overrides, setOverrides] = useState<ChartPanelZoneOverrides>(chartOverrides ?? {})
  const [isLoading, setIsLoading] = useState(true)

  // Fetch global settings on mount
  useEffect(() => {
    let cancelled = false
    fetch("/api/zones/settings")
      .then((res) => res.json())
      .then((json: { ok: boolean; data?: { global: ZoneDisplaySettings } }) => {
        if (!cancelled && json.ok && json.data) {
          const loaded = { ...DEFAULT_ZONE_DISPLAY_SETTINGS, ...json.data.global }
          // Settings migration: named presets always use current preset definitions.
          // This ensures preset threshold updates propagate to all users on that preset.
          const preset = loaded.algorithmConfig?.preset
          if (preset && preset !== "custom") {
            loaded.algorithmConfig = getPresetConfig(preset)
          }
          setGlobalSettings(loaded)
        }
      })
      .catch(() => {}) // Silently fail — use defaults
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Sync external overrides changes
  useEffect(() => {
    if (chartOverrides) setOverrides(chartOverrides)
  }, [chartOverrides])

  // Save global settings to DB
  const saveGlobal = useCallback(async (settings: ZoneDisplaySettings) => {
    setGlobalSettings(settings)
    try {
      await fetch("/api/zones/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })
    } catch (err) {
      console.error("[useZoneSettings] Failed to save:", err)
    }
  }, [])

  // Merge global + overrides
  const settings = useMemo((): ZoneDisplaySettings => ({
    ...globalSettings,
    ...(overrides.enabled !== undefined && { enabled: overrides.enabled }),
    ...(overrides.maxZonesPerType !== undefined && { maxZonesPerType: overrides.maxZonesPerType }),
    ...(overrides.minScore !== undefined && { minScore: overrides.minScore }),
    ...(overrides.showInvalidated !== undefined && { showInvalidated: overrides.showInvalidated }),
    ...(overrides.showHigherTf !== undefined && { showHigherTf: overrides.showHigherTf }),
  }), [globalSettings, overrides])

  return { settings, globalSettings, saveGlobal, overrides, setOverrides, isLoading }
}
