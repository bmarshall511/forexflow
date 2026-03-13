"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import type { TradeTagData } from "@fxflow/types"

export interface UseTradeTagsBatchReturn {
  tagsByTradeId: Record<string, TradeTagData[]>
  isLoading: boolean
  refetch: () => void
}

export function useTradeTagsBatch(tradeIds: string[]): UseTradeTagsBatchReturn {
  const [tagsByTradeId, setTagsByTradeId] = useState<Record<string, TradeTagData[]>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [fetchKey, setFetchKey] = useState(0)

  // Stable sorted key to avoid refetching on every WebSocket tick
  const sortedKey = useMemo(() => [...tradeIds].sort().join(","), [tradeIds])
  const prevKeyRef = useRef("")

  const refetch = useCallback(() => setFetchKey((k) => k + 1), [])

  useEffect(() => {
    // Skip if IDs haven't changed and we're not forcing a refetch
    if (sortedKey === prevKeyRef.current && fetchKey === 0) return
    prevKeyRef.current = sortedKey

    if (!sortedKey) {
      // Positions briefly reset (e.g. reconnect) — preserve existing tag data so
      // the table doesn't flash "—". A fresh fetch will run when IDs come back.
      return
    }

    let cancelled = false
    setIsLoading(true)

    fetch(`/api/trades/tags?ids=${sortedKey}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((json) => {
        if (cancelled) return
        if (json.ok && json.data) {
          setTagsByTradeId(json.data)
        }
      })
      .catch(() => {
        // Don't clear — keep previous tags so the UI doesn't flicker on transient errors
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [sortedKey, fetchKey])

  return { tagsByTradeId, isLoading, refetch }
}
