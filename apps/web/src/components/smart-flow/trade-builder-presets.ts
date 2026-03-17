import { TrendingUp, Zap, ShieldCheck, AlertTriangle } from "lucide-react"
import type { SmartFlowPreset } from "@fxflow/types"

/** Display metadata for each SmartFlow preset (mirrors daemon preset-defaults.ts). */
export const PRESET_INFO: Record<
  Exclude<SmartFlowPreset, "custom">,
  {
    label: string
    desc: string
    risk: string
    riskColor: string
    icon: typeof Zap
    emoji: string
    holdTime: string
    protections: string[]
  }
> = {
  momentum_catch: {
    label: "Momentum Catch",
    desc: "Quick trades that capture short-term moves. Best for active traders.",
    risk: "Medium",
    riskColor: "text-amber-500",
    icon: Zap,
    emoji: "\u26A1",
    holdTime: "~8 hours",
    protections: [
      "Breakeven protection after initial move",
      "Session-aware stop management",
      "Weekend close to avoid gap risk",
      "News protection pauses trading",
    ],
  },
  steady_growth: {
    label: "Steady Growth",
    desc: "Balanced approach with breakeven protection and partial profits. Reliable and beginner-friendly.",
    risk: "Low",
    riskColor: "text-emerald-500",
    icon: ShieldCheck,
    emoji: "\uD83D\uDEE1\uFE0F",
    holdTime: "2\u20133 days",
    protections: [
      "Breakeven protection after first move",
      "Partial profit at halfway point",
      "Trailing stop locks in gains",
      "News protection pauses trading",
    ],
  },
  swing_capture: {
    label: "Swing Capture",
    desc: "Targets larger moves over days. Wider stops, graduated exits, more patience required.",
    risk: "Medium",
    riskColor: "text-amber-500",
    icon: TrendingUp,
    emoji: "\uD83C\uDF0A",
    holdTime: "1\u20132 weeks",
    protections: [
      "Wide stops for breathing room",
      "Graduated exit strategy",
      "Trailing stop adapts to volatility",
      "Session-aware management",
    ],
  },
  trend_rider: {
    label: "Trend Rider",
    desc: "Rides trends with no fixed target. Trailing stops adapt to volatility as the trend extends.",
    risk: "Medium",
    riskColor: "text-amber-500",
    icon: TrendingUp,
    emoji: "\uD83D\uDE80",
    holdTime: "Up to 30 days",
    protections: [
      "Dynamic trailing stop",
      "Volatility-adaptive thresholds",
      "Breakeven protection early on",
      "News and session awareness",
    ],
  },
  recovery: {
    label: "Recovery Mode",
    desc: "Adds to losing positions to lower average entry. HIGH RISK \u2014 losses can be much larger than initial position.",
    risk: "Advanced",
    riskColor: "text-red-500",
    icon: AlertTriangle,
    emoji: "\uD83D\uDD04",
    holdTime: "Varies",
    protections: [
      "Averaged entry levels",
      "Maximum 3 recovery levels",
      "Quick take-profit targets",
      "Position size limits",
    ],
  },
}

/** Ordered preset keys (excluding custom) for iteration. */
export const PRESET_KEYS = Object.keys(PRESET_INFO) as Exclude<SmartFlowPreset, "custom">[]
