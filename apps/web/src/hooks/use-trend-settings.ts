"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { TrendDisplaySettings, ChartPanelTrendOverrides } from "@fxflow/types"
import { DEFAULT_TREND_DISPLAY_SETTINGS } from "@fxflow/shared"

interface UseTrendSettingsReturn {
  /** Merged settings (global + per-chart overrides) */
  settings: TrendDisplaySettings
  /** Raw global settings */
  globalSettings: TrendDisplaySettings
  /** Save updated global settings */
  saveGlobal: (settings: TrendDisplaySettings) => Promise<void>
  /** Per-chart overrides */
  overrides: ChartPanelTrendOverrides
  /** Set per-chart overrides */
  setOverrides: (overrides: ChartPanelTrendOverrides) => void
}

/**
 * Manages trend display settings: fetches global from API, merges with per-chart overrides.
 * Mirrors the useZoneSettings pattern.
 */
export function useTrendSettings(
  initialOverrides?: ChartPanelTrendOverrides,
): UseTrendSettingsReturn {
  const [globalSettings, setGlobalSettings] = useState<TrendDisplaySettings>(
    DEFAULT_TREND_DISPLAY_SETTINGS,
  )
  const [overrides, setOverrides] = useState<ChartPanelTrendOverrides>(initialOverrides ?? {})
  const fetchedRef = useRef(false)

  // Fetch global settings once
  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true

    fetch("/api/trends/settings")
      .then((res) => res.json())
      .then((json) => {
        if (json.ok && json.data?.global) {
          setGlobalSettings((prev) => ({
            ...prev,
            ...json.data.global,
            visuals: { ...prev.visuals, ...(json.data.global.visuals ?? {}) },
            config: { ...prev.config, ...(json.data.global.config ?? {}) },
          }))
        }
      })
      .catch(() => {})
  }, [])

  // Merge global + overrides
  const settings: TrendDisplaySettings = {
    ...globalSettings,
    enabled: overrides.enabled ?? globalSettings.enabled,
    visuals: {
      ...globalSettings.visuals,
      showBoxes: overrides.showBoxes ?? globalSettings.visuals.showBoxes,
      showLines: overrides.showLines ?? globalSettings.visuals.showLines,
      showMarkers: overrides.showMarkers ?? globalSettings.visuals.showMarkers,
      showLabels: overrides.showLabels ?? globalSettings.visuals.showLabels,
    },
    showHigherTf: overrides.showHigherTf ?? globalSettings.showHigherTf,
  }

  const saveGlobal = useCallback(async (newSettings: TrendDisplaySettings) => {
    setGlobalSettings(newSettings)
    try {
      await fetch("/api/trends/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSettings),
      })
    } catch {
      // Settings save failed — local state still updated
    }
  }, [])

  return { settings, globalSettings, saveGlobal, overrides, setOverrides }
}
