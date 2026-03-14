"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  CalendarDays,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { AiDigestData } from "@fxflow/types"

export function DigestCard() {
  const [digest, setDigest] = useState<AiDigestData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showDetail, setShowDetail] = useState(false)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    fetch("/api/ai/digests?limit=1")
      .then((r) => r.json())
      .then((json: { ok: boolean; data?: { items: AiDigestData[] } }) => {
        if (json.ok && json.data?.items?.[0]) {
          setDigest(json.data.items[0])
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="size-4 text-violet-500" />
            Performance Digest
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    )
  }

  const triggerGenerate = async (period: "weekly" | "monthly") => {
    setGenerating(true)
    const now = new Date()
    const periodEnd = now.toISOString()
    const periodStart = new Date(
      period === "weekly" ? now.getTime() - 7 * 86400000 : now.getTime() - 30 * 86400000,
    ).toISOString()
    try {
      const res = await fetch("/api/ai/digests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, periodStart, periodEnd }),
      })
      const json = (await res.json()) as { ok: boolean; error?: string }
      if (!json.ok) throw new Error(json.error ?? "Failed")
      toast.success(
        `${period === "weekly" ? "Weekly" : "Monthly"} digest generating — check back in ~30s`,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate digest")
    } finally {
      setGenerating(false)
    }
  }

  if (!digest || !digest.sections) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="size-4 text-violet-500" />
            Performance Digest
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-xs">
            No digests available yet. Generate one now or enable automatic digests in{" "}
            <a href="/settings/ai" className="text-primary hover:underline">
              AI Settings
            </a>
            .
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 flex-1 gap-1.5 text-xs"
              disabled={generating}
              onClick={() => triggerGenerate("weekly")}
            >
              {generating ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Sparkles className="size-3" />
              )}
              Last 7 Days
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 flex-1 gap-1.5 text-xs"
              disabled={generating}
              onClick={() => triggerGenerate("monthly")}
            >
              {generating ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Sparkles className="size-3" />
              )}
              Last 30 Days
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const s = digest.sections
  const isProfit = s.totalPnl >= 0
  const periodLabel = digest.period === "weekly" ? "Weekly" : "Monthly"
  const dateRange = `${new Date(digest.periodStart).toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${new Date(digest.periodEnd).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="size-4 text-violet-500" />
          Performance Digest
          <Badge variant="outline" className="ml-auto h-4 px-1.5 text-[10px]">
            {periodLabel}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Period + summary */}
        <div className="space-y-1">
          <p className="text-muted-foreground text-[10px]">{dateRange}</p>
          <p className="text-xs leading-relaxed">{s.periodSummary}</p>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-muted/30 rounded-md border px-2 py-1.5 text-center">
            <p className="text-muted-foreground text-[10px]">Trades</p>
            <p className="text-sm font-semibold tabular-nums">{s.totalTrades}</p>
          </div>
          <div className="bg-muted/30 rounded-md border px-2 py-1.5 text-center">
            <p className="text-muted-foreground text-[10px]">Win Rate</p>
            <p
              className={cn(
                "text-sm font-semibold tabular-nums",
                s.winRate >= 0.5 ? "text-emerald-600" : "text-red-500",
              )}
            >
              {Math.round(s.winRate * 100)}%
            </p>
          </div>
          <div className="bg-muted/30 rounded-md border px-2 py-1.5 text-center">
            <p className="text-muted-foreground text-[10px]">P&L</p>
            <p
              className={cn(
                "text-sm font-semibold tabular-nums",
                isProfit ? "text-emerald-600" : "text-red-500",
              )}
            >
              {isProfit ? "+" : ""}${s.totalPnl.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Best/worst pair */}
        <div className="flex gap-2 text-xs">
          {s.bestPair && (
            <div className="flex items-center gap-1 text-emerald-600">
              <TrendingUp className="size-3" />
              <span>
                {s.bestPair.instrument.replace("_", "/")} +${s.bestPair.pnl.toFixed(2)}
              </span>
            </div>
          )}
          {s.worstPair && (
            <div className="flex items-center gap-1 text-red-500">
              <TrendingDown className="size-3" />
              <span>
                {s.worstPair.instrument.replace("_", "/")} ${s.worstPair.pnl.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Top pattern/mistake */}
        {(s.patterns.length > 0 || s.mistakes.length > 0) && (
          <div className="space-y-1">
            {s.patterns[0] && (
              <div className="flex items-start gap-1.5 text-xs">
                <TrendingUp className="mt-0.5 size-3 shrink-0 text-emerald-500" />
                <span className="text-muted-foreground">{s.patterns[0]}</span>
              </div>
            )}
            {s.mistakes[0] && (
              <div className="flex items-start gap-1.5 text-xs">
                <AlertTriangle className="mt-0.5 size-3 shrink-0 text-amber-500" />
                <span className="text-muted-foreground">{s.mistakes[0]}</span>
              </div>
            )}
          </div>
        )}

        {/* Expand/detail toggle */}
        {!showDetail ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-full gap-1 text-xs"
            onClick={() => setShowDetail(true)}
          >
            View Full Report
            <ArrowRight className="size-3" />
          </Button>
        ) : (
          <DigestDetail sections={s} />
        )}
      </CardContent>
    </Card>
  )
}

// ─── Inline Detail View ──────────────────────────────────────────────────────

function DigestDetail({ sections: s }: { sections: NonNullable<AiDigestData["sections"]> }) {
  return (
    <div className="space-y-3 border-t pt-3">
      {/* Patterns */}
      {s.patterns.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium">Patterns Identified</p>
          <ul className="space-y-0.5">
            {s.patterns.map((p, i) => (
              <li key={i} className="text-muted-foreground flex items-start gap-1.5 text-xs">
                <span className="shrink-0 text-emerald-500">+</span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Mistakes */}
      {s.mistakes.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium">Common Mistakes</p>
          <ul className="space-y-0.5">
            {s.mistakes.map((m, i) => (
              <li key={i} className="text-muted-foreground flex items-start gap-1.5 text-xs">
                <span className="shrink-0 text-amber-500">!</span>
                {m}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Improvements */}
      {s.improvements.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium">Action Items</p>
          <ul className="space-y-0.5">
            {s.improvements.map((imp, i) => (
              <li key={i} className="text-muted-foreground flex items-start gap-1.5 text-xs">
                <span className="text-primary shrink-0">→</span>
                {imp}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Risk Management */}
      {s.riskManagement && (
        <div className="space-y-1">
          <p className="text-xs font-medium">Risk Management</p>
          <p className="text-muted-foreground text-xs">{s.riskManagement}</p>
        </div>
      )}

      {/* Emotional Patterns */}
      {s.emotionalPatterns && (
        <div className="space-y-1">
          <p className="text-xs font-medium">Emotional Patterns</p>
          <p className="text-muted-foreground text-xs">{s.emotionalPatterns}</p>
        </div>
      )}

      {/* Goal */}
      {s.goalSuggestion && (
        <div className="border-primary/20 bg-primary/5 rounded-lg border p-2.5">
          <p className="text-primary mb-0.5 text-xs font-medium">Focus for Next Period</p>
          <p className="text-muted-foreground text-xs">{s.goalSuggestion}</p>
        </div>
      )}
    </div>
  )
}
