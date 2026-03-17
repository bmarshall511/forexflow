import { TrendingUp, Zap, ShieldCheck, AlertTriangle } from "lucide-react"
import type { SmartFlowPreset } from "@fxflow/types"

/** Display metadata for each SmartFlow preset (mirrors daemon preset-defaults.ts). */
export const PRESET_INFO: Record<
  Exclude<SmartFlowPreset, "custom">,
  { label: string; desc: string; risk: string; riskColor: string; icon: typeof Zap }
> = {
  momentum_catch: {
    label: "Momentum Catch",
    desc: "Quick trades that capture short-term moves. Best for active traders.",
    risk: "Medium",
    riskColor: "text-amber-500",
    icon: Zap,
  },
  steady_growth: {
    label: "Steady Growth",
    desc: "Balanced approach with breakeven protection and partial profits. Reliable and beginner-friendly.",
    risk: "Low",
    riskColor: "text-emerald-500",
    icon: ShieldCheck,
  },
  swing_capture: {
    label: "Swing Capture",
    desc: "Targets larger moves over days. Wider stops, graduated exits, more patience required.",
    risk: "Medium",
    riskColor: "text-amber-500",
    icon: TrendingUp,
  },
  trend_rider: {
    label: "Trend Rider",
    desc: "Rides trends with no fixed target. Trailing stops adapt to volatility as the trend extends.",
    risk: "Medium",
    riskColor: "text-amber-500",
    icon: TrendingUp,
  },
  recovery: {
    label: "Recovery Mode",
    desc: "Adds to losing positions to lower average entry. HIGH RISK — losses can be much larger than initial position.",
    risk: "Advanced",
    riskColor: "text-red-500",
    icon: AlertTriangle,
  },
}

/** Ordered preset keys (excluding custom) for iteration. */
export const PRESET_KEYS = Object.keys(PRESET_INFO) as Exclude<SmartFlowPreset, "custom">[]
