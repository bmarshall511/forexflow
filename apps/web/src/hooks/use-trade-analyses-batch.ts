"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import type { AiAnalysisData } from "@fxflow/types"
import { useDaemonStatus } from "@/hooks/use-daemon-status"

export interface UseTradeAnalysesBatchReturn {
  latestByTradeId: Record<string, AiAnalysisData>
  countByTradeId: Record<string, number>
  isLoading: boolean
  refetch: () => void
}

export function useTradeAnalysesBatch(tradeIds: string[]): UseTradeAnalysesBatchReturn {
  const { lastAiAnalysisStarted, lastAiAnalysisCompleted } = useDaemonStatus()
  const [latestByTradeId, setLatestByTradeId] = useState<Record<string, AiAnalysisData>>({})
  const [countByTradeId, setCountByTradeId] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [fetchKey, setFetchKey] = useState(0)

  // Stable sorted key — useMemo ensures this string only changes when trade IDs actually change,
  // so the effect below won't re-fire on every WS price tick or parent re-render.
  const sortedKey = useMemo(() => [...tradeIds].sort().join(","), [tradeIds])

  const refetch = useCallback(() => setFetchKey((k) => k + 1), [])

  // Refresh when an analysis starts or completes (so cell shows running/completed state)
  useEffect(() => {
    if (lastAiAnalysisStarted) refetch()
  }, [lastAiAnalysisStarted, refetch])

  useEffect(() => {
    if (lastAiAnalysisCompleted) refetch()
  }, [lastAiAnalysisCompleted, refetch])

  useEffect(() => {
    if (!sortedKey) {
      setLatestByTradeId({})
      setCountByTradeId({})
      return
    }

    let cancelled = false
    setIsLoading(true)

    fetch(`/api/ai/analyses/latest-by-trades?ids=${sortedKey}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((json: { ok: boolean; data?: { latest: Record<string, AiAnalysisData>; counts: Record<string, number> } }) => {
        if (cancelled) return
        if (json.ok && json.data) {
          setLatestByTradeId(json.data.latest)
          setCountByTradeId(json.data.counts)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLatestByTradeId({})
          setCountByTradeId({})
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [sortedKey, fetchKey])

  return { latestByTradeId, countByTradeId, isLoading, refetch }
}
