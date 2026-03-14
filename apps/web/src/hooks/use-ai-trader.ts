"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type {
  AiTraderScanStatus,
  AiTraderScanProgressData,
  AiTraderScanLogEntry,
  AiTraderOpportunityData,
} from "@fxflow/types"
import { useDaemonStatus } from "./use-daemon-status"

export interface UseAiTraderReturn {
  status: AiTraderScanStatus | null
  progress: AiTraderScanProgressData | null
  scanLog: AiTraderScanLogEntry[]
  opportunities: AiTraderOpportunityData[]
  isLoading: boolean
  triggerScan: () => Promise<void>
  pauseScanner: () => Promise<void>
  resumeScanner: () => Promise<void>
  handleAction: (id: string, action: "approve" | "reject") => Promise<void>
  refetch: () => void
}

export function useAiTrader(): UseAiTraderReturn {
  const [status, setStatus] = useState<AiTraderScanStatus | null>(null)
  const [progress, setProgress] = useState<AiTraderScanProgressData | null>(null)
  const [scanLog, setScanLog] = useState<AiTraderScanLogEntry[]>([])
  const [opportunities, setOpportunities] = useState<AiTraderOpportunityData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const hasFetchedOnce = useRef(false)

  const {
    lastAiTraderScanStatus,
    lastAiTraderScanProgress,
    lastAiTraderScanLogEntry,
    lastAiTraderOpportunity,
  } = useDaemonStatus()

  // ─── Initial data fetch ─────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!hasFetchedOnce.current) setIsLoading(true)
    try {
      const [statusRes, oppsRes, logRes] = await Promise.all([
        fetch("/api/ai-trader/status"),
        fetch("/api/ai-trader/opportunities"),
        fetch("/api/ai-trader/scan-log"),
      ])

      if (statusRes.ok) {
        const json = (await statusRes.json()) as { ok: boolean; data?: AiTraderScanStatus }
        if (json.ok && json.data) setStatus(json.data)
      }
      if (oppsRes.ok) {
        const json = (await oppsRes.json()) as { ok: boolean; data?: AiTraderOpportunityData[] }
        if (json.ok && json.data) setOpportunities(json.data)
      }
      if (logRes.ok) {
        const json = (await logRes.json()) as { ok: boolean; data?: AiTraderScanLogEntry[] }
        if (json.ok && json.data) setScanLog(json.data)
      }
    } catch {
      // Daemon may be offline
    } finally {
      setIsLoading(false)
      hasFetchedOnce.current = true
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  // ─── WS real-time updates ──────────────────────────────────────

  useEffect(() => {
    if (lastAiTraderScanStatus) setStatus(lastAiTraderScanStatus)
  }, [lastAiTraderScanStatus])

  useEffect(() => {
    if (lastAiTraderScanProgress) setProgress(lastAiTraderScanProgress)
  }, [lastAiTraderScanProgress])

  useEffect(() => {
    if (!lastAiTraderScanLogEntry) return
    setScanLog((prev) => {
      const updated = [...prev, lastAiTraderScanLogEntry]
      if (updated.length > 100) return updated.slice(-100)
      return updated
    })
  }, [lastAiTraderScanLogEntry])

  useEffect(() => {
    if (!lastAiTraderOpportunity) return
    setOpportunities((prev) => {
      const idx = prev.findIndex((o) => o.id === lastAiTraderOpportunity.id)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = lastAiTraderOpportunity
        return updated
      }
      return [lastAiTraderOpportunity, ...prev]
    })
  }, [lastAiTraderOpportunity])

  // ─── Actions ────────────────────────────────────────────────────

  const triggerScan = useCallback(async () => {
    await fetch("/api/ai-trader/scan", { method: "POST" })
  }, [])

  const pauseScanner = useCallback(async () => {
    await fetch("/api/ai-trader/pause", { method: "POST" })
  }, [])

  const resumeScanner = useCallback(async () => {
    await fetch("/api/ai-trader/resume", { method: "POST" })
  }, [])

  const handleAction = useCallback(
    async (id: string, action: "approve" | "reject") => {
      const res = await fetch(`/api/ai-trader/opportunities/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error(`Failed to ${action}`)
      void fetchData()
    },
    [fetchData],
  )

  const refetch = useCallback(() => {
    void fetchData()
  }, [fetchData])

  return {
    status,
    progress,
    scanLog,
    opportunities,
    isLoading,
    triggerScan,
    pauseScanner,
    resumeScanner,
    handleAction,
    refetch,
  }
}
