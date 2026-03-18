"use client"

import { useState, useCallback } from "react"
import type {
  AiAnalysisData,
  OpenTradeData,
  PendingOrderData,
  ClosedTradeData,
} from "@fxflow/types"
import type { AiAnalysisProgress } from "@/hooks/use-ai-analysis"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sparkles,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Copy,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
} from "lucide-react"
import { AnalysisProgressDisplay } from "./analysis-progress"
import { AnalysisResults } from "./analysis-results"
import { toast } from "sonner"
import type { PositionPriceTick } from "@fxflow/types"

type TradeUnion = OpenTradeData | PendingOrderData | ClosedTradeData

interface AnalysisTabContentProps {
  displayAnalysis: AiAnalysisData | null
  progress: AiAnalysisProgress | null
  isLoading: boolean
  isTransitioning: boolean
  activeAnalysis: AiAnalysisData | null
  trade: TradeUnion | null
  tradeStatus: "open" | "pending" | "closed"
  liveTick: PositionPriceTick | null
  isTriggeringAnalysis: boolean
  stuck: boolean
  estimatedSec?: number
  analysisStartedAt?: number | null
  history: AiAnalysisData[]
  viewedAnalysis: AiAnalysisData | null
  onTrigger: () => void
  onCancel: (analysisId: string) => void
  onClearViewed: () => void
}

export function AnalysisTabContent({
  displayAnalysis,
  progress,
  isLoading,
  isTransitioning,
  activeAnalysis,
  trade,
  tradeStatus,
  liveTick,
  isTriggeringAnalysis,
  stuck,
  estimatedSec,
  analysisStartedAt,
  history,
  viewedAnalysis,
  onTrigger,
  onCancel,
  onClearViewed,
}: AnalysisTabContentProps) {
  return (
    <div className="space-y-4 px-6 py-4">
      {/* Progress / Completion transition */}
      {progress && !isTransitioning && (
        <AnalysisProgressDisplay
          progress={progress}
          analysisId={activeAnalysis?.id ?? null}
          onCancel={onCancel}
          estimatedSec={estimatedSec}
          startedAt={analysisStartedAt ?? undefined}
          streamTruncated={progress.streamTruncated}
        />
      )}

      {/* Transitioning: show completion message briefly */}
      {isTransitioning && progress && (
        <div className="bg-card space-y-3 rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            {progress.stage === "Analysis failed" ? (
              <AlertCircle className="text-destructive size-4" />
            ) : (
              <CheckCircle2 className="size-4 text-emerald-500" />
            )}
            <span>{progress.stage}</span>
          </div>
          <div className="bg-primary h-1.5 rounded-full" />
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && !progress && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      )}

      {/* Results — with fade-in animation */}
      {!progress && !isLoading && displayAnalysis?.sections && (
        <div className="animate-fade-in">
          {displayAnalysis !== history[0] && viewedAnalysis && (
            <div className="text-muted-foreground bg-muted mb-4 flex items-center justify-between rounded px-3 py-1.5 text-xs">
              <span>
                Viewing historical analysis from{" "}
                {new Date(displayAnalysis.createdAt).toLocaleDateString()}
              </span>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={onClearViewed}
              >
                View latest
              </Button>
            </div>
          )}
          <AnalysisResults
            sections={displayAnalysis.sections}
            lastTick={liveTick}
            trade={
              trade && "direction" in trade
                ? {
                    instrument: trade.instrument,
                    direction: (trade as OpenTradeData | PendingOrderData).direction,
                    entryPrice: (trade as OpenTradeData | PendingOrderData).entryPrice,
                    currentPrice:
                      "currentPrice" in trade ? (trade as OpenTradeData).currentPrice : null,
                    stopLoss:
                      "stopLoss" in trade
                        ? (trade as OpenTradeData | PendingOrderData).stopLoss
                        : null,
                    takeProfit:
                      "takeProfit" in trade
                        ? (trade as OpenTradeData | PendingOrderData).takeProfit
                        : null,
                    timeframe: "timeframe" in trade ? (trade as OpenTradeData).timeframe : null,
                    openedAt: "openedAt" in trade ? (trade as OpenTradeData).openedAt : null,
                  }
                : null
            }
          />
        </div>
      )}

      {/* Completed but parsing failed (legacy data with status=completed but null sections) */}
      {!progress &&
        !isLoading &&
        displayAnalysis &&
        displayAnalysis.status === "completed" &&
        !displayAnalysis.sections && (
          <ParseFailureBanner
            tradeStatus={tradeStatus}
            isTriggeringAnalysis={isTriggeringAnalysis}
            progress={progress}
            onTrigger={onTrigger}
          />
        )}

      {/* Failed analysis — error banner with full details + raw response viewer */}
      {!progress && !isLoading && displayAnalysis?.status === "failed" && (
        <FailedAnalysisBanner
          displayAnalysis={displayAnalysis}
          tradeStatus={tradeStatus}
          isTriggeringAnalysis={isTriggeringAnalysis}
          progress={progress}
          onTrigger={onTrigger}
        />
      )}

      {/* Stuck analysis */}
      {!progress && !isLoading && stuck && displayAnalysis && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-medium text-amber-600">This analysis appears stuck</p>
            <p className="text-muted-foreground text-xs">
              Started {new Date(displayAnalysis.createdAt).toLocaleString()} but hasn&apos;t
              received updates. It may have been interrupted by a daemon restart.
            </p>
            {tradeStatus !== "closed" && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-xs"
                onClick={onTrigger}
                disabled={isTriggeringAnalysis || !!progress}
              >
                <RefreshCw className="size-3" />
                Retry Analysis
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!progress && !isLoading && !displayAnalysis && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Sparkles className="text-muted-foreground/30 size-10" />
          <div className="space-y-1">
            <p className="text-sm font-medium">No analysis yet</p>
            <p className="text-muted-foreground text-xs">
              Select a model and click Analyze to get AI insights on this{" "}
              {tradeStatus === "pending" ? "pending order" : "trade"}.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

/** Parse failure banner (completed but null sections) */
function ParseFailureBanner({
  tradeStatus,
  isTriggeringAnalysis,
  progress,
  onTrigger,
}: {
  tradeStatus: string
  isTriggeringAnalysis: boolean
  progress: AiAnalysisProgress | null
  onTrigger: () => void
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-500" />
      <div className="space-y-2">
        <p className="text-sm font-medium">
          Analysis completed but results couldn&apos;t be processed
        </p>
        <p className="text-muted-foreground text-xs">
          The AI returned a response, but it couldn&apos;t be parsed correctly. This can happen
          occasionally.
        </p>
        {tradeStatus !== "closed" && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs"
            onClick={onTrigger}
            disabled={isTriggeringAnalysis || !!progress}
          >
            <Sparkles className="size-3" />
            Retry Analysis
          </Button>
        )}
      </div>
    </div>
  )
}

/** Failed analysis banner with categorized error + raw response viewer */
function FailedAnalysisBanner({
  displayAnalysis,
  tradeStatus,
  isTriggeringAnalysis,
  progress,
  onTrigger,
}: {
  displayAnalysis: AiAnalysisData
  tradeStatus: string
  isTriggeringAnalysis: boolean
  progress: AiAnalysisProgress | null
  onTrigger: () => void
}) {
  const [rawExpanded, setRawExpanded] = useState(false)
  const [rawResponse, setRawResponse] = useState<string | null>(null)
  const [rawLoading, setRawLoading] = useState(false)

  const fetchRawResponse = useCallback(async () => {
    if (rawResponse !== null) {
      setRawExpanded((v) => !v)
      return
    }
    setRawLoading(true)
    try {
      const res = await fetch(`/api/ai/analyses/raw/${displayAnalysis.id}`)
      const json = (await res.json()) as { ok: boolean; data?: { rawResponse: string | null } }
      setRawResponse(json.data?.rawResponse ?? "(no response stored)")
      setRawExpanded(true)
    } catch {
      toast.error("Failed to load raw response")
    } finally {
      setRawLoading(false)
    }
  }, [displayAnalysis.id, rawResponse])

  const copyRawResponse = useCallback(() => {
    if (rawResponse) {
      void navigator.clipboard.writeText(rawResponse)
      toast.success("Raw response copied to clipboard")
    }
  }, [rawResponse])

  return (
    <div className="border-destructive/30 bg-destructive/5 rounded-lg border p-4">
      <div className="flex items-start gap-2">
        <AlertCircle className="text-destructive mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-destructive text-sm font-medium">Analysis failed</p>
          <p className="text-muted-foreground text-xs">
            {displayAnalysis.errorMessage ?? "Unknown error"}
          </p>
          <div className="text-muted-foreground flex flex-wrap gap-1.5 text-[10px]">
            <span>{new Date(displayAnalysis.createdAt).toLocaleString()}</span>
            <span>·</span>
            <span className="capitalize">{displayAnalysis.triggeredBy.replace("_", " ")}</span>
            <span>·</span>
            <span>
              {displayAnalysis.model.includes("haiku")
                ? "Haiku"
                : displayAnalysis.model.includes("sonnet")
                  ? "Sonnet"
                  : "Opus"}
            </span>
            <span>·</span>
            <span className="capitalize">{displayAnalysis.depth}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {tradeStatus !== "closed" && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-xs"
                onClick={onTrigger}
                disabled={isTriggeringAnalysis || !!progress}
              >
                <RefreshCw className="size-3" />
                Retry Analysis
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 text-xs"
              onClick={() => void fetchRawResponse()}
              disabled={rawLoading}
            >
              {rawExpanded ? (
                <ChevronDown className="size-3" />
              ) : (
                <ChevronRight className="size-3" />
              )}
              {rawLoading ? "Loading…" : "View Raw Response"}
            </Button>
          </div>

          {/* Raw response viewer */}
          {rawExpanded && rawResponse !== null && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-[10px] font-medium">
                  Raw AI Response
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 gap-1 px-1.5 text-[10px]"
                  onClick={copyRawResponse}
                >
                  <Copy className="size-2.5" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted max-h-60 overflow-auto rounded-md p-3 font-mono text-[10px] leading-relaxed">
                {rawResponse}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
