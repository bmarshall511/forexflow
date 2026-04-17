"use client"

import { useState, useMemo } from "react"
import type {
  SmartFlowTradeData,
  SmartFlowConfigData,
  SmartFlowOpportunityData,
  SmartFlowOpportunityScores,
  SmartFlowPreset,
} from "@fxflow/types"
import { formatRelativeTime } from "@fxflow/shared"
import { SectionCard, DetailRow } from "@/components/ui/section-card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import {
  Workflow,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ShieldCheck,
  Zap,
  Rocket,
  RotateCcw,
  Activity,
  Clock,
  Target,
  BarChart3,
  Sparkles,
} from "lucide-react"

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESET_LABELS: Record<SmartFlowPreset, { label: string; color: string }> = {
  momentum_catch: { label: "Momentum Catch", color: "text-amber-500" },
  steady_growth: { label: "Steady Growth", color: "text-emerald-500" },
  swing_capture: { label: "Swing Capture", color: "text-blue-500" },
  trend_rider: { label: "Trend Rider", color: "text-purple-500" },
  recovery: { label: "Recovery", color: "text-red-500" },
  custom: { label: "Custom", color: "text-gray-500" },
}

const SCAN_MODE_LABELS: Record<string, string> = {
  trend_following: "Trend Following",
  mean_reversion: "Mean Reversion",
  breakout: "Breakout",
  session_momentum: "Session Momentum",
}

const PHASE_LABELS: Record<string, { label: string; progress: number; color: string }> = {
  entry: { label: "Entry", progress: 10, color: "text-blue-500" },
  breakeven: { label: "Breakeven", progress: 35, color: "text-amber-500" },
  trailing: { label: "Trailing", progress: 55, color: "text-emerald-500" },
  partial: { label: "Partial Close", progress: 70, color: "text-purple-500" },
  recovery: { label: "Recovery", progress: 50, color: "text-red-500" },
  safety_net: { label: "Safety Net", progress: 90, color: "text-orange-500" },
  target: { label: "Target", progress: 100, color: "text-green-500" },
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ScoreBar({
  label,
  value,
  max,
  className,
}: {
  label: string
  value: number
  max: number
  className?: string
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className={cn("space-y-0.5", className)}>
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-medium">
          {value}/{max}
        </span>
      </div>
      <Progress value={pct} className="h-1" />
    </div>
  )
}

function ScoreBreakdown({ scores }: { scores: SmartFlowOpportunityScores }) {
  return (
    <div className="space-y-1.5">
      <ScoreBar label="Confluence" value={scores.confluence} max={30} />
      <ScoreBar label="Trend Alignment" value={scores.trendAlignment} max={20} />
      <ScoreBar label="Zone Quality" value={scores.zoneQuality} max={15} />
      <ScoreBar label="Session" value={scores.sessionQuality} max={10} />
      <ScoreBar label="Regime Match" value={scores.regimeMatch} max={10} />
      <ScoreBar label="R:R Quality" value={scores.rrQuality} max={10} />
      <ScoreBar label="Spread Quality" value={scores.spreadQuality} max={5} />
    </div>
  )
}

function ManagementPhase({ trade }: { trade: SmartFlowTradeData }) {
  const phase = PHASE_LABELS[trade.currentPhase] ?? {
    label: trade.currentPhase,
    progress: 20,
    color: "text-muted-foreground",
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">Management Phase</span>
        <Badge variant="outline" className={cn("gap-1 text-[10px]", phase.color)}>
          {phase.label}
        </Badge>
      </div>
      <Progress value={phase.progress} className="h-1.5" />
      <div className="flex flex-wrap gap-1.5">
        {trade.breakevenTriggered && (
          <Badge variant="secondary" className="gap-1 text-[9px]">
            <ShieldCheck className="size-2.5" /> BE triggered
          </Badge>
        )}
        {trade.trailingActivated && (
          <Badge variant="secondary" className="gap-1 text-[9px]">
            <TrendingUp className="size-2.5" /> Trailing active
          </Badge>
        )}
        {trade.safetyNetTriggered && (
          <Badge variant="destructive" className="gap-1 text-[9px]">
            Safety: {trade.safetyNetTriggered.replace("_", " ")}
          </Badge>
        )}
        {trade.recoveryLevel > 0 && (
          <Badge variant="secondary" className="gap-1 text-[9px]">
            <RotateCcw className="size-2.5" /> DCA level {trade.recoveryLevel}
          </Badge>
        )}
      </div>
    </div>
  )
}

function TradeThesis({
  opportunity,
  config,
}: {
  opportunity: SmartFlowOpportunityData
  config: SmartFlowConfigData | null
}) {
  const parts: string[] = []
  const modeName = SCAN_MODE_LABELS[opportunity.scanMode] ?? opportunity.scanMode
  parts.push(`Detected via ${modeName} scanner with score ${opportunity.score}/100.`)

  if (opportunity.reasons.length > 0) {
    parts.push(opportunity.reasons.slice(0, 3).join(". ") + ".")
  }

  if (opportunity.regime) {
    parts.push(`Market regime: ${opportunity.regime}.`)
  }

  if (config) {
    const presetLabel = PRESET_LABELS[config.preset]?.label ?? config.preset
    parts.push(`Trading with ${presetLabel} strategy.`)
  }

  return <p className="text-muted-foreground text-xs leading-relaxed">{parts.join(" ")}</p>
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface SmartFlowAnalysisSectionProps {
  trade: SmartFlowTradeData
  config: SmartFlowConfigData | null
  opportunity: SmartFlowOpportunityData | null
}

export function SmartFlowAnalysisSection({
  trade,
  config,
  opportunity,
}: SmartFlowAnalysisSectionProps) {
  const [showScores, setShowScores] = useState(false)

  const presetMeta = PRESET_LABELS[trade.preset ?? "custom"] ?? PRESET_LABELS.custom

  const metadata = useMemo(() => {
    const items: { label: string; value: string; icon?: typeof Clock }[] = []

    if (config) {
      items.push({ label: "Strategy", value: presetMeta.label })
      items.push({
        label: "Entry Mode",
        value: config.entryMode === "smart_entry" ? "Smart Entry" : "Market",
      })
    }

    if (opportunity) {
      items.push({
        label: "Scan Mode",
        value: SCAN_MODE_LABELS[opportunity.scanMode] ?? opportunity.scanMode,
      })
      items.push({ label: "Score", value: `${opportunity.score} / 100` })
      items.push({ label: "R:R", value: `${opportunity.riskRewardRatio.toFixed(1)}:1` })
      items.push({ label: "Risk", value: `${opportunity.riskPips.toFixed(1)} pips` })
      items.push({ label: "Reward", value: `${opportunity.rewardPips.toFixed(1)} pips` })
      items.push({
        label: "Detected",
        value: formatRelativeTime(opportunity.detectedAt),
      })
      if (opportunity.placedAt) {
        items.push({
          label: "Placed",
          value: formatRelativeTime(opportunity.placedAt),
        })
      }
    }

    if (trade.estimatedHours != null) {
      const low = trade.estimatedLow != null ? `${trade.estimatedLow.toFixed(0)}h` : "?"
      const high = trade.estimatedHigh != null ? `${trade.estimatedHigh.toFixed(0)}h` : "?"
      items.push({
        label: "Est. Duration",
        value: `${trade.estimatedHours.toFixed(0)}h (${low}–${high})`,
        icon: Clock,
      })
    }

    if (trade.entrySpread != null) {
      items.push({ label: "Entry Spread", value: `${trade.entrySpread.toFixed(1)} pips` })
    }

    if (trade.financingAccumulated !== 0) {
      items.push({
        label: "Financing",
        value: `$${trade.financingAccumulated.toFixed(2)}`,
      })
    }

    if (trade.aiTotalCost > 0) {
      items.push({
        label: "AI Cost",
        value: `$${trade.aiTotalCost.toFixed(4)}`,
        icon: Sparkles,
      })
    }

    return items
  }, [trade, config, opportunity, presetMeta])

  return (
    <SectionCard
      icon={Workflow}
      title="SmartFlow Analysis"
      helper="The SmartFlow analysis and strategy details for this trade."
    >
      <div className="space-y-3">
        {/* Score gauge + thesis */}
        {opportunity && (
          <div className="flex gap-3">
            <div className="flex shrink-0 flex-col items-center gap-0.5">
              <div
                className={cn(
                  "flex size-12 items-center justify-center rounded-full border-2 text-sm font-bold",
                  opportunity.score >= 70
                    ? "border-emerald-500 text-emerald-500"
                    : opportunity.score >= 50
                      ? "border-amber-500 text-amber-500"
                      : "border-red-500 text-red-500",
                )}
              >
                {opportunity.score}
              </div>
              <span className="text-muted-foreground text-[9px]">/ 100</span>
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <TradeThesis opportunity={opportunity} config={config} />
            </div>
          </div>
        )}

        {/* Management phase (for active trades) */}
        {trade.status !== "closed" && <ManagementPhase trade={trade} />}

        {/* Market context grid */}
        {opportunity && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {opportunity.regime && (
              <ContextItem
                label="Regime"
                icon={<BarChart3 className="text-muted-foreground size-3" />}
                value={opportunity.regime}
              />
            )}
            {opportunity.session && (
              <ContextItem
                label="Session"
                icon={<Clock className="text-muted-foreground size-3" />}
                value={opportunity.session}
              />
            )}
            <ContextItem
              label="Direction"
              icon={
                opportunity.direction === "long" ? (
                  <TrendingUp className="size-3 text-green-500" />
                ) : (
                  <TrendingDown className="size-3 text-red-500" />
                )
              }
              value={opportunity.direction}
            />
            <ContextItem
              label="R:R"
              icon={<Target className="text-muted-foreground size-3" />}
              value={`${opportunity.riskRewardRatio.toFixed(1)}:1`}
            />
          </div>
        )}

        {/* Metadata details */}
        <div>
          {metadata.map((m) => (
            <DetailRow key={m.label} label={m.label} value={m.value} />
          ))}
        </div>

        {/* AI suggestions (if any) */}
        {trade.aiSuggestions.length > 0 && (
          <div className="space-y-1">
            <span className="text-[11px] font-medium">AI Suggestions</span>
            {trade.aiSuggestions.slice(-5).map((s, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-2 rounded px-2 py-1 text-[10px]",
                  s.autoExecuted
                    ? "bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <Sparkles className="size-2.5 shrink-0" />
                <span className="flex-1 truncate">
                  {s.action}: {s.rationale}
                </span>
                <span className="shrink-0 font-mono">{s.confidence}%</span>
              </div>
            ))}
          </div>
        )}

        {/* Score breakdown (collapsible) */}
        {opportunity && (
          <>
            <button
              type="button"
              onClick={() => setShowScores((v) => !v)}
              className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1 text-[11px] font-medium transition-colors"
              aria-expanded={showScores}
            >
              <ChevronDown
                className={cn("size-3 transition-transform", showScores && "rotate-180")}
              />
              Score Breakdown
            </button>
            {showScores && <ScoreBreakdown scores={opportunity.scores} />}
          </>
        )}

        {/* Management log (last 5 entries) */}
        {trade.managementLog.length > 0 && (
          <div className="space-y-1">
            <span className="text-[11px] font-medium">Management Log</span>
            {trade.managementLog.slice(-5).map((entry, i) => (
              <div key={i} className="text-muted-foreground flex items-start gap-2 text-[10px]">
                <span className="text-muted-foreground/60 shrink-0 font-mono">
                  {new Date(entry.at).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="flex-1">
                  {entry.action}: {entry.detail}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  )
}

function ContextItem({
  label,
  icon,
  value,
}: {
  label: string
  icon: React.ReactNode
  value: string
}) {
  return (
    <div className="flex items-start gap-1.5 text-xs">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <span className="text-muted-foreground">{label}: </span>
        <span className="text-foreground capitalize">{value}</span>
      </div>
    </div>
  )
}
