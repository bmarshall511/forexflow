"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import type { TradeSource } from "@fxflow/types"

interface TradeInfo {
  id: string
  sourceTradeId: string
  source: TradeSource
}

/** Sources that have meaningful indicators */
const INDICATOR_SOURCES = new Set<TradeSource>([
  "trade_finder",
  "trade_finder_auto",
  "ai_trader",
  "ai_trader_manual",
  "smart_flow",
])

/**
 * Batch-fetches source-specific indicator values (score, confidence, phase)
 * for a list of trades. Only fetches for sources that have indicators.
 * Deduplicates and caches results — only re-fetches when trade IDs change.
 */
export function useSourceIndicators(trades: TradeInfo[]) {
  const [indicators, setIndicators] = useState<Record<string, string | null>>({})
  const prevKeyRef = useRef("")

  const fetch_ = useCallback(async (toFetch: TradeInfo[]) => {
    if (toFetch.length === 0) return
    try {
      const res = await fetch("/api/positions/source-indicators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trades: toFetch.map((t) => ({
            id: t.id,
            sourceTradeId: t.sourceTradeId,
            source: t.source,
          })),
        }),
      })
      const json = (await res.json()) as { ok: boolean; data: Record<string, string | null> }
      if (json.ok) {
        setIndicators((prev) => ({ ...prev, ...json.data }))
      }
    } catch {
      // Non-critical
    }
  }, [])

  useEffect(() => {
    // Only fetch for trades with indicator-eligible sources
    const eligible = trades.filter((t) => INDICATOR_SOURCES.has(t.source))
    // Build a stable key to detect changes
    const key = eligible
      .map((t) => t.id)
      .sort()
      .join(",")
    if (key === prevKeyRef.current || key === "") return
    prevKeyRef.current = key

    void fetch_(eligible)
  }, [trades, fetch_])

  return indicators
}
