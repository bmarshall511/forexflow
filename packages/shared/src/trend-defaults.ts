import type { TrendDisplaySettings, TrendVisualSettings, TrendDetectionConfig } from "@fxflow/types"

export const DEFAULT_TREND_VISUAL_SETTINGS: TrendVisualSettings = {
  showBoxes: false,
  showLines: true,
  showMarkers: true,
  showLabels: true,
  showControllingSwing: true,
  boxOpacity: 0.06,
}

export const DEFAULT_TREND_DETECTION_CONFIG: TrendDetectionConfig = {
  swingStrength: 5,
  minSegmentAtr: 0.5,
  maxSwingPoints: 20,
  lookbackCandles: 500,
}

export const DEFAULT_TREND_DISPLAY_SETTINGS: TrendDisplaySettings = {
  enabled: false,
  visuals: DEFAULT_TREND_VISUAL_SETTINGS,
  config: DEFAULT_TREND_DETECTION_CONFIG,
  showHigherTf: false,
  higherTimeframe: null,
}

/** Adaptive swing strength by timeframe: 3 for sub-hourly, 5 for hourly+ */
export function getDefaultSwingStrength(timeframe: string): number {
  switch (timeframe) {
    case "M1":
    case "M5":
    case "M15":
    case "M30":
      return 3
    default:
      return 5
  }
}
