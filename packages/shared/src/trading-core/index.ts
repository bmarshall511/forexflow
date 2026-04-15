/**
 * Shared trading-core primitives — used by every system that places or
 * manages trades (SmartFlow, EdgeFinder, Trade Finder, TV Alerts).
 *
 * Import from `@fxflow/shared/trading-core` OR via the top-level
 * `@fxflow/shared` barrel (also re-exports everything here).
 *
 * @module trading-core
 */

export * from "./types"
export * from "./correlation"
export * from "./circuit-breaker"
export * from "./spread"
export * from "./risk-sizing"
export * from "./rr-multiplier"
export * from "./news-gate"
export * from "./management"
