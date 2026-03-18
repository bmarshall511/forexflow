import { useState, useEffect, useCallback, useRef } from "react"
import type { ReplayCandle, ReplayTradeInfo } from "@/app/api/trades/[tradeId]/replay-candles/route"

export type ReplaySpeed = 1 | 2 | 5 | 10
export type ReplayTimeframe = "M1" | "M5" | "M15" | "M30" | "H1" | "H4"

const SPEED_INTERVALS: Record<ReplaySpeed, number> = {
  1: 500,
  2: 250,
  5: 100,
  10: 50,
}

export interface ReplayControls {
  play: () => void
  pause: () => void
  stepForward: () => void
  stepBack: () => void
  setSpeed: (speed: ReplaySpeed) => void
  seekTo: (index: number) => void
  reset: () => void
  setTimeframe: (tf: ReplayTimeframe) => void
}

export function useTradeReplay(tradeId: string | null) {
  const [candles, setCandles] = useState<ReplayCandle[]>([])
  const [tradeInfo, setTradeInfo] = useState<ReplayTradeInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeedState] = useState<ReplaySpeed>(1)
  const [timeframe, setTimeframeState] = useState<ReplayTimeframe | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const candleCountRef = useRef(0)

  // Fetch replay data — re-runs when tradeId or timeframe changes
  useEffect(() => {
    if (!tradeId) {
      setCandles([])
      setTradeInfo(null)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)
    setIsPlaying(false)
    setCurrentIndex(0)

    const tfParam = timeframe ? `?timeframe=${timeframe}` : ""
    fetch(`/api/trades/${tradeId}/replay-candles${tfParam}`)
      .then((res) => res.json())
      .then(
        (json: {
          ok: boolean
          candles?: ReplayCandle[]
          trade?: ReplayTradeInfo
          error?: string
        }) => {
          if (cancelled) return
          if (!json.ok || !json.candles || !json.trade) {
            setError(json.error ?? "Failed to load replay data")
            return
          }
          setCandles(json.candles)
          setTradeInfo(json.trade)
          // Sync timeframe state to what the server returned (covers the initial load)
          if (!timeframe) setTimeframeState(json.trade.timeframe as ReplayTimeframe)
          candleCountRef.current = json.candles.length
          // Start at entry candle so pre-entry candles are visible as market context
          const entryTime = Math.floor(new Date(json.trade.openedAt).getTime() / 1000)
          const entryIdx = json.candles.findIndex((c) => c.time >= entryTime)
          setCurrentIndex(entryIdx >= 0 ? entryIdx : 0)
        },
      )
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [tradeId, timeframe])

  // Auto-advance when playing
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (!isPlaying || candles.length === 0) return

    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= candleCountRef.current - 1) {
          setIsPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, SPEED_INTERVALS[speed])

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isPlaying, speed, candles.length])

  const controls: ReplayControls = {
    play: useCallback(() => {
      if (currentIndex >= candles.length - 1) setCurrentIndex(0)
      setIsPlaying(true)
    }, [currentIndex, candles.length]),
    pause: useCallback(() => setIsPlaying(false), []),
    stepForward: useCallback(() => {
      setIsPlaying(false)
      setCurrentIndex((prev) => Math.min(prev + 1, candleCountRef.current - 1))
    }, []),
    stepBack: useCallback(() => {
      setIsPlaying(false)
      setCurrentIndex((prev) => Math.max(prev - 1, 0))
    }, []),
    setSpeed: useCallback((s: ReplaySpeed) => setSpeedState(s), []),
    seekTo: useCallback((index: number) => {
      setCurrentIndex(Math.max(0, Math.min(index, candleCountRef.current - 1)))
    }, []),
    reset: useCallback(() => {
      setIsPlaying(false)
      setCurrentIndex(0)
    }, []),
    setTimeframe: useCallback((tf: ReplayTimeframe) => {
      setTimeframeState(tf)
    }, []),
  }

  return {
    candles,
    tradeInfo,
    isLoading,
    error,
    currentIndex,
    isPlaying,
    speed,
    timeframe,
    controls,
  }
}
