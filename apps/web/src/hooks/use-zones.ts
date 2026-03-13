"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { ZoneCandle, ZoneData, ZoneDisplaySettings, ZoneDetectionResult, CurveAlignment, CurveData, CurvePosition } from "@fxflow/types"
import { detectZones, getHigherTimeframe } from "@fxflow/shared"
import { fetchCandles } from "@/components/charts/chart-utils"

interface UseZonesOptions {
  instrument: string
  timeframe: string
  enabled: boolean
  /** Current mid-price (optional — falls back to last candle close) */
  currentPrice: number | null
  /** Merged display settings */
  settings: ZoneDisplaySettings
  /** Chart's loaded candle count — zones re-fetch when this grows (zoom/scroll) */
  chartCandleCount?: number
}

interface UseZonesReturn {
  /** Filtered, ranked zones for the primary timeframe */
  zones: ZoneData[]
  /** Higher-TF zones (if enabled) */
  higherTfZones: ZoneData[]
  /** Nearest demand below price */
  nearestDemand: ZoneData | null
  /** Nearest supply above price */
  nearestSupply: ZoneData | null
  /** Curve alignment status */
  curveAlignment: CurveAlignment
  /** Whether computation is in progress */
  isComputing: boolean
  /** Last computation ISO timestamp */
  lastComputedAt: string | null
  /** Force recompute */
  recompute: () => void
  /** Computed curve data (if enabled) */
  curveData: CurveData | null
  /** Error if computation failed */
  error: string | null
}

/**
 * Orchestrates zone detection for a single chart panel.
 * Always self-fetches candles with lookbackCandles count (chart candles are too few).
 * Falls back to last candle close when currentPrice is not yet available.
 */
export function useZones({
  instrument,
  timeframe,
  enabled,
  currentPrice,
  settings,
  chartCandleCount = 0,
}: UseZonesOptions): UseZonesReturn {
  const [zones, setZones] = useState<ZoneData[]>([])
  const [higherTfZones, setHigherTfZones] = useState<ZoneData[]>([])
  const [nearestDemand, setNearestDemand] = useState<ZoneData | null>(null)
  const [nearestSupply, setNearestSupply] = useState<ZoneData | null>(null)
  const [curveAlignment, setCurveAlignment] = useState<CurveAlignment>("neutral")
  const [isComputing, setIsComputing] = useState(false)
  const [lastComputedAt, setLastComputedAt] = useState<string | null>(null)
  const [curveData, setCurveData] = useState<CurveData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selfFetchedCandles, setSelfFetchedCandles] = useState<ZoneCandle[] | null>(null)

  const computeIdRef = useRef(0)
  const lastComputedAtRef = useRef<string | null>(null)
  const prevCandleCountRef = useRef<number>(0)
  // Stable refs to avoid re-creating compute callback on every tick/settings change
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  // Fetch candles for zone detection, using the chart's loaded candle count.
  // When the user scrolls/zooms and more candles load, we re-fetch to match.
  const candles = selfFetchedCandles
  const candlesRef = useRef(candles)
  candlesRef.current = candles
  const lastFetchCountRef = useRef(0)

  useEffect(() => {
    if (!enabled) {
      setSelfFetchedCandles(null)
      lastFetchCountRef.current = 0
      return
    }

    // Use the larger of chart candle count or settings lookback,
    // but only re-fetch when the chart has meaningfully more candles than last fetch
    const targetCount = Math.max(chartCandleCount, settingsRef.current.lookbackCandles)
    // Skip if we already fetched at least this many (with 10% tolerance)
    if (lastFetchCountRef.current >= targetCount * 0.9 && lastFetchCountRef.current > 0) return

    let cancelled = false
    fetchCandles(instrument, timeframe, targetCount).then((data) => {
      if (!cancelled && data && data.length > 0) {
        setSelfFetchedCandles(data as ZoneCandle[])
        lastFetchCountRef.current = data.length
      }
    })
    return () => { cancelled = true }
  }, [enabled, instrument, timeframe, chartCandleCount])

  // Derive effective price: prefer live price, fall back to last candle close
  const effectivePrice = currentPrice ?? (candles && candles.length > 0 ? candles[candles.length - 1]!.close : null)
  const effectivePriceRef = useRef(effectivePrice)
  effectivePriceRef.current = effectivePrice

  // Stable compute — reads candles + price from refs so it doesn't change identity on every tick
  const compute = useCallback(async () => {
    const s = settingsRef.current
    const c = candlesRef.current
    const price = effectivePriceRef.current
    if (!c || c.length === 0 || price == null) return

    const computeId = ++computeIdRef.current
    setIsComputing(true)
    setError(null)

    try {
      // Primary detection
      const effectiveTf = s.timeframeOverride ?? timeframe
      const result = detectZones(c, instrument, effectiveTf, s.algorithmConfig, price)

      if (computeId !== computeIdRef.current) return // Stale computation

      // Filter by settings
      let filtered = result.zones.filter((z) => z.scores.total >= s.minScore)
      if (!s.showInvalidated) {
        filtered = filtered.filter((z) => z.status !== "invalidated" && z.testCount === 0)
      }

      // Limit per type
      const demand = filtered.filter((z) => z.type === "demand").slice(0, s.maxZonesPerType)
      const supply = filtered.filter((z) => z.type === "supply").slice(0, s.maxZonesPerType)

      setZones([...demand, ...supply])
      setNearestDemand(demand[0] ?? null)
      setNearestSupply(supply[0] ?? null)

      // Persist to DB in the background (non-blocking)
      persistZones(instrument, effectiveTf, result.zones)

      // Higher-TF zones
      if (s.showHigherTf) {
        const htf = s.higherTimeframe ?? getHigherTimeframe(effectiveTf)
        if (htf) {
          try {
            const htfCandles = await fetchCandles(instrument, htf, Math.min(s.lookbackCandles, 200))
            if (computeId !== computeIdRef.current) return
            if (htfCandles && htfCandles.length > 0) {
              const htfPrice = htfCandles[htfCandles.length - 1]!.close
              const htfResult = detectZones(htfCandles, instrument, htf, s.algorithmConfig, htfPrice)
              let htfFiltered = htfResult.zones.filter((z) => z.scores.total >= s.minScore)
              if (!s.showInvalidated) htfFiltered = htfFiltered.filter((z) => z.status !== "invalidated")
              setHigherTfZones(htfFiltered.slice(0, s.maxZonesPerType * 2))

              // Compute curve alignment
              const alignment = computeAlignment(result, htfResult, price)
              setCurveAlignment(alignment)

              persistZones(instrument, htf, htfResult.zones)
            }
          } catch {
            // Higher-TF fetch failed — not critical
          }
        }
      } else {
        setHigherTfZones([])
        setCurveAlignment("neutral")
      }

      // ─── Curve computation ───────────────────────────────────────────
      if (s.curve.enabled) {
        const curveTf = s.curve.timeframe
        const htf = s.higherTimeframe ?? getHigherTimeframe(effectiveTf)

        // Determine which zones to use for curve
        let curveZones: ZoneData[] | null = null
        let curveTimeframe: string | null = null

        if (!curveTf || curveTf === htf) {
          // Reuse HTF zones if already computed, otherwise fetch
          if (s.showHigherTf && htf) {
            // HTF zones were already computed above — grab from the full htfResult
            // We need the unfiltered zones, so re-detect or use the result we have
            // Actually, the htfResult is scoped inside the showHigherTf block.
            // We'll re-fetch if needed below.
            curveZones = null // Signal to fetch
            curveTimeframe = htf
          } else if (htf) {
            curveTimeframe = htf
          }
        } else {
          curveTimeframe = curveTf
        }

        if (curveTimeframe) {
          try {
            // Fetch and detect for the curve timeframe
            const curveCandles = await fetchCandles(instrument, curveTimeframe, Math.min(s.lookbackCandles, 300))
            if (computeId !== computeIdRef.current) return
            if (curveCandles && curveCandles.length > 0) {
              const curvePrice = price
              const curveResult = detectZones(curveCandles, instrument, curveTimeframe, s.algorithmConfig, curvePrice)
              const computed = buildCurveData(curveResult.zones, curvePrice, curveTimeframe, s.curve.opacity, s.curve.showAxisLabel)
              setCurveData(computed)
            } else {
              setCurveData(null)
            }
          } catch {
            setCurveData(null)
          }
        } else {
          setCurveData(null)
        }
      } else {
        setCurveData(null)
      }

      const ts = new Date().toISOString()
      setLastComputedAt(ts)
      lastComputedAtRef.current = ts
    } catch (err) {
      if (computeId === computeIdRef.current) {
        setError(err instanceof Error ? err.message : "Zone detection failed")
      }
    } finally {
      if (computeId === computeIdRef.current) {
        setIsComputing(false)
      }
    }
  }, [instrument, timeframe])

  // Auto-compute when candle data becomes available or candle count changes
  useEffect(() => {
    if (!enabled) {
      setZones([])
      setHigherTfZones([])
      setNearestDemand(null)
      setNearestSupply(null)
      setCurveAlignment("neutral")
      setCurveData(null)
      prevCandleCountRef.current = 0
      return
    }

    const candleCount = candles?.length ?? 0
    const countChanged = candleCount !== prevCandleCountRef.current
    prevCandleCountRef.current = candleCount

    // Compute on first load or when candle count changes (new candle close)
    if (candleCount > 0 && (countChanged || lastComputedAtRef.current === null)) {
      compute()
    }
  }, [enabled, candles?.length, compute])

  // Recompute when meaningful settings change
  const prevSettingsRef = useRef(settings)
  useEffect(() => {
    if (!enabled || !candles?.length) return
    const prev = prevSettingsRef.current
    prevSettingsRef.current = settings

    if (
      prev.minScore !== settings.minScore ||
      prev.maxZonesPerType !== settings.maxZonesPerType ||
      prev.showInvalidated !== settings.showInvalidated ||
      prev.showHigherTf !== settings.showHigherTf ||
      prev.higherTimeframe !== settings.higherTimeframe ||
      prev.timeframeOverride !== settings.timeframeOverride ||
      prev.algorithmConfig.preset !== settings.algorithmConfig.preset ||
      prev.curve.enabled !== settings.curve.enabled ||
      prev.curve.timeframe !== settings.curve.timeframe
    ) {
      compute()
    }
  }, [enabled, settings, compute, candles?.length])

  return {
    zones,
    higherTfZones,
    nearestDemand,
    nearestSupply,
    curveAlignment,
    isComputing,
    lastComputedAt,
    curveData,
    recompute: compute,
    error,
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Fire-and-forget zone persistence to the API. */
function persistZones(instrument: string, timeframe: string, zones: ZoneData[]): void {
  fetch(`/api/zones/${instrument}?timeframe=${timeframe}&lookback=1&minScore=0`)
    .catch(() => {})
}

/** Build CurveData from best supply + demand zones */
function buildCurveData(
  zones: ZoneData[],
  currentPrice: number,
  timeframe: string,
  opacity: number,
  showAxisLabel: boolean,
): CurveData | null {
  // Find best supply and demand by total score (include invalidated — macro range persists)
  const bestSupply = zones
    .filter((z) => z.type === "supply")
    .sort((a, b) => b.scores.total - a.scores.total)[0]
  const bestDemand = zones
    .filter((z) => z.type === "demand")
    .sort((a, b) => b.scores.total - a.scores.total)[0]

  if (!bestSupply || !bestDemand) return null

  const top = bestSupply.distalLine
  const bottom = bestDemand.distalLine

  // Crossed/invalid — supply distal must be above demand distal
  if (top <= bottom) return null

  const range = top - bottom
  const third = range / 3
  const highThreshold = top - third
  const lowThreshold = bottom + third

  let position: CurvePosition
  if (currentPrice > top) position = "above"
  else if (currentPrice < bottom) position = "below"
  else if (currentPrice >= highThreshold) position = "high"
  else if (currentPrice <= lowThreshold) position = "low"
  else position = "middle"

  return {
    supplyDistal: top,
    demandDistal: bottom,
    highThreshold,
    lowThreshold,
    position,
    supplyZone: bestSupply,
    demandZone: bestDemand,
    timeframe,
    opacity,
    showAxisLabel,
  }
}

function computeAlignment(
  primary: ZoneDetectionResult,
  higher: ZoneDetectionResult,
  currentPrice: number,
): CurveAlignment {
  const htfDemand = higher.zones.find((z) => z.type === "demand" && z.status === "active")
  const htfSupply = higher.zones.find((z) => z.type === "supply" && z.status === "active")

  if (!htfDemand && !htfSupply) return "neutral"

  const priceNearHtfDemand = htfDemand && currentPrice - htfDemand.proximalLine < htfDemand.width * 3
  const priceNearHtfSupply = htfSupply && htfSupply.proximalLine - currentPrice < htfSupply.width * 3

  const hasPrimaryDemand = primary.nearestDemand !== null
  const hasPrimarySupply = primary.nearestSupply !== null

  if (priceNearHtfDemand && hasPrimaryDemand) return "aligned"
  if (priceNearHtfSupply && hasPrimarySupply) return "aligned"
  if (priceNearHtfDemand && hasPrimarySupply && !hasPrimaryDemand) return "conflicting"
  if (priceNearHtfSupply && hasPrimaryDemand && !hasPrimarySupply) return "conflicting"

  return "neutral"
}
