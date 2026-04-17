/**
 * SmartFlow Config Health — evaluates each active config and reports a health status
 * with specific blocking reasons. Called on each autoPlaceActiveConfigs cycle.
 */
import type { SmartFlowConfigData, SmartFlowConfigHealth } from "@fxflow/types"
import { getPipSize } from "@fxflow/shared"
import { getPresetDefaults } from "./preset-defaults.js"

interface HealthContext {
  /** ATR for the config's instrument (null if unavailable) */
  atr: number | null
  /** Whether the config has an active SmartFlow trade */
  hasActiveTrade: boolean
  /** Whether the config is in waiting_entry status */
  isWaitingEntry: boolean
  /** Account balance */
  balance: number
  /** Whether source priority allows placement */
  sourcePriorityBlocked: boolean
  sourcePriorityReason: string | null
  /** Current live spread in pips (null if unavailable) */
  spreadPips: number | null
  /** Whether the scanner is enabled */
  scannerEnabled: boolean
}

export function evaluateConfigHealth(
  config: SmartFlowConfigData,
  ctx: HealthContext,
): SmartFlowConfigHealth {
  const base: SmartFlowConfigHealth = {
    status: "healthy",
    message: "Ready to trade",
    computedRR: null,
    requiredRR: config.minRiskReward,
    directionMisalignedSince: null,
    currentAtr: ctx.atr,
  }

  // 1. Config paused
  if (!config.isActive) {
    return { ...base, status: "paused", message: "Trade plan is paused" }
  }

  // 2. Already has an active trade
  if (ctx.hasActiveTrade) {
    return { ...base, status: "active_trade", message: "Trade is active and being managed" }
  }

  // 3. Waiting for smart entry
  if (ctx.isWaitingEntry) {
    return { ...base, status: "waiting_entry", message: "Watching for entry conditions" }
  }

  // 4. ATR unavailable (can't compute SL/TP)
  if (ctx.atr === null || ctx.atr <= 0) {
    return {
      ...base,
      status: "blocked_atr",
      message: "ATR unavailable — waiting for price data",
    }
  }

  // 5. Source priority blocking
  if (ctx.sourcePriorityBlocked) {
    return {
      ...base,
      status: "blocked_source_priority",
      message: ctx.sourcePriorityReason ?? "Blocked by source priority",
    }
  }

  // 6. Account balance check
  if (ctx.balance <= 0) {
    return { ...base, status: "blocked_margin", message: "Account balance unavailable" }
  }

  // 7. R:R check (the primary blocker we're fixing)
  const pip = getPipSize(config.instrument)
  const preset = getPresetDefaults(config.preset)
  const slAtrMultiple = config.stopLossAtrMultiple ?? preset.slAtrMultiple ?? 1.5
  const tpAtrMultiple = config.takeProfitAtrMultiple ?? preset.tpAtrMultiple ?? 2.0

  const sl = config.stopLossPips != null ? config.stopLossPips * pip : slAtrMultiple * ctx.atr
  const tp = config.takeProfitPips != null ? config.takeProfitPips * pip : tpAtrMultiple * ctx.atr

  // trend_rider has tp=0 (trailing only) — skip R:R check
  if (sl > 0 && tp > 0) {
    const rr = tp / sl
    base.computedRR = Math.round(rr * 100) / 100
    if (rr < config.minRiskReward) {
      return {
        ...base,
        status: "blocked_rr",
        message: `R:R ${rr.toFixed(2)} below minimum ${config.minRiskReward} — SL ${slAtrMultiple.toFixed(2)}x ATR, TP ${tpAtrMultiple.toFixed(2)}x ATR`,
      }
    }
  }

  // 8. Spread check (if available)
  if (ctx.spreadPips != null && sl > 0) {
    const slPips = sl / pip
    const maxSpreadPercent = 0.2 // 20% of SL
    if (ctx.spreadPips > slPips * maxSpreadPercent) {
      return {
        ...base,
        status: "blocked_spread",
        message: `Spread ${ctx.spreadPips.toFixed(1)} pips exceeds 20% of SL (${(slPips * maxSpreadPercent).toFixed(1)} pips)`,
      }
    }
  }

  return base
}
