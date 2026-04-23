/**
 * Shared types for the Phase 1+ dashboard primitives.
 *
 * Kept alongside the primitives rather than in `@fxflow/types` because these
 * are UI-shape-only — they describe how a component wants to be told what
 * to render, not a DB/DTO contract.
 */

/** Tone hint for a tile/number — drives colour without encoding meaning in colour alone. */
export type DashboardTone = "positive" | "negative" | "neutral" | "warning"

/** Simple point tuple for sparkline/spark-bar consumers. */
export interface SparkPoint {
  /** X axis value — date ms, index, whatever is meaningful to the data set. */
  x: number
  /** Y value — normalized by the component; absolute magnitude is fine. */
  y: number
}
