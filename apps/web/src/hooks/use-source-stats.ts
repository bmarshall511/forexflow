"use client"

import { useState, useEffect, useCallback } from "react"
import type { SourceDetailedPerformance } from "@fxflow/types"

export interface UseSourceStatsReturn {
  sources: SourceDetailedPerformance[]
  isLoading: boolean
  refetch: () => void
}

export function useSourceStats(): UseSourceStatsReturn {
  const [sources, setSources] = useState<SourceDetailedPerformance[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch("/api/analytics/source-breakdown")
      if (!res.ok) return
      const json = (await res.json()) as { data: SourceDetailedPerformance[] }
      setSources(json.data)
    } catch {
      /* ignore */
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetch_()
    // Refresh every 60 seconds to keep stats current
    const interval = setInterval(() => void fetch_(), 60_000)
    return () => clearInterval(interval)
  }, [fetch_])

  return { sources, isLoading, refetch: fetch_ }
}
