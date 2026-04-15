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

/**
 * If no progress update arrives within this window, the analysis is flagged
 * as `isStale` and a "Still working…" hint is shown in the UI. 60s is well
 * above normal Claude streaming intervals (chunks arrive continuously) so a
 * 60s gap reliably indicates a stalled stream or disconnected daemon.
 */
const STALE_WARNING_MS = 60_000

/**
 * Hard stop for a stuck spinner. 240s is above the daemon's own 180s stream
 * timeout + a 60s grace for the completion WS message to propagate. After
 * this, the spinner is cleared and the in-flight analysis is surfaced via
 * `interruptedAnalysis` so the user can Retry or Dismiss.
 */
const STALE_HARDCLEAR_MS = 240_000

/**
 * Poll interval for the mid-flight reconciliation query. While an analysis is
 * active, the hook polls `/api/ai/analyses/{tradeId}` to detect the case
 * where the daemon crashed mid-run and marked the row `failed`/`cancelled`
 * without sending a completion WS message.
 */
const RECONCILE_POLL_MS = 10_000

export interface AiAnalysisProgress {
  stage: string
  progress: number
  streamText: string
  streamTruncated: boolean
  /** True when no progress update has arrived in {@link STALE_WARNING_MS}. */
  isStale: boolean
}

export interface UseAiAnalysisReturn {
  history: AiAnalysisData[]
  activeAnalysis: AiAnalysisData | null
  progress: AiAnalysisProgress | null
  /**
   * Set when an active analysis was detected as interrupted (daemon crashed,
   * stream stalled past hard-clear, or row flipped to failed/cancelled in the
   * DB without a completion WS message). The UI shows a recovery card with
   * Retry/Dismiss actions.
   */
  interruptedAnalysis: AiAnalysisData | null
  dismissInterruption: () => void
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
  const [interruptedAnalysis, setInterruptedAnalysis] = useState<AiAnalysisData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [isTriggeringAnalysis, setIsTriggeringAnalysis] = useState(false)
  const [fetchKey, setFetchKey] = useState(0)
  const streamTextRef = useRef("")
  const lastTriggerRef = useRef(0)
  /**
   * Timestamp of the most recent progress signal (start event, stream chunk,
   * or poll-based reconciliation). Used by the watchdog effect to detect
   * stalled streams.
   */
  const lastProgressAtRef = useRef<number>(0)

  const refetch = useCallback(() => setFetchKey((k) => k + 1), [])
  const dismissInterruption = useCallback(() => setInterruptedAnalysis(null), [])

  // Fetch analysis history + reconcile active-analysis state against DB truth.
  // This runs on mount, on manual refetch, AND on every refetch kicked by the
  // reconciliation poll — so if the daemon crashed mid-run and flipped the row
  // to "failed"/"cancelled", we detect it here and clear the stuck spinner.
  useEffect(() => {
    if (!tradeId) {
      setHistory([])
      setActiveAnalysis(null)
      setProgress(null)
      setInterruptedAnalysis(null)
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

        // ─── Stuck-spinner reconciliation ──────────────────────────────────
        // If we currently believe an analysis is running but the DB now says
        // it's failed/cancelled, the daemon crashed or the cancel completed
        // without sending a completion WS message. Surface as interrupted.
        setActiveAnalysis((prevActive) => {
          if (prevActive) {
            const dbRow = json.data!.find((a) => a.id === prevActive.id)
            if (
              dbRow &&
              (dbRow.status === "failed" ||
                dbRow.status === "cancelled" ||
                dbRow.status === "completed" ||
                dbRow.status === "partial")
            ) {
              // Any terminal status means the analysis is no longer running.
              // Clear the spinner and only classify `failed` as interrupted
              // (completed/partial will be rendered via the history path).
              setProgress(null)
              streamTextRef.current = ""
              if (dbRow.status === "failed") {
                setInterruptedAnalysis(dbRow)
              }
              return null
            }
          }
          return prevActive
        })

        // Detect any in-progress analysis that the UI doesn't know about yet.
        // Only restore the progress spinner if it was started recently — stale
        // rows from prior daemon crashes should NOT permanently block Analyze.
        const running = json.data.find((a) => a.status === "running" || a.status === "pending")
        if (running) {
          const ageMs = Date.now() - new Date(running.createdAt).getTime()
          if (ageMs < ANALYSIS_STALE_THRESHOLD_MS) {
            setActiveAnalysis((prev) => prev ?? running)
            setProgress((prev) => {
              if (prev) return prev
              lastProgressAtRef.current = Date.now()
              return {
                stage: "Analyzing…",
                progress: 30,
                streamText: "",
                streamTruncated: false,
                isStale: false,
              }
            })
          } else {
            // Row exists, old, and no WS completion ever arrived → interrupted.
            setInterruptedAnalysis((prev) => prev ?? running)
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

  // Reconciliation poll: while an analysis is active, refetch history every
  // RECONCILE_POLL_MS so we catch daemon-side state flips (crash, cancel) that
  // never produced a completion WS message. Cheap — single DB query.
  useEffect(() => {
    if (!tradeId || !progress || !activeAnalysis) return
    const interval = setInterval(() => {
      setFetchKey((k) => k + 1)
    }, RECONCILE_POLL_MS)
    return () => clearInterval(interval)
  }, [tradeId, progress, activeAnalysis])

  // Watchdog: if no progress update has arrived in STALE_WARNING_MS, mark the
  // progress as stale so the UI shows a "still working…" hint. If it exceeds
  // STALE_HARDCLEAR_MS, auto-clear the spinner and surface the analysis as
  // interrupted so the user can Retry/Dismiss.
  useEffect(() => {
    if (!progress || !activeAnalysis) return
    const interval = setInterval(() => {
      const elapsed = Date.now() - lastProgressAtRef.current
      if (elapsed >= STALE_HARDCLEAR_MS) {
        setInterruptedAnalysis(activeAnalysis)
        setActiveAnalysis(null)
        setProgress(null)
        streamTextRef.current = ""
      } else if (elapsed >= STALE_WARNING_MS) {
        setProgress((prev) => (prev && !prev.isStale ? { ...prev, isStale: true } : prev))
      }
    }, 5_000)
    return () => clearInterval(interval)
  }, [progress, activeAnalysis])

  // Listen to WS events for real-time updates
  useEffect(() => {
    if (!daemon || !tradeId) return

    const msg = daemon.lastAiAnalysisStarted
    if (msg?.tradeId === tradeId) {
      streamTextRef.current = ""
      lastProgressAtRef.current = Date.now()
      setInterruptedAnalysis(null)
      setProgress({
        stage: "Starting analysis…",
        progress: 5,
        streamText: "",
        streamTruncated: false,
        isStale: false,
      })
    }
  }, [daemon?.lastAiAnalysisStarted, tradeId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!daemon || !tradeId) return

    const msg = daemon.lastAiAnalysisUpdate
    if (msg?.tradeId === tradeId) {
      lastProgressAtRef.current = Date.now()
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
        isStale: false,
      })
    }
  }, [daemon?.lastAiAnalysisUpdate, tradeId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle completion: use WS data immediately instead of waiting for DB roundtrip
  useEffect(() => {
    if (!daemon || !tradeId) return

    const msg = daemon.lastAiAnalysisCompleted
    if (msg?.tradeId !== tradeId) return

    // Build an AiAnalysisData from the WS message so UI can render immediately.
    // Three outcomes drive the status:
    //   - error set → "failed"
    //   - truncated=true → "partial" (sections may be incomplete, TruncationBanner shown)
    //   - otherwise → "completed"
    const wsStatus: AiAnalysisData["status"] = msg.error
      ? "failed"
      : msg.truncated
        ? "partial"
        : "completed"
    const immediateData: AiAnalysisData = {
      id: msg.analysisId,
      tradeId: msg.tradeId,
      status: wsStatus,
      sections: msg.sections,
      costUsd: msg.costUsd,
      durationMs: msg.durationMs,
      inputTokens: msg.inputTokens,
      outputTokens: msg.outputTokens,
      errorMessage: msg.error ?? null,
      truncated: msg.truncated ?? false,
      stopReason: msg.stopReason ?? null,
      depth: activeAnalysis?.depth ?? "standard",
      model: activeAnalysis?.model ?? "claude-sonnet-4-6",
      tradeStatus: activeAnalysis?.tradeStatus ?? "open",
      triggeredBy: activeAnalysis?.triggeredBy ?? "user",
      createdAt: activeAnalysis?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Start transition: show "Analysis complete!" briefly before rendering results
    setIsTransitioning(true)
    setInterruptedAnalysis(null)
    lastProgressAtRef.current = Date.now()
    setProgress({
      stage: msg.error
        ? "Analysis failed"
        : msg.truncated
          ? "Analysis complete (truncated)"
          : "Analysis complete!",
      progress: 100,
      streamText: "",
      streamTruncated: false,
      isStale: false,
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
      setInterruptedAnalysis(null)
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
        setInterruptedAnalysis(null)
        streamTextRef.current = ""
        // Refetch so the cancelled row shows up in history immediately.
        setFetchKey((k) => k + 1)
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
    interruptedAnalysis,
    dismissInterruption,
    isLoading,
    isTransitioning,
    isTriggeringAnalysis,
    triggerAnalysis,
    cancelAnalysis,
    refetch,
  }
}
