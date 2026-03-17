import type { SmartFlowConfigData, SmartFlowPreset, SmartFlowPresetDefaults } from "@fxflow/types"

// ─── Preset Definitions ────────────────────────────────────────────────

export const SMART_FLOW_PRESETS: Record<SmartFlowPreset, SmartFlowPresetDefaults> = {
  momentum_catch: {
    label: "Momentum Catch",
    description:
      "Quick trades that capture short-term momentum moves. Best for active traders who can monitor positions.",
    shortDescription: "Small, fast trades",
    slAtrMultiple: 0.5,
    tpAtrMultiple: 0.8,
    minRR: 1.6,
    breakevenEnabled: true,
    breakevenAtrMultiple: 0.5,
    trailingEnabled: false,
    trailingAtrMultiple: 0.3,
    trailingActivationAtr: 0.5,
    partialCloseRules: [],
    maxHoldHours: 8,
    recoveryEnabled: false,
    sessionAwareManagement: true,
    weekendCloseEnabled: true,
    newsProtectionEnabled: true,
    riskLevel: "medium",
  },

  steady_growth: {
    label: "Steady Growth",
    description:
      "Balanced approach with good risk-reward. Uses breakeven protection and partial closes to lock in profits while letting winners run.",
    shortDescription: "Balanced and reliable",
    slAtrMultiple: 0.75,
    tpAtrMultiple: 1.5,
    minRR: 2.0,
    breakevenEnabled: true,
    breakevenAtrMultiple: 0.75,
    trailingEnabled: true,
    trailingAtrMultiple: 0.5,
    trailingActivationAtr: 0.75,
    partialCloseRules: [{ atAtrMultiple: 1.0, closePercent: 50 }],
    maxHoldHours: 72,
    recoveryEnabled: false,
    sessionAwareManagement: true,
    weekendCloseEnabled: false,
    newsProtectionEnabled: true,
    riskLevel: "low",
  },

  swing_capture: {
    label: "Swing Capture",
    description:
      "Targets larger moves over days. Uses graduated partial closes and wide trailing stops to capture swing moves without getting stopped out by noise.",
    shortDescription: "Bigger gains, more patience",
    slAtrMultiple: 1.0,
    tpAtrMultiple: 3.0,
    minRR: 3.0,
    breakevenEnabled: true,
    breakevenAtrMultiple: 1.0,
    trailingEnabled: true,
    trailingAtrMultiple: 0.75,
    trailingActivationAtr: 1.0,
    partialCloseRules: [
      { atAtrMultiple: 1.5, closePercent: 33 },
      { atAtrMultiple: 2.5, closePercent: 33 },
    ],
    maxHoldHours: 336,
    recoveryEnabled: false,
    sessionAwareManagement: true,
    weekendCloseEnabled: false,
    newsProtectionEnabled: true,
    riskLevel: "medium",
  },

  trend_rider: {
    label: "Trend Rider",
    description:
      "Rides trends with no fixed take-profit. Uses ATR-based trailing stops that adapt to volatility. Takes partial profits as the trend extends.",
    shortDescription: "Ride the wave",
    slAtrMultiple: 1.2,
    tpAtrMultiple: 0,
    minRR: 1.5,
    breakevenEnabled: true,
    breakevenAtrMultiple: 1.0,
    trailingEnabled: true,
    trailingAtrMultiple: 1.0,
    trailingActivationAtr: 1.0,
    partialCloseRules: [
      { atAtrMultiple: 2.0, closePercent: 25 },
      { atAtrMultiple: 4.0, closePercent: 25 },
      { atAtrMultiple: 6.0, closePercent: 25 },
    ],
    maxHoldHours: 720,
    recoveryEnabled: false,
    sessionAwareManagement: true,
    weekendCloseEnabled: false,
    newsProtectionEnabled: true,
    riskLevel: "medium",
  },

  recovery: {
    label: "Recovery Mode",
    description:
      "Adds to losing positions at regular intervals to lower average entry. Exits on mean reversion for a small profit. HIGH RISK \u2014 maximum loss is significantly larger than initial position.",
    shortDescription: "Average down to recover",
    slAtrMultiple: 0.5,
    tpAtrMultiple: 0.3,
    minRR: 1.5,
    breakevenEnabled: false,
    breakevenAtrMultiple: 0,
    trailingEnabled: false,
    trailingAtrMultiple: 0,
    trailingActivationAtr: 0,
    partialCloseRules: [],
    maxHoldHours: 720,
    recoveryEnabled: true,
    sessionAwareManagement: true,
    weekendCloseEnabled: false,
    newsProtectionEnabled: true,
    riskLevel: "advanced",
  },

  custom: {
    label: "Custom",
    description:
      "Full control over every setting. Configure your own entry, management, and exit rules.",
    shortDescription: "Full control",
    slAtrMultiple: 0.75,
    tpAtrMultiple: 1.5,
    minRR: 2.0,
    breakevenEnabled: true,
    breakevenAtrMultiple: 0.75,
    trailingEnabled: true,
    trailingAtrMultiple: 0.5,
    trailingActivationAtr: 0.75,
    partialCloseRules: [{ atAtrMultiple: 1.0, closePercent: 50 }],
    maxHoldHours: 72,
    recoveryEnabled: false,
    sessionAwareManagement: true,
    weekendCloseEnabled: false,
    newsProtectionEnabled: true,
    riskLevel: "medium",
  },
}

// ─── Helpers ────────────────────────────────────────────────────────────

/** Returns the preset defaults for a given preset key. Falls back to steady_growth for unknown presets. */
export function getPresetDefaults(preset: SmartFlowPreset): SmartFlowPresetDefaults {
  return SMART_FLOW_PRESETS[preset] ?? SMART_FLOW_PRESETS.steady_growth
}

/**
 * Returns the config fields that should be applied when the user selects a preset.
 * Maps preset default field names to SmartFlowConfigData field names.
 */
export function applyPresetToConfig(preset: SmartFlowPreset): Partial<SmartFlowConfigData> {
  const defaults = getPresetDefaults(preset)

  return {
    preset,
    stopLossAtrMultiple: defaults.slAtrMultiple,
    takeProfitAtrMultiple: defaults.tpAtrMultiple,
    minRiskReward: defaults.minRR,
    breakevenEnabled: defaults.breakevenEnabled,
    breakevenAtrMultiple: defaults.breakevenAtrMultiple,
    trailingEnabled: defaults.trailingEnabled,
    trailingAtrMultiple: defaults.trailingAtrMultiple,
    trailingActivationAtr: defaults.trailingActivationAtr,
    partialCloseRules: defaults.partialCloseRules,
    maxHoldHours: defaults.maxHoldHours,
    recoveryEnabled: defaults.recoveryEnabled,
    sessionAwareManagement: defaults.sessionAwareManagement,
    weekendCloseEnabled: defaults.weekendCloseEnabled,
    newsProtectionEnabled: defaults.newsProtectionEnabled,
  }
}
