"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Sparkles, Loader2, ChevronDown, ChevronUp } from "lucide-react"

interface ReplayAiCommentaryProps {
  tradeId: string
}

interface AiAnalysis {
  id: string
  summary: string
  status: string
}

interface AnalysesResponse {
  ok: boolean
  data?: { analyses: AiAnalysis[] }
}

interface TriggerResponse {
  ok: boolean
  error?: string
}

export function ReplayAiCommentary({ tradeId }: ReplayAiCommentaryProps) {
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Check for an existing completed analysis on mount
  useEffect(() => {
    fetch(`/api/ai/analyses/${tradeId}`)
      .then((res) => res.json())
      .then((json: AnalysesResponse) => {
        if (json.ok && json.data?.analyses?.[0]?.status === "completed") {
          setAnalysis(json.data.analyses[0])
        }
      })
      .catch(() => undefined)
  }, [tradeId])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    pollRef.current = null
    timeoutRef.current = null
  }

  const requestAnalysis = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/daemon/actions/ai/analyze/${tradeId}`, { method: "POST" })
      const json = (await res.json()) as TriggerResponse
      if (!json.ok) {
        setLoading(false)
        return
      }
      // Poll for completion every 3 seconds, give up after 60s
      pollRef.current = setInterval(async () => {
        try {
          const checkRes = await fetch(`/api/ai/analyses/${tradeId}`)
          const checkJson = (await checkRes.json()) as AnalysesResponse
          const latest = checkJson.data?.analyses?.[0]
          if (checkJson.ok && latest?.status === "completed") {
            setAnalysis(latest)
            setLoading(false)
            stopPolling()
          }
        } catch {
          // ignore transient errors
        }
      }, 3000)
      timeoutRef.current = setTimeout(() => {
        stopPolling()
        setLoading(false)
      }, 60_000)
    } catch {
      setLoading(false)
    }
  }

  if (!analysis && !loading) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 text-[11px]"
        onClick={requestAnalysis}
        aria-label="Request AI analysis for this trade"
      >
        <Sparkles className="size-3" aria-hidden="true" />
        AI Analysis
      </Button>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-[11px]" role="status" aria-live="polite">
        <Loader2 className="text-muted-foreground size-3 animate-spin" aria-hidden="true" />
        <span className="text-muted-foreground">Analyzing trade…</span>
      </div>
    )
  }

  if (!analysis) return null

  return (
    <div className="space-y-1">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 rounded text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
        aria-expanded={expanded}
        aria-controls="replay-ai-summary"
      >
        <Sparkles className="size-3 text-blue-500" aria-hidden="true" />
        <span className="text-blue-500">AI Analysis</span>
        {expanded ? (
          <ChevronUp className="text-muted-foreground size-3" aria-hidden="true" />
        ) : (
          <ChevronDown className="text-muted-foreground size-3" aria-hidden="true" />
        )}
      </button>
      {expanded && (
        <p id="replay-ai-summary" className="text-muted-foreground text-[11px] leading-relaxed">
          {analysis.summary}
        </p>
      )}
    </div>
  )
}
