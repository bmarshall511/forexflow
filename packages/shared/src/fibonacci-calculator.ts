// Fibonacci retracement & extension calculator — pure TypeScript, no runtime-specific imports.

/** A detected swing high or low used as an anchor for Fibonacci calculations. */
export interface SwingPoint {
  type: "high" | "low"
  price: number
  time: number
  index: number
}

/** A single Fibonacci level with its ratio, computed price, and display label. */
export interface FibonacciLevel {
  ratio: number
  price: number
  label: string
}

/** Complete Fibonacci analysis result including retracement levels, OTE zone, and extensions. */
export interface FibonacciResult {
  swingHigh: number
  swingLow: number
  direction: "up" | "down"
  /** Retracement levels from 0% to 100%. */
  levels: FibonacciLevel[]
  /** Optimal Trade Entry zone between 61.8% and 78.6% retracement. */
  oteZone: { high: number; low: number }
  /** Extension levels beyond the swing range (100%+). */
  extensions: FibonacciLevel[]
}

/** Standard Fibonacci retracement ratios (0% to 100%). */
export const FIBONACCI_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0] as const

/** Standard Fibonacci extension ratios used for profit targets beyond the swing range. */
export const FIBONACCI_EXTENSIONS = [1.0, 1.272, 1.618, 2.0, 2.618] as const

const LABELS: Record<number, string> = {
  0: "0%",
  0.236: "23.6%",
  0.382: "38.2%",
  0.5: "50%",
  0.618: "61.8%",
  0.786: "78.6%",
  1.0: "100%",
  1.272: "127.2%",
  1.618: "161.8%",
  2.0: "200%",
  2.618: "261.8%",
}

function label(r: number): string {
  return LABELS[r] ?? `${(r * 100).toFixed(1)}%`
}
function retrace(base: number, range: number, ratio: number, up: boolean): number {
  return up ? base - range * ratio : base + range * ratio
}

/**
 * Compute Fibonacci retracement and extension levels between a swing high and low.
 * Retracement levels identify potential support/resistance within the swing range.
 * Extensions project potential targets beyond the swing range.
 *
 * @param swingHigh - The swing high price.
 * @param swingLow - The swing low price.
 * @param direction - "up" retraces from the high downward; "down" retraces from the low upward.
 * @returns Retracement levels, extension levels, and the OTE zone.
 */
export function computeFibonacciRetracement(
  swingHigh: number,
  swingLow: number,
  direction: "up" | "down",
): FibonacciResult {
  const range = swingHigh - swingLow
  const up = direction === "up"
  const base = up ? swingHigh : swingLow

  const levels = FIBONACCI_LEVELS.map((r) => ({
    ratio: r,
    price: retrace(base, range, r, up),
    label: label(r),
  }))
  const extensions = FIBONACCI_EXTENSIONS.map((r) => ({
    ratio: r,
    label: label(r),
    price: up ? swingLow + range * r : swingHigh - range * r,
  }))

  const ote618 = retrace(base, range, 0.618, up)
  const ote786 = retrace(base, range, 0.786, up)
  const oteZone = { high: Math.max(ote618, ote786), low: Math.min(ote618, ote786) }

  return { swingHigh, swingLow, direction, levels, oteZone, extensions }
}

/**
 * Check whether a price falls within the Optimal Trade Entry (OTE) zone (61.8%–78.6% retracement).
 * The OTE zone is considered the highest-probability area for trend continuation entries.
 *
 * @param price - The price to test.
 * @param fib - A previously computed Fibonacci result.
 * @returns True if the price is within the OTE zone.
 */
export function isInOTEZone(price: number, fib: FibonacciResult): boolean {
  return price >= fib.oteZone.low && price <= fib.oteZone.high
}

/**
 * Automatically compute Fibonacci levels from the most recent swing high and low.
 * Direction is inferred from which swing occurred most recently.
 *
 * @param swings - Array of detected swing points (must contain at least one high and one low).
 * @returns Fibonacci result, or null if fewer than 2 swings or no high/low pair found.
 */
export function findFibonacciFromSwings(swings: SwingPoint[]): FibonacciResult | null {
  if (swings.length < 2) return null

  // Find the most recent significant high and low
  let lastHigh: SwingPoint | null = null
  let lastLow: SwingPoint | null = null

  for (let i = swings.length - 1; i >= 0; i--) {
    const s = swings[i]!
    if (s.type === "high" && !lastHigh) lastHigh = s
    if (s.type === "low" && !lastLow) lastLow = s
    if (lastHigh && lastLow) break
  }

  if (!lastHigh || !lastLow) return null

  // Direction based on which swing came last (most recent)
  const direction = lastHigh.index > lastLow.index ? "down" : "up"

  return computeFibonacciRetracement(lastHigh.price, lastLow.price, direction)
}
