"use client"

import { useState, useEffect, useCallback, useContext, useRef } from "react"
import {
  ANALYSIS_STALE_THRESHOLD_MS,
  type AiAnalysisData,
  type AiClaudeModel,
  type AiAnalysisDepth,
} from "@fxflow/types"
import { DaemonStatusContext } from "@/state/daemon-status-context"

const MAX_STREAM_TEXT_LENGTH = 100_000 // 100KB limit to prevent memory issues
const TRIGGER_COOLDOWN_MS = 2_000 // 2-second cooldown between triggers

export interface AiAnalysisProgress {
  stage: string
  progress: number
  streamText: string
}

export interface UseAiAnalysisReturn {
  history: AiAnalysisData[]
  activeAnalysis: AiAnalysisData | null
  progress: AiAnalysisProgress | null
  isLoading: boolean
  isTriggeringAnalysis: boolean
  triggerAnalysis: (opts: {
    model: AiClaudeModel
    depth: AiAnalysisDepth
  }) => Promise<string | null>
  cancelAnalysis: (analysisId: string) => Promise<void>
  refetch: () => void
}

export function useAiAnalysis(tradeId: string | null): UseAiAnalysisReturn {
  const daemon = useContext(DaemonStatusContext)
  const [history, setHistory] = useState<AiAnalysisData[]>([])
  const [activeAnalysis, setActiveAnalysis] = useState<AiAnalysisData | null>(null)
  const [progress, setProgress] = useState<AiAnalysisProgress | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isTriggeringAnalysis, setIsTriggeringAnalysis] = useState(false)
  const [fetchKey, setFetchKey] = useState(0)
  const streamTextRef = useRef("")
  const lastTriggerRef = useRef(0)

  const refetch = useCallback(() => setFetchKey((k) => k + 1), [])

  // Fetch analysis history
  useEffect(() => {
    if (!tradeId) {
      setHistory([])
      setActiveAnalysis(null)
      setProgress(null)
      return
    }

    let cancelled = false
    setIsLoading(true)

    fetch(`/api/ai/analyses/${tradeId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((json: { ok: boolean; data?: AiAnalysisData[] }) => {
        if (cancelled || !json.ok || !json.data) return
        setHistory(json.data)

        // Detect any in-progress analysis — but only restore the progress spinner
        // if it was started recently. Old "running" records from crashed daemon
        // runs must not permanently block the Analyze button.
        const running = json.data.find((a) => a.status === "running" || a.status === "pending")
        if (running) {
          setActiveAnalysis(running)
          const ageMs = Date.now() - new Date(running.createdAt).getTime()
          if (ageMs < ANALYSIS_STALE_THRESHOLD_MS) {
            setProgress((prev) => prev ?? { stage: "Analyzing…", progress: 30, streamText: "" })
          }
        }
      })
      .catch(() => {
        if (!cancelled) setHistory([])
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [tradeId, fetchKey])

  // Listen to WS events for real-time updates
  useEffect(() => {
    if (!daemon || !tradeId) return

    const msg = daemon.lastAiAnalysisStarted
    if (msg?.tradeId === tradeId) {
      streamTextRef.current = ""
      setProgress({ stage: "Starting analysis…", progress: 5, streamText: "" })
    }
  }, [daemon?.lastAiAnalysisStarted, tradeId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!daemon || !tradeId) return

    const msg = daemon.lastAiAnalysisUpdate
    if (msg?.tradeId === tradeId) {
      if (msg.chunk) {
        // Cap stream text to prevent memory issues
        if (streamTextRef.current.length < MAX_STREAM_TEXT_LENGTH) {
          streamTextRef.current += msg.chunk
        }
      }
      setProgress({
        stage: msg.stage ?? "Analyzing…",
        progress: msg.progress ?? 50,
        streamText: streamTextRef.current,
      })
    }
  }, [daemon?.lastAiAnalysisUpdate, tradeId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!daemon || !tradeId) return

    const msg = daemon.lastAiAnalysisCompleted
    if (msg?.tradeId === tradeId) {
      setProgress(null)
      streamTextRef.current = ""
      setActiveAnalysis(null)
      // Refresh history to get the completed analysis
      refetch()
    }
  }, [daemon?.lastAiAnalysisCompleted, tradeId, refetch]) // eslint-disable-line react-hooks/exhaustive-deps

  const triggerAnalysis = useCallback(
    async (opts: { model: AiClaudeModel; depth: AiAnalysisDepth }): Promise<string | null> => {
      if (!tradeId) return null

      // Debounce: prevent double-clicks
      const now = Date.now()
      if (now - lastTriggerRef.current < TRIGGER_COOLDOWN_MS) {
        console.log("[use-ai-analysis] Trigger cooldown active, ignoring")
        return null
      }
      lastTriggerRef.current = now

      setIsTriggeringAnalysis(true)
      try {
        const res = await fetch(`/api/ai/analyses/${tradeId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(opts),
        })
        const json = (await res.json()) as {
          ok: boolean
          data?: { analysisId: string }
          error?: string
        }
        if (!json.ok) throw new Error(json.error ?? "Failed to trigger analysis")
        return json.data?.analysisId ?? null
      } catch (err) {
        console.error("[use-ai-analysis] triggerAnalysis error:", err)
        return null
      } finally {
        setIsTriggeringAnalysis(false)
      }
    },
    [tradeId],
  )

  const cancelAnalysis = useCallback(async (analysisId: string): Promise<void> => {
    await fetch(`/api/ai/analyses/cancel/${analysisId}`, { method: "POST" })
    setActiveAnalysis(null)
    setProgress(null)
  }, [])

  return {
    history,
    activeAnalysis,
    progress,
    isLoading,
    isTriggeringAnalysis,
    triggerAnalysis,
    cancelAnalysis,
    refetch,
  }
}
