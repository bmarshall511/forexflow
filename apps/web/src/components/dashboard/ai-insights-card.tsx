"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardHeader, CardTitle, CardAction, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { DataTile, InlineStat } from "@/components/ui/data-tile"
import {
  Sparkles, Settings2, CheckCircle2, Loader2, AlertCircle, Circle,
  TrendingUp, Clock, ArrowUpRight, Bot, User, AlertTriangle,
} from "lucide-react"
import { useDaemonStatus } from "@/hooks/use-daemon-status"
import type { AiUsageStats, AiSettingsData, AiAccuracyStats } from "@fxflow/types"
import { formatRelativeTime } from "@fxflow/shared"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface RecentAnalysisSummary {
  id: string
  tradeId: string
  instrument: string
  direction: string
  tradeStatus: string
  depth: string
  model: string
  winProbability: number | null
  tradeQualityScore: number | null
  costUsd: number
  createdAt: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function modelLabel(model: string): string {
  if (model.includes("haiku")) return "Haiku"
  if (model.includes("opus")) return "Opus"
  return "Sonnet"
}

function modelVariant(model: string): "secondary" | "default" | "outline" {
  if (model.includes("haiku")) return "secondary"
  if (model.includes("opus")) return "default"
  return "outline"
}

function fmtCost(n: number): string {
  if (n < 0.001) return "$0.00"
  if (n < 0.01) return `$${n.toFixed(4)}`
  if (n < 1) return `$${n.toFixed(3)}`
  return `$${n.toFixed(2)}`
}

function projectedMonthlyCost(thisMonthCost: number): number {
  const now = new Date()
  const dayOfMonth = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  if (dayOfMonth === 0) return 0
  return (thisMonthCost / dayOfMonth) * daysInMonth
}

// ─── Main card ───────────────────────────────────────────────────────────────

export function AiInsightsCard() {
  const router = useRouter()
  const { lastAiAnalysisStarted, lastAiAnalysisCompleted } = useDaemonStatus()
  const [settings, setSettings] = useState<AiSettingsData | null>(null)
  const [usage, setUsage] = useState<AiUsageStats | null>(null)
  const [recent, setRecent] = useState<RecentAnalysisSummary[]>([])
  const [accuracy, setAccuracy] = useState<AiAccuracyStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeCount, setActiveCount] = useState(0)

  const fetchAll = () => {
    setIsLoading(true)
    Promise.all([
      fetch("/api/ai/settings").then((r) => r.json()).catch(() => null),
      fetch("/api/ai/usage").then((r) => r.json()).catch(() => null),
      fetch("/api/ai/analyses/recent?limit=3").then((r) => r.json()).catch(() => null),
      fetch("/api/ai/accuracy").then((r) => r.json()).catch(() => null),
    ]).then(([settingsRes, usageRes, recentRes, accuracyRes]) => {
      if (settingsRes?.ok) setSettings(settingsRes.data as AiSettingsData)
      if (usageRes?.ok) setUsage(usageRes.data as AiUsageStats)
      if (recentRes?.ok) setRecent(recentRes.data as RecentAnalysisSummary[])
      if (accuracyRes?.ok) setAccuracy(accuracyRes.data as AiAccuracyStats)
    }).finally(() => setIsLoading(false))
  }

  useEffect(() => { fetchAll() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!lastAiAnalysisCompleted) return
    Promise.all([
      fetch("/api/ai/usage").then((r) => r.json()).catch(() => null),
      fetch("/api/ai/analyses/recent?limit=3").then((r) => r.json()).catch(() => null),
      fetch("/api/ai/accuracy").then((r) => r.json()).catch(() => null),
    ]).then(([usageRes, recentRes, accuracyRes]) => {
      if (usageRes?.ok && usageRes.data) setUsage(usageRes.data as AiUsageStats)
      if (recentRes?.ok && recentRes.data) setRecent(recentRes.data as RecentAnalysisSummary[])
      if (accuracyRes?.ok && accuracyRes.data) setAccuracy(accuracyRes.data as AiAccuracyStats)
    }).catch(() => {})
  }, [lastAiAnalysisCompleted])

  useEffect(() => {
    if (lastAiAnalysisStarted) setActiveCount((c) => c + 1)
  }, [lastAiAnalysisStarted])
  useEffect(() => {
    if (lastAiAnalysisCompleted) setActiveCount((c) => Math.max(0, c - 1))
  }, [lastAiAnalysisCompleted])

  const hasKey = settings?.hasClaudeKey ?? false
  const autoAnalysis = settings?.autoAnalysis

  const s = settings!

  const openAnalysis = (a: RecentAnalysisSummary) => {
    const tab = a.tradeStatus === "closed" ? "history" : a.tradeStatus === "pending" ? "pending" : "open"
    const params = new URLSearchParams({ tab })
    if (a.tradeStatus !== "closed") params.set("openAnalysis", a.tradeId)
    router.push(`/positions?${params.toString()}`)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          AI Analysis
          {activeCount > 0 && (
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <Loader2 className="size-2.5 animate-spin" />
              {activeCount} running
            </Badge>
          )}
        </CardTitle>
        <CardAction>
          <Link href="/settings/ai" className="text-muted-foreground hover:text-foreground transition-colors">
            <Settings2 className="size-4" />
            <span className="sr-only">AI Settings</span>
          </Link>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-48" />
            <div className="grid grid-cols-3 gap-2">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
            <Skeleton className="h-24" />
          </div>
        ) : !hasKey ? (
          <div className="rounded-lg border border-dashed p-4 text-center space-y-2">
            <AlertCircle className="size-6 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">Claude API key not configured</p>
            <Link href="/settings/ai" className="text-xs text-primary hover:underline">
              Configure in Settings →
            </Link>
          </div>
        ) : (
          <>
            {/* ── API Key Status ── */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs">
                <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
                <span className="text-muted-foreground">Claude</span>
                {s.claudeKeyLastFour && (
                  <span className="text-muted-foreground/60">••••{s.claudeKeyLastFour}</span>
                )}
                <Badge variant="outline" className="text-[10px] h-4 px-1 ml-auto">
                  {modelLabel(s.defaultModel)}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                {s.hasFinnhubKey ? (
                  <>
                    <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
                    <span className="text-muted-foreground">FinnHub</span>
                    {s.finnhubKeyLastFour && (
                      <span className="text-muted-foreground/60">••••{s.finnhubKeyLastFour}</span>
                    )}
                    <span className="text-muted-foreground/50 ml-auto text-[10px]">calendar & news</span>
                  </>
                ) : (
                  <>
                    <Circle className="size-3.5 shrink-0 text-muted-foreground/40" />
                    <span className="text-muted-foreground/50">FinnHub not configured</span>
                    <Link href="/settings/ai" className="ml-auto text-[10px] text-primary hover:underline">
                      Add key
                    </Link>
                  </>
                )}
              </div>
            </div>

            <Separator />

            {/* ── Cost by Period ── */}
            {usage && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <DataTile
                    label="Today"
                    value={fmtCost(usage.byPeriod.today.costUsd)}
                    subtitle={`${usage.byPeriod.today.count} ${usage.byPeriod.today.count === 1 ? "analysis" : "analyses"}`}
                    variant="muted"
                  />
                  <DataTile
                    label="This Week"
                    value={fmtCost(usage.byPeriod.thisWeek.costUsd)}
                    subtitle={`${usage.byPeriod.thisWeek.count} ${usage.byPeriod.thisWeek.count === 1 ? "analysis" : "analyses"}`}
                    variant="muted"
                  />
                  <DataTile
                    label="This Month"
                    value={fmtCost(usage.byPeriod.thisMonth.costUsd)}
                    subtitle={`${usage.byPeriod.thisMonth.count} ${usage.byPeriod.thisMonth.count === 1 ? "analysis" : "analyses"}`}
                    variant="accent"
                  />
                </div>

                {/* ── Projections + quality metrics ── */}
                <div className="rounded-lg bg-muted/30 px-3 py-1.5">
                  {usage.byPeriod.thisMonth.count > 0 && (
                    <InlineStat
                      label="Est. month-end cost"
                      value={fmtCost(projectedMonthlyCost(usage.byPeriod.thisMonth.costUsd))}
                    />
                  )}
                  {usage.totalAnalyses > 0 && (
                    <InlineStat
                      label="Avg cost / analysis"
                      value={fmtCost(usage.totalCostUsd / usage.totalAnalyses)}
                    />
                  )}
                  {usage.avgWinProbability !== null && (
                    <InlineStat
                      label="Avg win probability"
                      value={`${usage.avgWinProbability}%`}
                      className={
                        usage.avgWinProbability >= 60 ? "text-emerald-600"
                          : usage.avgWinProbability >= 40 ? "text-amber-600"
                          : "text-red-500"
                      }
                    />
                  )}
                  {usage.avgQualityScore !== null && (
                    <InlineStat label="Avg quality score" value={`${usage.avgQualityScore}/10`} />
                  )}
                  {(usage.statusCounts.completed + usage.statusCounts.failed) > 0 && (
                    <InlineStat
                      label="Analysis success rate"
                      value={`${Math.round((usage.statusCounts.completed / (usage.statusCounts.completed + usage.statusCounts.failed)) * 100)}%`}
                      className="text-emerald-600"
                    />
                  )}
                </div>

                {/* ── Auto vs Manual split ── */}
                {usage.totalAnalyses > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <Bot className="size-3.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${Math.round((usage.autoCount / usage.totalAnalyses) * 100)}%` }}
                      />
                    </div>
                    <span className="text-muted-foreground/60 shrink-0 tabular-nums">
                      {usage.autoCount}a / {usage.manualCount}m
                    </span>
                    <User className="size-3.5 text-muted-foreground shrink-0" />
                  </div>
                )}
              </>
            )}

            {/* ── Model Breakdown ── */}
            {usage && usage.byModel.length > 0 && (
              <>
                <Separator />
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">By Model</p>
                  {usage.byModel.map((m) => (
                    <div key={m.model} className="flex items-center gap-2 text-xs">
                      <Badge variant={modelVariant(m.model)} className="text-[10px] h-4 px-1.5 shrink-0">
                        {modelLabel(m.model)}
                      </Badge>
                      <span className="text-muted-foreground">{m.count} analyses</span>
                      <span className="text-muted-foreground/50 tabular-nums text-[10px]">
                        {(m.inputTokens / 1000).toFixed(0)}k/{(m.outputTokens / 1000).toFixed(0)}k tok
                      </span>
                      <span className="ml-auto text-muted-foreground/60 tabular-nums">{fmtCost(m.costUsd)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── Recent Analyses ── */}
            {recent.length > 0 && (
              <>
                <Separator />
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Recent Analyses</p>
                  {recent.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => openAnalysis(a)}
                      className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent transition-colors text-left"
                    >
                      <span className="font-medium shrink-0">
                        {a.instrument.replace("_", "/")}
                      </span>
                      <span className={cn(
                        "text-[10px] shrink-0",
                        a.direction === "long" ? "text-emerald-600" : "text-red-500",
                      )}>
                        {a.direction === "long" ? "↑" : "↓"}
                      </span>
                      <Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0 capitalize">
                        {a.depth}
                      </Badge>
                      {a.winProbability !== null && (
                        <span className={cn(
                          "shrink-0",
                          a.winProbability >= 60 ? "text-emerald-600"
                            : a.winProbability >= 40 ? "text-amber-600"
                            : "text-red-500",
                        )}>
                          {a.winProbability}%
                        </span>
                      )}
                      {a.tradeQualityScore !== null && (
                        <span className="text-muted-foreground/60 shrink-0">
                          Q{a.tradeQualityScore}
                        </span>
                      )}
                      <span className="ml-auto text-muted-foreground/50 tabular-nums shrink-0">
                        {formatRelativeTime(a.createdAt)}
                      </span>
                      <ArrowUpRight className="size-3 shrink-0 text-muted-foreground/40" />
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* ── Prediction Accuracy ── */}
            {accuracy && accuracy.totalRecommendations >= 5 && (
              <>
                <Separator />
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Prediction Accuracy</p>

                  <div className="rounded-lg bg-muted/30 px-3 py-1.5">
                    {accuracy.overallPredictedWinRate !== null && accuracy.overallActualWinRate !== null && (
                      <InlineStat
                        label={`AI predicted ${accuracy.overallPredictedWinRate}% win chance`}
                        value={`${accuracy.overallActualWinRate}% actual`}
                        className={
                          Math.abs(accuracy.overallPredictedWinRate - accuracy.overallActualWinRate) <= 10
                            ? "text-emerald-600"
                            : "text-amber-600"
                        }
                      />
                    )}
                    {accuracy.followedWinRate !== null && (
                      <InlineStat
                        label="Followed AI advice"
                        value={`${accuracy.followedWinRate}% win rate`}
                        className={accuracy.followedWinRate >= 50 ? "text-emerald-600" : "text-red-500"}
                      />
                    )}
                    {accuracy.ignoredWinRate !== null && (
                      <InlineStat
                        label="Ignored AI advice"
                        value={`${accuracy.ignoredWinRate}% win rate`}
                        className={accuracy.ignoredWinRate >= 50 ? "text-emerald-600" : "text-red-500"}
                      />
                    )}
                    <InlineStat
                      label="Recommendations tracked"
                      value={`${accuracy.followedCount} followed / ${accuracy.ignoredCount} ignored`}
                    />
                  </div>

                  {accuracy.calibration.length > 0 && (
                    <div className="space-y-0.5">
                      {accuracy.calibration.map((b) => (
                        <div key={b.bucket} className="flex items-center gap-2 text-[10px] text-muted-foreground px-1">
                          <span className="w-16 shrink-0 tabular-nums">{b.bucket}</span>
                          <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${b.actualWinRate ?? 0}%` }}
                            />
                          </div>
                          <span className="w-10 text-right tabular-nums shrink-0">
                            {b.actualWinRate !== null ? `${b.actualWinRate}%` : "—"}
                          </span>
                          <span className="text-muted-foreground/50 shrink-0">({b.count})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── Auto-Analysis Summary ── */}
            <Separator />
            {autoAnalysis && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Auto-Analysis</span>
                  {autoAnalysis.autoDisabledReason ? (
                    <Link
                      href="/settings/ai"
                      className="ml-auto flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 transition-colors"
                    >
                      <AlertTriangle className="size-2.5" />
                      Auto-disabled
                    </Link>
                  ) : (
                    <span className={cn(
                      "ml-auto text-[10px] rounded px-1.5 py-0.5",
                      autoAnalysis.enabled
                        ? "bg-emerald-500/10 text-emerald-700"
                        : "bg-muted text-muted-foreground",
                    )}>
                      {autoAnalysis.enabled ? "Enabled" : "Disabled"}
                    </span>
                  )}
                </div>
                {autoAnalysis.enabled && (
                  <div className="flex flex-wrap gap-1 pl-5">
                    {autoAnalysis.onOrderFill && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">On Fill</Badge>
                    )}
                    {autoAnalysis.onTradeClose && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">On Close</Badge>
                    )}
                    {autoAnalysis.onPendingCreate && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">On Pending</Badge>
                    )}
                    {autoAnalysis.intervalEnabled && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5 gap-0.5">
                        <Clock className="size-2.5" />
                        {autoAnalysis.intervalHours}h
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
