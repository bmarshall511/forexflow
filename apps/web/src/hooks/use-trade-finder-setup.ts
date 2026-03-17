"use client"

import { useState, useEffect, useRef } from "react"
import type { TradeFinderSetupData, TradeSource } from "@fxflow/types"

const TF_SOURCES: TradeSource[] = ["trade_finder", "trade_finder_auto"]

/**
 * Fetches the original Trade Finder setup for a trade, if it was placed by Trade Finder.
 * Only fires a request when `source` is a Trade Finder source.
 *
 * @param oandaSourceId - The OANDA order ID (pending) or trade ID (open/closed)
 * @param source - The enriched trade source
 */
export function useTradeFinderSetup(oandaSourceId: string | null, source: TradeSource | undefined) {
  const [setup, setSetup] = useState<TradeFinderSetupData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cancelRef = useRef(0)

  const isTradeFinderTrade = source != null && TF_SOURCES.includes(source)

  useEffect(() => {
    if (!isTradeFinderTrade || !oandaSourceId) {
      setSetup(null)
      setIsLoading(false)
      setError(null)
      return
    }

    const token = ++cancelRef.current
    setIsLoading(true)
    setError(null)

    fetch(`/api/trade-finder/setup-by-trade/${encodeURIComponent(oandaSourceId)}`)
      .then(async (res) => {
        if (token !== cancelRef.current) return
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        if (token !== cancelRef.current) return
        if (json.ok) {
          setSetup(json.data ?? null)
        } else {
          setError(json.error ?? "Failed to load setup")
        }
      })
      .catch((err) => {
        if (token !== cancelRef.current) return
        setError(err instanceof Error ? err.message : "Unknown error")
      })
      .finally(() => {
        if (token === cancelRef.current) setIsLoading(false)
      })
  }, [oandaSourceId, isTradeFinderTrade])

  return { setup, isLoading, error, isTradeFinderTrade }
}
