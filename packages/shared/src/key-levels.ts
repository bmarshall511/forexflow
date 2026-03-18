// Key price level detection — pure TypeScript, no runtime-specific imports.

import { getPipSize } from "./pip-utils"

/** A detected key price level with its type and distance from a reference price. */
export interface KeyLevel {
  price: number
  type: "round_number" | "prev_day_high" | "prev_day_low" | "prev_week_high" | "prev_week_low"
  distancePips: number
}

/** Candle shape expected by key level detection (OHLC). */
interface KeyLevelCandle {
  open: number
  high: number
  low: number
  close: number
}

/**
 * Find key price levels near a reference price.
 *
 * Key levels checked:
 * - Round numbers (x.x000 and x.x500 for non-JPY; x.x00 and x.x50 for JPY)
 * - Previous daily candle high/low
 * - Previous weekly candle high/low
 *
 * @param price - Reference price to check proximity against.
 * @param instrument - OANDA instrument name (e.g., "EUR_USD").
 * @param prevDailyCandle - The previous completed daily candle (null if unavailable).
 * @param prevWeeklyCandle - The previous completed weekly candle (null if unavailable).
 * @param proximityPips - Max distance in pips to consider "near" (default 15).
 * @returns Array of nearby key levels, sorted by distance ascending.
 */
export function findNearbyKeyLevels(
  price: number,
  instrument: string,
  prevDailyCandle: KeyLevelCandle | null,
  prevWeeklyCandle: KeyLevelCandle | null,
  proximityPips = 15,
): KeyLevel[] {
  const pipSize = getPipSize(instrument)
  const proximityPrice = proximityPips * pipSize
  const levels: KeyLevel[] = []

  // Round numbers: find nearest x.x000 and x.x500 (or x.x00 / x.x50 for JPY)
  const roundStep = pipSize >= 0.01 ? 0.5 : 0.005 // JPY pairs vs standard
  const base = Math.floor(price / roundStep) * roundStep
  for (const candidate of [base, base + roundStep]) {
    const dist = Math.abs(price - candidate)
    if (dist <= proximityPrice) {
      levels.push({
        price: candidate,
        type: "round_number",
        distancePips: dist / pipSize,
      })
    }
  }

  // Previous daily high/low
  if (prevDailyCandle) {
    const dHigh = prevDailyCandle.high
    const dLow = prevDailyCandle.low
    if (Math.abs(price - dHigh) <= proximityPrice) {
      levels.push({
        price: dHigh,
        type: "prev_day_high",
        distancePips: Math.abs(price - dHigh) / pipSize,
      })
    }
    if (Math.abs(price - dLow) <= proximityPrice) {
      levels.push({
        price: dLow,
        type: "prev_day_low",
        distancePips: Math.abs(price - dLow) / pipSize,
      })
    }
  }

  // Previous weekly high/low
  if (prevWeeklyCandle) {
    const wHigh = prevWeeklyCandle.high
    const wLow = prevWeeklyCandle.low
    if (Math.abs(price - wHigh) <= proximityPrice) {
      levels.push({
        price: wHigh,
        type: "prev_week_high",
        distancePips: Math.abs(price - wHigh) / pipSize,
      })
    }
    if (Math.abs(price - wLow) <= proximityPrice) {
      levels.push({
        price: wLow,
        type: "prev_week_low",
        distancePips: Math.abs(price - wLow) / pipSize,
      })
    }
  }

  return levels.sort((a, b) => a.distancePips - b.distancePips)
}

/**
 * Score key level confluence for a Trade Finder setup.
 *
 * - +1 if entry is near a round number (within proximityPips)
 * - +1 if entry is near a previous day/week high or low
 * - Max 2 points
 */
export function scoreKeyLevels(
  entryPrice: number,
  instrument: string,
  prevDailyCandle: KeyLevelCandle | null,
  prevWeeklyCandle: KeyLevelCandle | null,
  proximityPips = 15,
): { value: number; max: number; label: string; explanation: string } {
  const levels = findNearbyKeyLevels(
    entryPrice,
    instrument,
    prevDailyCandle,
    prevWeeklyCandle,
    proximityPips,
  )

  let roundNumberPoint = 0
  let structuralPoint = 0
  const reasons: string[] = []

  for (const level of levels) {
    if (level.type === "round_number" && roundNumberPoint === 0) {
      roundNumberPoint = 1
      reasons.push(
        `Near round number ${level.price.toFixed(getPipSize(instrument) >= 0.01 ? 2 : 4)}`,
      )
    }
    if (level.type !== "round_number" && structuralPoint === 0) {
      structuralPoint = 1
      const label =
        level.type === "prev_day_high"
          ? "prev day high"
          : level.type === "prev_day_low"
            ? "prev day low"
            : level.type === "prev_week_high"
              ? "prev week high"
              : "prev week low"
      reasons.push(`Near ${label}`)
    }
  }

  const value = roundNumberPoint + structuralPoint
  const labels: Record<number, string> = { 0: "Poor", 1: "Good", 2: "Best" }

  return {
    value,
    max: 2,
    label: labels[value] ?? "Poor",
    explanation: reasons.length > 0 ? reasons.join(" + ") : "No key levels nearby",
  }
}
