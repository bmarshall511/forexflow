/**
 * Shared management rule primitives. Pure decision math with no side
 * effects — callers handle OANDA modifications, DB writes, broadcasts, and
 * activity log emission.
 *
 * Used by SmartFlow's `management-engine.ts` and EdgeFinder's
 * `trade-manager.ts` so the two daemons share one canonical implementation
 * of breakeven / trailing / time-exit / profit-pip math.
 *
 * @module trading-core/management
 */

export * from "./profit"
export * from "./breakeven"
export * from "./trailing"
export * from "./time-exit"
