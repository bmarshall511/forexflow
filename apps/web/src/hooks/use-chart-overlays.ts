"use client"

import { useEffect, useRef, type MutableRefObject } from "react"
import type { ZoneData, CurveData, TrendData, TrendVisualSettings } from "@fxflow/types"
import type { ZonePrimitive } from "@/components/charts/zone-primitive"
import type { CurvePrimitive } from "@/components/charts/curve-primitive"
import type { TrendPrimitive } from "@/components/charts/trend-primitive"
import type { TradeLevelPrimitive, TradeLevel } from "@/components/charts/trade-level-primitive"

interface UseChartOverlaysOptions {
  /** Ref to the zone rendering primitive */
  zonePrimRef: MutableRefObject<ZonePrimitive | null>
  /** Ref to the curve rendering primitive */
  curvePrimRef: MutableRefObject<CurvePrimitive | null>
  /** Ref to the trend rendering primitive */
  trendPrimRef: MutableRefObject<TrendPrimitive | null>
  /** Ref to the trade-level rendering primitive */
  tradeLevelPrimRef: MutableRefObject<TradeLevelPrimitive | null>

  /** Incremented every time the chart is recreated — forces overlay re-application */
  chartGeneration: number

  /** Primary supply/demand zones */
  zones?: ZoneData[]
  /** Higher-timeframe zones rendered behind primary */
  higherTfZones?: ZoneData[]
  /** Current mid-price for zone nearest-highlight */
  zoneCurrentPrice?: number | null

  /** HTF curve overlay data */
  curveData?: CurveData | null

  /** MTF trend overlay data */
  trendData?: TrendData | null
  /** Higher-timeframe trend data */
  higherTfTrendData?: TrendData | null
  /** Trend visual settings */
  trendVisuals?: TrendVisualSettings

  /** Trade entry/exit levels drawn as lines on candles */
  tradeLevels?: TradeLevel[]

  /** Theme and formatting */
  isDark: boolean
  decimals: number
}

/**
 * Shared hook that syncs overlay data (zones, curve, trend, trade levels) into
 * chart primitives. Both TradingViewChart and DraggableTradeChart use this to
 * avoid duplicating overlay sync logic.
 *
 * The `chartGeneration` dependency ensures overlays are reapplied after the chart
 * is recreated (e.g., on timeframe change), even if the overlay data itself hasn't
 * changed.
 */
export function useChartOverlays({
  zonePrimRef,
  curvePrimRef,
  trendPrimRef,
  tradeLevelPrimRef,
  chartGeneration,
  zones,
  higherTfZones,
  zoneCurrentPrice,
  curveData,
  trendData,
  higherTfTrendData,
  trendVisuals,
  tradeLevels,
  isDark,
  decimals,
}: UseChartOverlaysOptions): void {
  // ─── Trade level indicators ──────────────────────────────────────────────
  useEffect(() => {
    tradeLevelPrimRef.current?.setLevels(tradeLevels ?? [])
  }, [tradeLevels, chartGeneration, tradeLevelPrimRef])

  // ─── Zone overlay ────────────────────────────────────────────────────────
  const lastZonePriceRef = useRef<number | null>(null)
  useEffect(() => {
    if (!zonePrimRef.current) return
    const price = zoneCurrentPrice ?? lastZonePriceRef.current
    if (zones && zones.length > 0 && price != null) {
      lastZonePriceRef.current = price
      zonePrimRef.current.setZones(zones, price, isDark, decimals)
    } else if (!zones || zones.length === 0) {
      zonePrimRef.current.clearAll()
    }
  }, [zones, zoneCurrentPrice, isDark, decimals, chartGeneration, zonePrimRef])

  useEffect(() => {
    if (!zonePrimRef.current) return
    zonePrimRef.current.setHigherTfZones(higherTfZones ?? [])
  }, [higherTfZones, chartGeneration, zonePrimRef])

  // ─── Curve overlay ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!curvePrimRef.current) return
    if (curveData) {
      curvePrimRef.current.setCurve(curveData, isDark)
    } else {
      curvePrimRef.current.clearCurve()
    }
  }, [curveData, isDark, chartGeneration, curvePrimRef])

  // ─── Trend overlay ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!trendPrimRef.current) return
    if (trendData && trendVisuals) {
      trendPrimRef.current.setTrend(trendData, trendVisuals, isDark)
    } else if (trendVisuals) {
      // No primary trend data — clear primary but preserve visuals for HTF rendering.
      // setTrend(null, visuals, isDark) clears primary data while keeping visuals intact
      // so that higherTfTrendData renders with the correct settings (e.g., showBoxes).
      trendPrimRef.current.setTrend(null, trendVisuals, isDark)
    } else {
      trendPrimRef.current.clearTrend()
    }
  }, [trendData, trendVisuals, isDark, chartGeneration, trendPrimRef])

  useEffect(() => {
    if (!trendPrimRef.current) return
    trendPrimRef.current.setHigherTfTrend(higherTfTrendData ?? null)
  }, [higherTfTrendData, chartGeneration, trendPrimRef])
}
