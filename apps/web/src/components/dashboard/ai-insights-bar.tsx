"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import type { AiUsageStats, AiSettingsData } from "@fxflow/types"
import { formatCurrency } from "@fxflow/shared"
import { cn } from "@/lib/utils"
import { Sparkles, ChevronDown, Settings, ExternalLink, Zap, Brain } from "lucide-react"

interface RecentAnalysis {
  id: string
  instrument: string
  direction: string
  winProbability: number | null
  qualityScore: number | null
  createdAt: string
}

export function AiInsightsBar() {
  const [usage, setUsage] = useState<AiUsageStats | null>(null)
  const [analyses, setAnalyses] = useState<RecentAnalysis[]>([])
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false

    fetch("/api/ai/settings")
      .then(async (res) => {
        const json = (await res.json()) as { ok: boolean; data?: AiSettingsData }
        if (!cancelled) setHasKey(!!json.data?.hasClaudeKey)
      })
      .catch(() => {
        if (!cancelled) setHasKey(false)
      })

    fetch("/api/ai/usage")
      .then(async (res) => {
        const json = (await res.json()) as { ok: boolean; data?: AiUsageStats }
        if (!cancelled && json.ok && json.data) setUsage(json.data)
      })
      .catch(() => {})

    fetch("/api/ai/analyses/list?pageSize=3&status=completed")
      .then(async (res) => {
        const json = await res.json()
        if (!cancelled && json.ok) setAnalyses(json.data?.analyses ?? [])
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  // No API key configured — setup prompt
  if (hasKey === false) {
    return (
      <div
        className={cn(
          "border-border/50 bg-card flex items-center gap-3 rounded-xl border border-dashed px-4 py-3",
          "animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500",
        )}
        style={{ animationDelay: "400ms" }}
      >
        <Sparkles className="text-muted-foreground size-4 shrink-0" />
        <p className="text-muted-foreground flex-1 text-xs">
          Set up AI Analysis to get trade insights and automated recommendations
        </p>
        <Link
          href="/settings/ai"
          className="text-primary flex items-center gap-1 text-xs font-medium hover:underline"
        >
          Configure
          <ExternalLink className="size-3" />
        </Link>
      </div>
    )
  }

  // Loading — don't show a skeleton, just hide
  if (hasKey === null || !usage) return null

  const today = usage.byPeriod?.today ?? { count: 0, costUsd: 0 }
  const week = usage.byPeriod?.thisWeek ?? { count: 0, costUsd: 0 }
  const month = usage.byPeriod?.thisMonth ?? { count: 0, costUsd: 0 }

  const hasActivity = usage.totalAnalyses > 0

  return (
    <div
      className={cn(
        "border-border/50 bg-card overflow-hidden rounded-xl border transition-all duration-300",
        "animate-in fade-in slide-in-from-bottom-2 fill-mode-both",
      )}
      style={{ animationDelay: "400ms" }}
    >
      {/* Collapsed summary bar */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
          "hover:bg-muted/50 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2",
        )}
        aria-expanded={expanded}
        aria-controls="ai-insights-detail"
      >
        <Sparkles className="size-4 shrink-0 text-violet-500" />

        {hasActivity ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="text-muted-foreground">
              <span className="text-foreground font-medium tabular-nums">
                {formatCurrency(today.costUsd)}
              </span>{" "}
              today
            </span>
            {today.count > 0 && (
              <span className="text-muted-foreground hidden sm:inline">
                <span className="font-mono tabular-nums">{today.count}</span>{" "}
                {today.count === 1 ? "analysis" : "analyses"}
              </span>
            )}
            {month.costUsd > 0 && (
              <span className="text-muted-foreground hidden md:inline">
                <span className="font-mono tabular-nums">{formatCurrency(month.costUsd)}</span> this
                month
              </span>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground flex-1 text-xs">
            AI Analysis is configured. Run your first analysis from a trade&apos;s detail view.
          </span>
        )}

        <div className="flex items-center gap-2">
          <Link
            href="/settings/ai"
            onClick={(e) => e.stopPropagation()}
            className="text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            aria-label="AI settings"
          >
            <Settings className="size-3.5" />
          </Link>
          <ChevronDown
            className={cn(
              "text-muted-foreground size-4 transition-transform duration-200",
              expanded && "rotate-180",
            )}
          />
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div
          id="ai-insights-detail"
          className="animate-in fade-in slide-in-from-top-1 border-t px-4 py-3 duration-200"
        >
          {/* Cost breakdown */}
          <div className="mb-3 grid grid-cols-3 gap-2">
            <CostTile label="Today" cost={today.costUsd} count={today.count} />
            <CostTile label="This Week" cost={week.costUsd} count={week.count} />
            <CostTile label="This Month" cost={month.costUsd} count={month.count} accent />
          </div>

          {/* Stats row */}
          {hasActivity && (
            <div className="mb-3 flex flex-wrap gap-3 text-xs">
              {usage.avgWinProbability !== null && (
                <StatPill
                  icon={<Zap className="size-3 text-amber-500" />}
                  label="Avg Win Prob"
                  value={`${Math.round(usage.avgWinProbability)}%`}
                />
              )}
              {usage.avgQualityScore !== null && (
                <StatPill
                  icon={<Brain className="size-3 text-violet-500" />}
                  label="Avg Quality"
                  value={`${usage.avgQualityScore.toFixed(1)}/10`}
                />
              )}
              <StatPill label="Total" value={`${usage.totalAnalyses}`} />
              {usage.autoCount > 0 && <StatPill label="Auto" value={`${usage.autoCount}`} />}
            </div>
          )}

          {/* Recent analyses */}
          {analyses.length > 0 && (
            <div className="space-y-1">
              <h3 className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
                Recent Analyses
              </h3>
              {analyses.map((a) => (
                <div key={a.id} className="flex items-center gap-2 py-1 text-xs">
                  <span className="font-medium">{a.instrument.replace("_", "/")}</span>
                  <span
                    className={cn(
                      "text-[10px] font-semibold uppercase",
                      a.direction === "long" ? "text-green-500" : "text-red-500",
                    )}
                  >
                    {a.direction}
                  </span>
                  {a.winProbability !== null && (
                    <span className="text-muted-foreground font-mono tabular-nums">
                      {Math.round(a.winProbability)}% win
                    </span>
                  )}
                  {a.qualityScore !== null && (
                    <span className="text-muted-foreground font-mono tabular-nums">
                      {a.qualityScore}/10
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!hasActivity && (
            <p className="text-muted-foreground py-2 text-center text-xs">
              No analyses yet. Open a trade and tap the AI Analysis button to get started.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function CostTile({
  label,
  cost,
  count,
  accent,
}: {
  label: string
  cost: number
  count: number
  accent?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-2",
        accent ? "border-primary/20 bg-primary/5" : "border-border/50",
      )}
    >
      <span className="text-muted-foreground text-[10px] uppercase tracking-wider">{label}</span>
      <p className="font-mono text-sm font-semibold tabular-nums">{formatCurrency(cost)}</p>
      <span className="text-muted-foreground/60 text-[10px] tabular-nums">
        {count} {count === 1 ? "analysis" : "analyses"}
      </span>
    </div>
  )
}

function StatPill({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="bg-muted/50 flex items-center gap-1.5 rounded-full px-2.5 py-1">
      {icon}
      <span className="text-muted-foreground text-[10px]">{label}</span>
      <span className="text-[10px] font-semibold tabular-nums">{value}</span>
    </div>
  )
}
