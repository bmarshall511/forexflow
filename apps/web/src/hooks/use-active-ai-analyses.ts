"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useDaemonStatus } from "@/hooks/use-daemon-status"

export interface ActiveAnalysisProgress {
  progress: number
  stage: string
}

export function useActiveAiAnalyses(): Record<string, ActiveAnalysisProgress> {
  const { lastAiAnalysisStarted, lastAiAnalysisUpdate, lastAiAnalysisCompleted } = useDaemonStatus()
  const mapRef = useRef<Record<string, ActiveAnalysisProgress>>({})
  const [, forceUpdate] = useState(0)

  const update = useCallback(() => forceUpdate((n) => n + 1), [])

  // Analysis started → add entry
  useEffect(() => {
    if (!lastAiAnalysisStarted) return
    const { tradeId } = lastAiAnalysisStarted
    mapRef.current = { ...mapRef.current, [tradeId]: { progress: 0, stage: "Starting analysis..." } }
    update()
  }, [lastAiAnalysisStarted, update])

  // Progress update → update entry
  useEffect(() => {
    if (!lastAiAnalysisUpdate) return
    const { tradeId, progress, stage } = lastAiAnalysisUpdate
    const existing = mapRef.current[tradeId]
    if (!existing) return
    mapRef.current = {
      ...mapRef.current,
      [tradeId]: {
        progress: progress ?? existing.progress,
        stage: stage ?? existing.stage,
      },
    }
    update()
  }, [lastAiAnalysisUpdate, update])

  // Analysis completed → remove entry
  useEffect(() => {
    if (!lastAiAnalysisCompleted) return
    const { tradeId } = lastAiAnalysisCompleted
    if (mapRef.current[tradeId]) {
      const next = { ...mapRef.current }
      delete next[tradeId]
      mapRef.current = next
      update()
    }
  }, [lastAiAnalysisCompleted, update])

  return mapRef.current
}
