"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { ZoneCandle, TrendData, TrendDisplaySettings } from "@fxflow/types"
import { detectTrend, getHigherTimeframe, getDefaultSwingStrength } from "@fxflow/shared"
import { fetchCandles } from "@/components/charts/chart-utils"

interface UseTrendsOptions {
  instrument: string
  timeframe: string
  enabled: boolean
  /** Current mid-price (optional — falls back to last candle close) */
  currentPrice: number | null
  /** Merged display settings */
  settings: TrendDisplaySettings
  /** Chart's loaded candle count — trends re-fetch when this grows */
  chartCandleCount?: number
}

interface UseTrendsReturn {
  /** Primary timeframe trend data */
  trendData: TrendData | null
  /** Higher-TF trend data (if enabled) */
  higherTfTrendData: TrendData | null
  /** Whether computation is in progress */
  isComputing: boolean
  /** Last computation ISO timestamp */
  lastComputedAt: string | null
  /** Force recompute */
  recompute: () => void
  /** Error if computation failed */
  error: string | null
}

/**
 * Orchestrates trend detection for a single chart panel.
 * Self-fetches candles with lookbackCandles count (chart candles may be too few).
 * Mirrors the useZones pattern.
 */
export function useTrends({
  instrument,
  timeframe,
  enabled,
  currentPrice,
  settings,
  chartCandleCount = 0,
}: UseTrendsOptions): UseTrendsReturn {
  const [trendData, setTrendData] = useState<TrendData | null>(null)
  const [higherTfTrendData, setHigherTfTrendData] = useState<TrendData | null>(null)
  const [isComputing, setIsComputing] = useState(false)
  const [lastComputedAt, setLastComputedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selfFetchedCandles, setSelfFetchedCandles] = useState<ZoneCandle[] | null>(null)

  const computeIdRef = useRef(0)
  const lastComputedAtRef = useRef<string | null>(null)
  const prevCandleCountRef = useRef(0)
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const lastFetchCountRef = useRef(0)

  const candles = selfFetchedCandles
  const candlesRef = useRef(candles)
  candlesRef.current = candles

  // Derive effective price
  const effectivePrice =
    currentPrice ?? (candles && candles.length > 0 ? candles[candles.length - 1]!.close : null)
  const effectivePriceRef = useRef(effectivePrice)
  effectivePriceRef.current = effectivePrice

  // Fetch candles for trend detection
  useEffect(() => {
    if (!enabled) {
      setSelfFetchedCandles(null)
      lastFetchCountRef.current = 0
      return
    }

    const targetCount = Math.max(chartCandleCount, settingsRef.current.config.lookbackCandles)
    if (lastFetchCountRef.current >= targetCount * 0.9 && lastFetchCountRef.current > 0) return

    let cancelled = false
    fetchCandles(instrument, timeframe, targetCount).then((data) => {
      if (!cancelled && data && data.length > 0) {
        setSelfFetchedCandles(data as ZoneCandle[])
        lastFetchCountRef.current = data.length
      }
    })
    return () => {
      cancelled = true
    }
  }, [enabled, instrument, timeframe, chartCandleCount])

  // Stable compute function
  const compute = useCallback(async () => {
    const s = settingsRef.current
    const c = candlesRef.current
    const price = effectivePriceRef.current
    if (!c || c.length === 0 || price == null) return

    const computeId = ++computeIdRef.current
    setIsComputing(true)
    setError(null)

    try {
      // Build config with adaptive swing strength
      const config = {
        ...s.config,
        swingStrength: s.config.swingStrength || getDefaultSwingStrength(timeframe),
      }

      // Primary detection
      const result = detectTrend(c, instrument, timeframe, config, price)
      if (computeId !== computeIdRef.current) return

      setTrendData(result)

      // Persist in background
      persistTrend(instrument, timeframe)

      // Higher-TF trend
      if (s.showHigherTf) {
        const htf = s.higherTimeframe ?? getHigherTimeframe(timeframe)
        if (htf) {
          try {
            const htfCandles = await fetchCandles(
              instrument,
              htf,
              Math.min(s.config.lookbackCandles, 300),
            )
            if (computeId !== computeIdRef.current) return
            if (htfCandles && htfCandles.length > 0) {
              const htfPrice = price
              const htfConfig = { ...config, swingStrength: getDefaultSwingStrength(htf) }
              const htfResult = detectTrend(
                htfCandles as ZoneCandle[],
                instrument,
                htf,
                htfConfig,
                htfPrice,
              )
              setHigherTfTrendData(htfResult)
              persistTrend(instrument, htf)
            }
          } catch {
            // HTF fetch failed — not critical
          }
        }
      } else {
        setHigherTfTrendData(null)
      }

      const ts = new Date().toISOString()
      setLastComputedAt(ts)
      lastComputedAtRef.current = ts
    } catch (err) {
      if (computeId === computeIdRef.current) {
        setError(err instanceof Error ? err.message : "Trend detection failed")
      }
    } finally {
      if (computeId === computeIdRef.current) {
        setIsComputing(false)
      }
    }
  }, [instrument, timeframe])

  // Auto-compute when candle data becomes available
  useEffect(() => {
    if (!enabled) {
      setTrendData(null)
      setHigherTfTrendData(null)
      prevCandleCountRef.current = 0
      return
    }

    const candleCount = candles?.length ?? 0
    const countChanged = candleCount !== prevCandleCountRef.current
    prevCandleCountRef.current = candleCount

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
      prev.config.swingStrength !== settings.config.swingStrength ||
      prev.config.minSegmentAtr !== settings.config.minSegmentAtr ||
      prev.config.maxSwingPoints !== settings.config.maxSwingPoints ||
      prev.showHigherTf !== settings.showHigherTf ||
      prev.higherTimeframe !== settings.higherTimeframe
    ) {
      compute()
    }
  }, [enabled, settings, compute, candles?.length])

  return {
    trendData,
    higherTfTrendData,
    isComputing,
    lastComputedAt,
    recompute: compute,
    error,
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Fire-and-forget trend persistence to the API. */
function persistTrend(instrument: string, timeframe: string): void {
  fetch(`/api/trends/${instrument}?timeframe=${timeframe}`).catch(() => {})
}
