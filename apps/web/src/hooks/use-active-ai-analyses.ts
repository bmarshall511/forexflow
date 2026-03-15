"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useDaemonStatus } from "@/hooks/use-daemon-status"

export interface ActiveAnalysisProgress {
  progress: number
  stage: string
}

/**
 * Tracks in-progress AI analyses via WebSocket events, with an initial fetch
 * on mount and on daemon reconnect to stay in sync with the DB.
 */
export function useActiveAiAnalyses(): Record<string, ActiveAnalysisProgress> {
  const {
    isConnected,
    isReachable,
    lastAiAnalysisStarted,
    lastAiAnalysisUpdate,
    lastAiAnalysisCompleted,
  } = useDaemonStatus()
  const mapRef = useRef<Record<string, ActiveAnalysisProgress>>({})
  const [, forceUpdate] = useState(0)
  const hasFetchedRef = useRef(false)

  const update = useCallback(() => forceUpdate((n) => n + 1), [])

  // Reconcile with DB on mount and whenever daemon (re)connects
  useEffect(() => {
    const connected = isConnected || isReachable
    if (!connected) {
      hasFetchedRef.current = false
      return
    }
    if (hasFetchedRef.current) return
    hasFetchedRef.current = true

    let cancelled = false
    async function reconcile() {
      try {
        const res = await fetch("/api/ai/analyses/list?status=running&pageSize=50", {
          cache: "no-store",
        })
        if (!res.ok || cancelled) return
        const json = await res.json()
        const rows: Array<{ tradeId: string }> = json.data?.rows ?? []
        const fresh: Record<string, ActiveAnalysisProgress> = {}
        for (const row of rows) {
          fresh[row.tradeId] = {
            progress: 0,
            stage: "Running...",
          }
        }
        if (!cancelled) {
          mapRef.current = fresh
          update()
        }
      } catch {
        // Non-critical — WS events will catch up
      }
    }
    void reconcile()
    return () => {
      cancelled = true
    }
  }, [isConnected, isReachable, update])

  // Analysis started → add entry
  useEffect(() => {
    if (!lastAiAnalysisStarted) return
    const { tradeId } = lastAiAnalysisStarted
    mapRef.current = {
      ...mapRef.current,
      [tradeId]: { progress: 0, stage: "Starting analysis..." },
    }
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
