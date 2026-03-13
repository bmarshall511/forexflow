"use client"

import { useState, useEffect, useRef } from "react"
import type { TVAlertSignal } from "@fxflow/types"
import type { SeriesMarker, Time } from "lightweight-charts"
import { useDaemonStatus } from "./use-daemon-status"
import { snapToCandle } from "@/components/charts/chart-markers"

/**
 * Provides Lightweight Charts markers for TV alert signals on a given instrument.
 * Fetches recent signals and listens for real-time updates.
 * @param timeframe - Chart timeframe (e.g. "H1") used to snap marker times to candle boundaries
 */
export function useChartSignals(instrument: string, enabled: boolean, timeframe: string = "H1") {
  const [markers, setMarkers] = useState<SeriesMarker<Time>[]>([])
  const { lastTVSignal } = useDaemonStatus()
  const lastSignalRef = useRef<TVAlertSignal | null>(null)

  useEffect(() => {
    if (!enabled || !instrument) {
      setMarkers([])
      return
    }

    const fetchSignals = async () => {
      try {
        const params = new URLSearchParams({
          instrument,
          status: "executed",
          pageSize: "50",
        })
        const res = await fetch(`/api/tv-alerts/signals?${params}`)
        const json = await res.json()
        if (json.ok) {
          setMarkers(signalsToMarkers(json.data.signals, timeframe))
        }
      } catch {
        // Silently fail — chart still works without markers
      }
    }

    void fetchSignals()
  }, [instrument, enabled, timeframe])

  // Add new markers from real-time signals
  useEffect(() => {
    if (!enabled || !lastTVSignal || lastTVSignal === lastSignalRef.current) return
    if (lastTVSignal.instrument !== instrument) return
    if (lastTVSignal.status !== "executed") return

    lastSignalRef.current = lastTVSignal
    setMarkers((prev) => {
      // Dedup: don't add if a marker with the same time+direction already exists
      const newMarker = signalToMarker(lastTVSignal, timeframe)
      if (prev.some((m) => m.time === newMarker.time && m.text === newMarker.text)) return prev
      return [...prev, newMarker]
    })
  }, [lastTVSignal, instrument, enabled, timeframe])

  return { markers }
}

function signalsToMarkers(signals: TVAlertSignal[], timeframe: string): SeriesMarker<Time>[] {
  return signals.map((s) => signalToMarker(s, timeframe)).filter(Boolean) as SeriesMarker<Time>[]
}

function signalToMarker(signal: TVAlertSignal, timeframe: string): SeriesMarker<Time> {
  // Use the TradingView candle close time when available, fall back to receivedAt.
  // Subtract 1 second because candle close time (e.g. 14:00:00) is simultaneously the
  // open of the next candle — the -1s ensures snapToCandle maps to the closing candle
  // (13:00:00) rather than the new one (14:00:00).
  const ts = signal.signalTime ?? signal.receivedAt
  const rawSeconds = Math.floor(new Date(ts).getTime() / 1000) - 1
  const time = snapToCandle(rawSeconds, timeframe)
  const isBuy = signal.direction === "buy"

  return {
    time,
    position: isBuy ? "belowBar" : "aboveBar",
    color: isBuy ? "#22c55e" : "#ef4444",
    shape: isBuy ? "arrowUp" : "arrowDown",
    text: isBuy ? "Buy" : "Sell",
  }
}
