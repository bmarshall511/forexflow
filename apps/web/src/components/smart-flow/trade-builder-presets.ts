import { Zap, ShieldCheck, TrendingUp, Rocket, RotateCcw } from "lucide-react"
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
    holdTime: string
    bullets: string[]
    protections: string[]
    howItWorks: string[]
  }
> = {
  momentum_catch: {
    label: "Momentum Catch",
    desc: "Quick trades that capture short-term moves. Best for active traders who check in often.",
    risk: "Medium",
    riskColor: "text-amber-500",
    icon: Zap,
    holdTime: "~8 hours",
    bullets: [
      "Set a safety exit below your entry",
      "Move safety to break-even quickly",
      "Close if nothing happens in ~8 hours",
      "Protect during news events",
    ],
    protections: [
      "Breakeven protection after initial move",
      "Session-aware stop management",
      "Weekend close to avoid gap risk",
      "News protection pauses trading",
    ],
    howItWorks: [
      "SmartFlow places a trade and sets a stop-loss based on the pair's current volatility (how much it moves).",
      "The profit target is about 1.6x the distance of your stop-loss — so you always aim to win more than you risk.",
      "Once the trade moves in your favor, your stop-loss automatically moves to your entry price (breakeven), so you can't lose money on it.",
      "If it's Friday afternoon, the trade closes automatically to protect you from weekend price gaps.",
      "If a major news event is coming, SmartFlow pauses to avoid wild price swings.",
    ],
  },
  steady_growth: {
    label: "Steady Growth",
    desc: "Balanced approach with breakeven protection and partial profits. Reliable and beginner-friendly — the best choice for most people.",
    risk: "Low",
    riskColor: "text-emerald-500",
    icon: ShieldCheck,
    holdTime: "2-3 days",
    bullets: [
      "Set a safety exit at a comfortable distance",
      "Move to break-even when profitable",
      "Take half your profit partway through",
      "Trail your safety exit to lock in gains",
      "Close after 3 days if needed",
    ],
    protections: [
      "Breakeven protection after first move",
      "Partial profit at halfway point",
      "Trailing stop locks in gains",
      "News protection pauses trading",
    ],
    howItWorks: [
      "SmartFlow places a trade with a stop-loss and take-profit calculated from the pair's volatility. The target is 2x the risk.",
      "Once the trade moves enough in your favor, the stop-loss moves to your entry price — you're now risk-free.",
      "When the trade reaches halfway to the target, SmartFlow automatically takes 50% of the profit. This locks in gains even if the price reverses.",
      "A trailing stop follows the price as it moves in your favor, locking in more profit the further it goes.",
      "The trade adapts to different market sessions — during quieter hours, stops are widened to avoid false stops from random price noise.",
    ],
  },
  swing_capture: {
    label: "Swing Capture",
    desc: "Targets larger moves over several days. Wider stops give the trade room to breathe, with graduated exits along the way.",
    risk: "Medium",
    riskColor: "text-amber-500",
    icon: TrendingUp,
    holdTime: "1-2 weeks",
    bullets: [
      "Give the trade room to breathe",
      "Move to break-even at 1× ATR profit",
      "Take partial profits at two levels",
      "Trail your safety exit for big moves",
    ],
    protections: [
      "Wide stops for breathing room",
      "Graduated exit strategy (33% at two levels)",
      "Trailing stop adapts to volatility",
      "Session-aware management",
    ],
    howItWorks: [
      "This strategy gives trades more room to move by using wider stop-losses. This means fewer trades get stopped out by normal price fluctuations.",
      "The profit target is 3x the risk — so even if you lose on some trades, the winners more than make up for it.",
      "Profits are taken gradually: 33% at the first target, another 33% at the second, and the final third rides with a trailing stop.",
      "The trailing stop adjusts based on how volatile the market is — wider during choppy conditions, tighter when the trend is smooth.",
      "Trades can run for 1-2 weeks, so patience is key. SmartFlow handles everything automatically during this time.",
    ],
  },
  trend_rider: {
    label: "Trend Rider",
    desc: "Rides big market trends with no fixed profit target. Uses smart trailing stops that adapt to volatility — lets winners run as far as they can.",
    risk: "Medium",
    riskColor: "text-amber-500",
    icon: Rocket,
    holdTime: "Up to 30 days",
    bullets: [
      "Follow the trend with no fixed target",
      "Move to break-even after 1× ATR profit",
      "Take small profits at 3 levels",
      "Trail closely to ride the trend",
      "Hold up to 30 days",
    ],
    protections: [
      "Dynamic trailing stop follows the trend",
      "Volatility-adaptive thresholds",
      "Breakeven protection early on",
      "Partial profits at regular intervals",
    ],
    howItWorks: [
      "Unlike other strategies, Trend Rider has NO fixed profit target. Instead, it lets winning trades run as long as the trend continues.",
      "A trailing stop follows the price at a distance based on volatility. If the price reverses, the stop catches it and closes the trade in profit.",
      "Every time the trade moves 2x the volatility in your favor, SmartFlow takes 25% profit. This means you're collecting profits along the way.",
      "Early on, the stop-loss moves to breakeven to protect your initial investment.",
      "This strategy works best when there's a strong, clear trend in the market. It can run for weeks, capturing large moves.",
    ],
  },
  recovery: {
    label: "Recovery Mode",
    desc: "Adds to losing positions to lower your average entry price. HIGH RISK — your maximum possible loss is much larger than your initial trade.",
    risk: "Advanced",
    riskColor: "text-red-500",
    icon: RotateCcw,
    holdTime: "Varies",
    bullets: [
      "⚠️ Adds to losing positions",
      "Up to 3 levels of averaging down",
      "Small profit targets to exit quickly",
      "Higher risk — can multiply losses",
    ],
    protections: [
      "Averaged entry levels (max 3 additions)",
      "Quick take-profit from averaged position",
      "Position size limits per level",
      "Hard stop on maximum total exposure",
    ],
    howItWorks: [
      "WARNING: This strategy is for experienced traders only. It deliberately adds more money to a losing trade.",
      "If your trade goes against you, SmartFlow adds a smaller position at regular intervals. This lowers your average entry price.",
      "Because your average entry is now closer to the current price, a smaller bounce back can put you in profit.",
      "The risk: if the price keeps going against you through all 3 levels, your total loss is much bigger than a normal trade. Your maximum risk is roughly 3x a normal trade.",
      "SmartFlow limits recovery to 3 additional levels and has a hard stop to prevent unlimited losses. But the potential loss is still significant.",
    ],
  },
}

/** Ordered preset keys (excluding custom) for iteration. */
export const PRESET_KEYS = Object.keys(PRESET_INFO) as Exclude<SmartFlowPreset, "custom">[]
