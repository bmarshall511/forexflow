"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { formatCurrency } from "@fxflow/shared"
import { cn } from "@/lib/utils"
import { Sparkles, ChevronDown, Settings, ExternalLink } from "lucide-react"

interface AiUsageData {
  todayCost: number
  weekCost: number
  monthCost: number
  todayCount: number
  weekCount: number
  monthCount: number
}

interface AiRecentAnalysis {
  id: string
  instrument: string
  direction: string
  winProbability: number | null
  qualityScore: number | null
  createdAt: string
}

export function AiInsightsBar() {
  const [usage, setUsage] = useState<AiUsageData | null>(null)
  const [analyses, setAnalyses] = useState<AiRecentAnalysis[]>([])
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false

    // Check settings
    fetch("/api/ai/settings")
      .then(async (res) => {
        const json = await res.json()
        if (!cancelled) {
          setHasKey(!!json.data?.claudeApiKeySet)
        }
      })
      .catch(() => {
        if (!cancelled) setHasKey(false)
      })

    // Fetch usage
    fetch("/api/ai/usage")
      .then(async (res) => {
        const json = await res.json()
        if (!cancelled && json.ok) setUsage(json.data)
      })
      .catch(() => {})

    // Fetch recent analyses
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

  // No API key configured
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

  // Loading
  if (hasKey === null || !usage) {
    return null // Silently load — not critical for dashboard
  }

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
          "flex w-full items-center gap-4 px-4 py-3 text-left transition-colors",
          "hover:bg-muted/50 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2",
        )}
        aria-expanded={expanded}
        aria-controls="ai-insights-detail"
      >
        <Sparkles className="text-muted-foreground size-4 shrink-0" />

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="text-muted-foreground">
            <span className="text-foreground font-medium">{formatCurrency(usage.todayCost)}</span>{" "}
            today
          </span>
          <span className="text-muted-foreground hidden sm:inline">
            <span className="font-mono tabular-nums">{usage.todayCount}</span> analyses
          </span>
          {usage.monthCost > 0 && (
            <span className="text-muted-foreground hidden md:inline">
              <span className="font-mono tabular-nums">{formatCurrency(usage.monthCost)}</span> this
              month
            </span>
          )}
        </div>

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
          <div className="mb-3 grid grid-cols-3 gap-3">
            <CostTile label="Today" cost={usage.todayCost} count={usage.todayCount} />
            <CostTile label="This Week" cost={usage.weekCost} count={usage.weekCount} />
            <CostTile label="This Month" cost={usage.monthCost} count={usage.monthCount} accent />
          </div>

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
                      a.direction === "long" ? "text-status-connected" : "text-status-disconnected",
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
        </div>
      )}
    </div>
  )
}

// ─── Cost tile sub-component ─────────────────────────────────────────────────

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
        {count} analys{count !== 1 ? "es" : "is"}
      </span>
    </div>
  )
}
