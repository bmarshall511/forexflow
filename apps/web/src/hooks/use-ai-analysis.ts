"use client"

import { useState, useEffect, useCallback, useContext, useRef } from "react"
import {
  ANALYSIS_STALE_THRESHOLD_MS,
  type AiAnalysisData,
  type AiClaudeModel,
  type AiAnalysisDepth,
} from "@fxflow/types"
import { DaemonStatusContext } from "@/state/daemon-status-context"
import { toast } from "sonner"

const MAX_STREAM_TEXT_LENGTH = 100_000 // 100KB limit to prevent memory issues
const TRIGGER_COOLDOWN_MS = 2_000 // 2-second cooldown between triggers
const COMPLETION_TRANSITION_MS = 400 // Duration of completion transition animation

export interface AiAnalysisProgress {
  stage: string
  progress: number
  streamText: string
  streamTruncated: boolean
}

export interface UseAiAnalysisReturn {
  history: AiAnalysisData[]
  activeAnalysis: AiAnalysisData | null
  progress: AiAnalysisProgress | null
  isLoading: boolean
  isTransitioning: boolean
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
  const [isTransitioning, setIsTransitioning] = useState(false)
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
            setProgress(
              (prev) =>
                prev ?? {
                  stage: "Analyzing…",
                  progress: 30,
                  streamText: "",
                  streamTruncated: false,
                },
            )
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
      setProgress({
        stage: "Starting analysis…",
        progress: 5,
        streamText: "",
        streamTruncated: false,
      })
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
        streamTruncated: streamTextRef.current.length >= MAX_STREAM_TEXT_LENGTH,
      })
    }
  }, [daemon?.lastAiAnalysisUpdate, tradeId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle completion: use WS data immediately instead of waiting for DB roundtrip
  useEffect(() => {
    if (!daemon || !tradeId) return

    const msg = daemon.lastAiAnalysisCompleted
    if (msg?.tradeId !== tradeId) return

    // Build an AiAnalysisData from the WS message so UI can render immediately
    const immediateData: AiAnalysisData = {
      id: msg.analysisId,
      tradeId: msg.tradeId,
      status: msg.error ? "failed" : "completed",
      sections: msg.sections,
      costUsd: msg.costUsd,
      durationMs: msg.durationMs,
      inputTokens: msg.inputTokens,
      outputTokens: msg.outputTokens,
      errorMessage: msg.error ?? null,
      depth: activeAnalysis?.depth ?? "standard",
      model: activeAnalysis?.model ?? "claude-sonnet-4-6",
      tradeStatus: activeAnalysis?.tradeStatus ?? "open",
      triggeredBy: activeAnalysis?.triggeredBy ?? "user",
      createdAt: activeAnalysis?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Start transition: show "Analysis complete!" briefly before rendering results
    setIsTransitioning(true)
    setProgress({
      stage: msg.error ? "Analysis failed" : "Analysis complete!",
      progress: 100,
      streamText: "",
      streamTruncated: false,
    })

    const timer = setTimeout(() => {
      setHistory((prev) => [immediateData, ...prev.filter((a) => a.id !== msg.analysisId)])
      setActiveAnalysis(null)
      setProgress(null)
      setIsTransitioning(false)
      streamTextRef.current = ""
    }, COMPLETION_TRANSITION_MS)

    // Background refresh for DB consistency (has full metadata like contextSnapshot)
    refetch()

    return () => clearTimeout(timer)
  }, [daemon?.lastAiAnalysisCompleted, tradeId]) // eslint-disable-line react-hooks/exhaustive-deps

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
    try {
      const res = await fetch(`/api/ai/analyses/cancel/${analysisId}`, { method: "POST" })
      const json = (await res.json()) as { ok: boolean; error?: string }
      if (json.ok) {
        setActiveAnalysis(null)
        setProgress(null)
      } else {
        toast.error("Failed to cancel analysis — daemon may be unreachable")
      }
    } catch {
      toast.error("Failed to cancel analysis — network error")
    }
  }, [])

  return {
    history,
    activeAnalysis,
    progress,
    isLoading,
    isTransitioning,
    isTriggeringAnalysis,
    triggerAnalysis,
    cancelAnalysis,
    refetch,
  }
}
