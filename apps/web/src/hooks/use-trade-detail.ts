"use client"

import { useState, useEffect, useCallback } from "react"
import type { TradeDetailData } from "@fxflow/types"

export interface UseTradeDetailReturn {
  detail: TradeDetailData | null
  isLoading: boolean
  updateNotes: (notes: string) => Promise<void>
  updateTimeframe: (timeframe: string | null) => Promise<void>
  assignTag: (tagId: string) => Promise<void>
  removeTag: (tagId: string) => Promise<void>
  refetch: () => void
}

export function useTradeDetail(tradeId: string | null): UseTradeDetailReturn {
  const [detail, setDetail] = useState<TradeDetailData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [fetchKey, setFetchKey] = useState(0)

  const refetch = useCallback(() => setFetchKey((k) => k + 1), [])

  useEffect(() => {
    if (!tradeId) {
      setDetail(null)
      return
    }

    let cancelled = false
    setIsLoading(true)

    fetch(`/api/trades/${tradeId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((json) => {
        if (cancelled) return
        if (json.ok && json.data) {
          setDetail(json.data)
        }
      })
      .catch(() => {
        if (!cancelled) setDetail(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [tradeId, fetchKey])

  const updateNotes = useCallback(
    async (notes: string): Promise<void> => {
      if (!tradeId) return
      const res = await fetch(`/api/trades/${tradeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      })
      if (!res.ok) throw new Error(`Failed to save notes: ${res.status}`)
    },
    [tradeId],
  )

  const updateTimeframe = useCallback(
    async (timeframe: string | null): Promise<void> => {
      if (!tradeId) return
      const res = await fetch(`/api/trades/${tradeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeframe }),
      })
      if (!res.ok) throw new Error(`Failed to save timeframe: ${res.status}`)
      refetch()
    },
    [tradeId, refetch],
  )

  const assignTag = useCallback(
    async (tagId: string): Promise<void> => {
      if (!tradeId) return
      const res = await fetch(`/api/trades/${tradeId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId }),
      })
      if (!res.ok) throw new Error(`Failed to assign tag: ${res.status}`)
      refetch()
    },
    [tradeId, refetch],
  )

  const removeTag = useCallback(
    async (tagId: string): Promise<void> => {
      if (!tradeId) return
      const res = await fetch(`/api/trades/${tradeId}/tags`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId }),
      })
      if (!res.ok) throw new Error(`Failed to remove tag: ${res.status}`)
      refetch()
    },
    [tradeId, refetch],
  )

  return { detail, isLoading, updateNotes, updateTimeframe, assignTag, removeTag, refetch }
}
