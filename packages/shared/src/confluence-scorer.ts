// Confluence scoring system — pure TypeScript, no runtime-specific imports.

/** Input signals for the confluence scoring system. Null values are excluded from the score calculation. */
export interface ConfluenceInput {
  /** SMC (Smart Money Concepts) structural bias (0-100). Above 50 = bullish bias. */
  smcBias: number | null
  /** Whether a Fair Value Gap is present near current price. */
  fvgPresent: boolean
  /** Whether an Order Block is present near current price. */
  orderBlockPresent: boolean
  /** Whether price is in the Fibonacci Optimal Trade Entry zone (61.8%-78.6%). */
  inOTEZone: boolean
  /** Whether price is at an active supply/demand zone. */
  supplyDemandZone: boolean
  /** Whether the trend direction aligns with the trade direction. */
  trendAligned: boolean
  /** Whether EMA crossover/alignment confirms the trade direction. */
  emaAligned: boolean
  /** Current RSI value. For longs, < 30 is favorable (oversold); for shorts, > 70 (overbought). */
  rsiSignal: number | null
  /** Current MACD histogram value. Must exceed minimum magnitude threshold. */
  macdSignal: number | null
  /** Whether a price/indicator divergence supports the trade direction. */
  divergencePresent: boolean
  /** Current Williams %R value. For longs, < -80 is favorable; for shorts, > -20. */
  williamsRSignal: number | null
  /** Current ADX value. > 25 indicates a strong trend. */
  adxValue: number | null
  /** Market regime favorability score (0-100). */
  regimeScore: number | null
  /** Session suitability score (0-100). */
  sessionScore: number | null
}

/** Result of the confluence scoring calculation. */
export interface ConfluenceResult {
  /** Overall confluence score (0-100) representing the percentage of weighted signals that confirm. */
  score: number
  /** Number of signals that confirmed the trade direction. */
  signals: number
  /** Total number of signals that were evaluable (non-null inputs). */
  totalSignals: number
  /** Per-signal breakdown showing presence, weight, and weighted contribution. */
  breakdown: Record<string, { present: boolean; weight: number; contribution: number }>
}

type Eval = (input: ConfluenceInput, dir: "long" | "short") => boolean | null
const def = (key: string, weight: number, evaluate: Eval) => ({ key, weight, evaluate })

const SIGNALS = [
  def("smc_structure", 15, (i) => (i.smcBias === null ? null : i.smcBias > 50)),
  def("fvg", 10, (i) => i.fvgPresent),
  def("order_block", 12, (i) => i.orderBlockPresent),
  def("fibonacci_ote", 12, (i) => i.inOTEZone),
  def("supply_demand", 10, (i) => i.supplyDemandZone),
  def("trend", 10, (i) => i.trendAligned),
  def("ema_alignment", 8, (i) => i.emaAligned),
  def("rsi", 6, (i, d) =>
    i.rsiSignal === null ? null : d === "long" ? i.rsiSignal < 30 : i.rsiSignal > 70,
  ),
  def("macd", 5, (i, d) => {
    if (i.macdSignal === null) return null
    const MIN_MAGNITUDE = 0.00005
    if (Math.abs(i.macdSignal) < MIN_MAGNITUDE) return false
    return d === "long" ? i.macdSignal > 0 : i.macdSignal < 0
  }),
  def("divergence", 8, (i) => i.divergencePresent),
  def("williams_r", 4, (i, d) => {
    if (i.williamsRSignal === null) return null
    return d === "long" ? i.williamsRSignal < -80 : i.williamsRSignal > -20
  }),
  def("adx_trend", 6, (i) => (i.adxValue === null ? null : i.adxValue > 25)),
]

function addBonus(
  value: number | null,
  key: string,
  weight: number,
  breakdown: ConfluenceResult["breakdown"],
): { w: number; e: number } {
  if (value === null) return { w: 0, e: 0 }
  const contrib = (value / 100) * weight
  breakdown[key] = { present: value > 50, weight, contribution: contrib }
  return { w: weight, e: contrib }
}

/**
 * Compute a weighted confluence score from multiple technical analysis signals.
 * Each signal has a weight reflecting its relative importance. Null inputs are excluded.
 * Regime and session scores are treated as bonus contributors rather than binary signals.
 *
 * @param input - The set of technical signals to evaluate.
 * @param direction - The intended trade direction ("long" or "short").
 * @returns Score (0-100), signal counts, and per-signal breakdown.
 */
export function computeConfluenceScore(
  input: ConfluenceInput,
  direction: "long" | "short",
): ConfluenceResult {
  const breakdown: ConfluenceResult["breakdown"] = {}
  let totalWeight = 0,
    earnedWeight = 0,
    signals = 0,
    totalSignals = 0

  for (const s of SIGNALS) {
    const result = s.evaluate(input, direction)
    if (result === null) {
      breakdown[s.key] = { present: false, weight: s.weight, contribution: 0 }
      continue
    }
    totalSignals++
    totalWeight += s.weight
    const contribution = result ? s.weight : 0
    if (result) {
      earnedWeight += s.weight
      signals++
    }
    breakdown[s.key] = { present: result, weight: s.weight, contribution }
  }

  const regime = addBonus(input.regimeScore, "regime", 5, breakdown)
  const session = addBonus(input.sessionScore, "session", 5, breakdown)
  const maxPossible = totalWeight + regime.w + session.w
  const score =
    maxPossible > 0 ? Math.round(((earnedWeight + regime.e + session.e) / maxPossible) * 100) : 0

  return { score, signals, totalSignals, breakdown }
}
