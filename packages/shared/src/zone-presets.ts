import type { ZonePreset, ZoneDetectionConfig, ZoneDisplaySettings } from "@fxflow/types"

/** Preset algorithm configurations for zone detection */
export const ZONE_PRESETS: Record<ZonePreset, ZoneDetectionConfig> = {
  conservative: {
    preset: "conservative",
    minLegBodyRatio: 0.65,
    minLegBodyAtr: 1.8,
    maxBaseBodyRatio: 0.30,
    maxBaseCandles: 3,
    minMoveOutMultiple: 3.0,
    atrPeriod: 14,
    freshTestedThreshold: 0.30,
    freshInvalidatedThreshold: 1.0,
    minLegCandles: 1,
  },
  standard: {
    preset: "standard",
    minLegBodyRatio: 0.45,
    minLegBodyAtr: 1.0,
    maxBaseBodyRatio: 0.40,
    maxBaseCandles: 4,
    minMoveOutMultiple: 2.0,
    atrPeriod: 14,
    freshTestedThreshold: 0.50,
    freshInvalidatedThreshold: 1.0,
    minLegCandles: 1,
  },
  aggressive: {
    preset: "aggressive",
    minLegBodyRatio: 0.40,
    minLegBodyAtr: 0.8,
    maxBaseBodyRatio: 0.50,
    maxBaseCandles: 6,
    minMoveOutMultiple: 1.5,
    atrPeriod: 14,
    freshTestedThreshold: 0.50,
    freshInvalidatedThreshold: 1.0,
    minLegCandles: 1,
  },
  custom: {
    preset: "custom",
    minLegBodyRatio: 0.45,
    minLegBodyAtr: 1.0,
    maxBaseBodyRatio: 0.40,
    maxBaseCandles: 4,
    minMoveOutMultiple: 2.0,
    atrPeriod: 14,
    freshTestedThreshold: 0.50,
    freshInvalidatedThreshold: 1.0,
    minLegCandles: 1,
  },
}

/** Default zone display settings — zones off until user enables */
export const DEFAULT_ZONE_DISPLAY_SETTINGS: ZoneDisplaySettings = {
  enabled: false,
  maxZonesPerType: 5,
  minScore: 1.5,
  timeframeOverride: null,
  lookbackCandles: 1000,
  showInvalidated: false,
  showHigherTf: false,
  higherTimeframe: null,
  additionalTimeframes: [],
  algorithmConfig: ZONE_PRESETS.standard,
  curve: {
    enabled: false,
    timeframe: null,
    opacity: 0.08,
    showAxisLabel: true,
  },
}

/** Get default algorithm config for a given preset */
export function getPresetConfig(preset: ZonePreset): ZoneDetectionConfig {
  return { ...ZONE_PRESETS[preset] }
}
