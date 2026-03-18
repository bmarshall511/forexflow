import type {
  SmartFlowConfigData,
  SmartFlowConfigRuntimeStatus,
  SmartFlowTradeData,
} from "@fxflow/types"

export interface TradePlanStatusInfo {
  /** Display state label */
  state: "trading" | "watching" | "paused" | "pending"
  /** Plain English description of what's happening */
  description: string
  /** Short strategy description */
  strategyDesc: string
}

const STRATEGY_DESCS: Record<string, string> = {
  momentum_catch: "Quick trades with tight protection",
  steady_growth: "Balanced approach with gradual profit-taking",
  swing_capture: "Wide stops with graduated exits for bigger moves",
  trend_rider: "Follows the trend with no fixed target",
  recovery: "Averages down on losing trades (advanced)",
  custom: "Custom strategy settings",
}

export function getTradePlanStatus(
  config: SmartFlowConfigData,
  _runtime: SmartFlowConfigRuntimeStatus | null,
  activeTrade: SmartFlowTradeData | undefined,
): TradePlanStatusInfo {
  const pair = config.instrument.replace("_", "/")
  const dir = config.direction === "long" ? "buying" : "selling"
  const strategyDesc = STRATEGY_DESCS[config.preset] ?? "Custom strategy"

  if (!config.isActive) {
    return {
      state: "paused",
      description: "This trade plan is paused. Activate it to start watching for opportunities.",
      strategyDesc,
    }
  }

  if (activeTrade?.status === "waiting_entry") {
    const target = config.entryPrice
    if (target) {
      return {
        state: "watching",
        description: `Waiting for ${pair} to reach ${target.toFixed(4)} before ${dir}.`,
        strategyDesc,
      }
    }
    return {
      state: "watching",
      description: `Watching ${pair} for the right moment to enter.`,
      strategyDesc,
    }
  }

  if (activeTrade && activeTrade.status !== "closed") {
    const phase = activeTrade.currentPhase
    const phaseDescs: Record<string, string> = {
      entry: `Trade is live — monitoring ${pair}.`,
      breakeven: `Managing your trade — break-even protection is active on ${pair}.`,
      trailing: `Trailing your safety exit on ${pair} — locking in profits as price moves.`,
      partial: `Taking partial profits on ${pair}.`,
      recovery: `Recovery mode active on ${pair} — averaging into position.`,
      safety_net: `Safety exit is close on ${pair}.`,
      target: `${pair} is approaching your profit target.`,
    }
    return {
      state: "trading",
      description: phaseDescs[phase] ?? `Managing your trade on ${pair}.`,
      strategyDesc,
    }
  }

  // Config is active but no trade record yet — trade is being placed or daemon hasn't synced
  if (config.isActive) {
    if (config.entryMode === "smart_entry") {
      return {
        state: "watching",
        description: `Watching ${pair} — waiting for the right conditions to enter.`,
        strategyDesc,
      }
    }
    return {
      state: "watching",
      description: `${pair} trade plan is active — SmartFlow is setting up your trade.`,
      strategyDesc,
    }
  }

  return {
    state: "pending",
    description: `${pair} trade plan is paused. Activate it to get started.`,
    strategyDesc,
  }
}
