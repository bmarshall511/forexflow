"use client"

import { useEffect, useState } from "react"
import type {
  TradeSource,
  TradeFinderScoreBreakdown,
  AiTraderScoreBreakdown,
  AiTraderManagementAction,
} from "@fxflow/types"
import { SetupScoreBreakdown } from "@/components/trade-finder/setup-score-breakdown"
import { StatRow } from "@/components/ui/price-card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Search,
  Brain,
  Radio,
  Workflow,
  Loader2,
  ShieldCheck,
  Scissors,
  TrendingUp,
  Clock,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ClipboardList,
  Target,
  Activity,
  Shield,
} from "lucide-react"

// ─── Types for API response ────────────────────────────────────────────────

interface TradeFinderContext {
  scoreTotal: number
  maxPossible: number
  scores: TradeFinderScoreBreakdown
  rrRatio: string
  autoPlaced: boolean
  confirmationPattern: string | null
  breakevenMoved: boolean
  partialTaken: boolean
  detectedAt: string
  placedAt: string | null
  timeframeSet: string
}

interface AiTraderTechnicalSummary {
  rsi: number | null
  macd: { histogram: number } | null
  adx: { adx: number; plusDI: number; minusDI: number } | null
  ema20: number | null
  ema50: number | null
  ema200: number | null
  atr: number | null
  regime: string | null
  isKillZone?: boolean
  htfTrendBullish: boolean | null
}

interface AiTraderContext {
  confidence: number
  scores: AiTraderScoreBreakdown
  profile: string
  regime: string | null
  session: string | null
  primaryTechnique: string | null
  entryRationale: string | null
  riskAssessment: string | null
  managementPlan: string | null
  riskPips: number
  rewardPips: number
  positionSize: number
  tier2Model: string | null
  tier2Cost: number
  tier3Model: string | null
  tier3Cost: number
  riskRewardRatio: number
  technicalSummary: AiTraderTechnicalSummary | null
  managementLog: AiTraderManagementAction[]
  detectedAt: string
  suggestedAt: string | null
  placedAt: string | null
  filledAt: string | null
}

interface TVAlertContext {
  status: string
  direction: string
  rejectionReason: string | null
  executionDetails: {
    entryPrice?: number
    stopLoss?: number
    takeProfit?: number
    positionSize?: number
    spreadAtExecution?: number
  } | null
  signalTime: string | null
  receivedAt: string
  processedAt: string | null
}

interface SmartFlowContext {
  currentPhase: string
  breakevenTriggered: boolean
  trailingActivated: boolean
  recoveryLevel: number
  financingAccumulated: number
  safetyNetTriggered: string | null
  partialCloseLog: Array<{ units: number; price: number; realizedPL: number }>
  managementLog: Array<{ action: string; detail?: string; timestamp: string }>
  preset: string | null
  configName: string | null
}

type SourceContextData =
  | { source: string; found: false }
  | { source: "trade_finder" | "trade_finder_auto"; found: true; data: TradeFinderContext }
  | { source: "ai_trader" | "ai_trader_manual"; found: true; data: AiTraderContext }
  | { source: "ut_bot_alerts"; found: true; data: TVAlertContext }
  | { source: "smart_flow"; found: true; data: SmartFlowContext }

// ─── Hook ──────────────────────────────────────────────────────────────────

function useSourceContext(
  sourceTradeId: string,
  source: TradeSource,
  tradeId: string,
  enabled: boolean,
) {
  const [data, setData] = useState<SourceContextData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled) return
    // Only fetch for sources that have context
    const hasContext =
      source === "trade_finder" ||
      source === "trade_finder_auto" ||
      source === "ai_trader" ||
      source === "ai_trader_manual" ||
      source === "ut_bot_alerts" ||
      source === "smart_flow"
    if (!hasContext) return

    let cancelled = false
    setLoading(true)

    const params = new URLSearchParams({ source, tradeId })
    fetch(`/api/positions/source-context/${encodeURIComponent(sourceTradeId)}?${params}`)
      .then((res) => res.json())
      .then((json: { ok: boolean; data: SourceContextData }) => {
        if (!cancelled && json.ok) setData(json.data)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [sourceTradeId, source, tradeId, enabled])

  return { data, loading }
}

// ─── Sub-panels ────────────────────────────────────────────────────────────

function TradeFinderPanel({ data }: { data: TradeFinderContext }) {
  const pct = data.maxPossible > 0 ? Math.round((data.scoreTotal / data.maxPossible) * 100) : 0
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Search className="size-4 text-teal-500" />
        <span className="text-xs font-semibold">Trade Finder Setup</span>
        <Badge
          variant="outline"
          className={cn(
            "ml-auto px-1.5 py-0 font-mono text-[10px] font-bold tabular-nums",
            pct >= 80
              ? "border-green-500/30 bg-green-500/10 text-green-500"
              : pct >= 60
                ? "border-amber-500/30 bg-amber-500/10 text-amber-500"
                : "border-orange-500/30 bg-orange-500/10 text-orange-500",
          )}
        >
          {data.scoreTotal}/{data.maxPossible} ({pct}%)
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
        <StatRow label="Timeframe Set" value={data.timeframeSet} />
        <StatRow label="R:R" value={data.rrRatio} />
        {data.confirmationPattern && (
          <StatRow label="Confirmation" value={data.confirmationPattern.replace("_", " ")} />
        )}
        {data.autoPlaced && <StatRow label="Placement" value="Automatic" />}
      </div>

      {/* Management status */}
      {(data.breakevenMoved || data.partialTaken) && (
        <div className="flex gap-2">
          {data.breakevenMoved && (
            <Badge
              variant="outline"
              className="border-green-500/20 bg-green-500/5 px-1.5 py-0 text-[10px] text-green-600 dark:text-green-400"
            >
              <ShieldCheck className="mr-1 size-3" />
              Breakeven
            </Badge>
          )}
          {data.partialTaken && (
            <Badge
              variant="outline"
              className="border-amber-500/20 bg-amber-500/5 px-1.5 py-0 text-[10px] text-amber-600 dark:text-amber-400"
            >
              <Scissors className="mr-1 size-3" />
              Partial Taken
            </Badge>
          )}
        </div>
      )}

      <SetupScoreBreakdown scores={data.scores} />
    </div>
  )
}

const AI_SCORE_LABELS: Record<string, string> = {
  technical: "Technical Analysis",
  fundamental: "Fundamentals",
  sentiment: "Market Sentiment",
  session: "Session Timing",
  historical: "Historical Performance",
  confluence: "Multi-Signal Confluence",
}

const PROFILE_TIME_ESTIMATES: Record<string, string> = {
  scalper: "< 8 hours",
  intraday: "< 2 days",
  swing: "1–7 days",
  news: "< 4 hours",
}

const MGMT_ACTION_LABELS: Record<string, { label: string; icon: typeof ShieldCheck }> = {
  breakeven: { label: "Breakeven", icon: ShieldCheck },
  trailing_update: { label: "Trailing Stop", icon: TrendingUp },
  partial_close: { label: "Partial Close", icon: Scissors },
  adjust_sl: { label: "SL Adjusted", icon: Shield },
  adjust_tp: { label: "TP Adjusted", icon: Target },
  news_protection: { label: "News Protection", icon: AlertTriangle },
  re_evaluate: { label: "Re-evaluated", icon: Brain },
  close: { label: "Closed", icon: Activity },
}

function AiTraderPanel({ data }: { data: AiTraderContext }) {
  const [showScores, setShowScores] = useState(false)
  const [showTechnicals, setShowTechnicals] = useState(false)
  const totalCost = data.tier2Cost + data.tier3Cost

  // Derive management status badges from log
  const hasBreakeven = data.managementLog.some((a) => a.action === "breakeven")
  const hasTrailing = data.managementLog.some((a) => a.action === "trailing_update")
  const hasPartial = data.managementLog.some((a) => a.action === "partial_close")
  const hasNewsProtection = data.managementLog.some((a) => a.action === "news_protection")

  return (
    <div className="space-y-3">
      {/* ── Header: confidence badge ── */}
      <div className="flex items-center gap-2">
        <Brain className="size-4 text-indigo-500" />
        <span className="text-xs font-semibold">EdgeFinder Analysis</span>
        <Badge
          variant="outline"
          className={cn(
            "ml-auto px-1.5 py-0 font-mono text-[10px] font-bold tabular-nums",
            data.confidence >= 80
              ? "border-green-500/30 bg-green-500/10 text-green-500"
              : data.confidence >= 60
                ? "border-amber-500/30 bg-amber-500/10 text-amber-500"
                : "border-orange-500/30 bg-orange-500/10 text-orange-500",
          )}
        >
          {data.confidence}% confidence
        </Badge>
      </div>

      {/* ── AI Reasoning: rationale, risk, management plan ── */}
      {data.entryRationale && (
        <div className="space-y-1.5">
          <p className="text-muted-foreground text-[11px] italic leading-relaxed">
            &ldquo;{data.entryRationale}&rdquo;
          </p>
          {data.riskAssessment && (
            <div className="flex gap-1.5 text-[11px]">
              <AlertTriangle className="mt-0.5 size-3 shrink-0 text-amber-500" />
              <p className="text-muted-foreground leading-relaxed">{data.riskAssessment}</p>
            </div>
          )}
          {data.managementPlan && (
            <div className="flex gap-1.5 text-[11px]">
              <ClipboardList className="mt-0.5 size-3 shrink-0 text-blue-500" />
              <p className="text-muted-foreground leading-relaxed">{data.managementPlan}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Trade parameters ── */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
        <StatRow label="Profile" value={<span className="capitalize">{data.profile}</span>} />
        <StatRow label="R:R" value={`${data.riskRewardRatio.toFixed(1)}:1`} />
        <StatRow label="Risk" value={`${data.riskPips.toFixed(1)} pips`} />
        <StatRow label="Reward" value={`${data.rewardPips.toFixed(1)} pips`} />
        {data.positionSize > 0 && (
          <StatRow label="Size" value={`${data.positionSize.toLocaleString()} units`} />
        )}
        <StatRow label="Est. Duration" value={PROFILE_TIME_ESTIMATES[data.profile] ?? "—"} />
        {data.primaryTechnique && (
          <StatRow
            label="Technique"
            value={<span className="capitalize">{data.primaryTechnique.replace(/_/g, " ")}</span>}
          />
        )}
        {data.regime && (
          <StatRow
            label="Regime"
            value={<span className="capitalize">{data.regime.replace(/_/g, " ")}</span>}
          />
        )}
        {data.session && (
          <StatRow
            label="Session"
            value={<span className="capitalize">{data.session.replace(/_/g, " ")}</span>}
          />
        )}
      </div>

      {/* ── Management status badges ── */}
      {data.managementLog.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {hasBreakeven && (
            <Badge
              variant="outline"
              className="border-green-500/20 bg-green-500/5 px-1.5 py-0 text-[10px] text-green-600 dark:text-green-400"
            >
              <ShieldCheck className="mr-1 size-3" />
              Breakeven
            </Badge>
          )}
          {hasTrailing && (
            <Badge
              variant="outline"
              className="border-blue-500/20 bg-blue-500/5 px-1.5 py-0 text-[10px] text-blue-600 dark:text-blue-400"
            >
              <TrendingUp className="mr-1 size-3" />
              Trailing
            </Badge>
          )}
          {hasPartial && (
            <Badge
              variant="outline"
              className="border-purple-500/20 bg-purple-500/5 px-1.5 py-0 text-[10px] text-purple-600 dark:text-purple-400"
            >
              <Scissors className="mr-1 size-3" />
              Partial Close
            </Badge>
          )}
          {hasNewsProtection && (
            <Badge
              variant="outline"
              className="border-amber-500/20 bg-amber-500/5 px-1.5 py-0 text-[10px] text-amber-600 dark:text-amber-400"
            >
              <AlertTriangle className="mr-1 size-3" />
              News Protected
            </Badge>
          )}
        </div>
      )}

      {/* ── Recent management activity ── */}
      {data.managementLog.length > 0 && (
        <div className="space-y-1">
          <span className="text-muted-foreground text-[10px] font-medium">Management Activity</span>
          {data.managementLog.map((entry, i) => {
            const meta = MGMT_ACTION_LABELS[entry.action]
            return (
              <div
                key={i}
                className="text-muted-foreground flex items-center justify-between text-[10px]"
              >
                <span className="flex items-center gap-1">
                  {meta && <meta.icon className="size-2.5" />}
                  <span>{meta?.label ?? entry.action}</span>
                  {entry.detail && (
                    <span className="max-w-[160px] truncate opacity-70">— {entry.detail}</span>
                  )}
                </span>
                <span className="font-mono tabular-nums">
                  {new Date(entry.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Score breakdown (collapsible) ── */}
      <button
        type="button"
        onClick={() => setShowScores(!showScores)}
        className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1 text-[10px] font-medium"
      >
        {showScores ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
        Score Breakdown
      </button>
      {showScores && (
        <div className="space-y-2">
          {Object.entries(data.scores).map(([key, value]) => {
            const pct = Math.round(value as number)
            return (
              <div key={key} className="space-y-0.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span>{AI_SCORE_LABELS[key] ?? key}</span>
                  <span className="text-muted-foreground font-mono tabular-nums">{pct}/100</span>
                </div>
                <div className="bg-muted h-1 overflow-hidden rounded-full">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-amber-500" : "bg-orange-500",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Technical snapshot (collapsible) ── */}
      {data.technicalSummary && (
        <>
          <button
            type="button"
            onClick={() => setShowTechnicals(!showTechnicals)}
            className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1 text-[10px] font-medium"
          >
            {showTechnicals ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            Market Snapshot at Entry
          </button>
          {showTechnicals && <AiTraderTechSummary snap={data.technicalSummary} />}
        </>
      )}

      {/* ── Pipeline timeline ── */}
      <AiTraderTimeline data={data} />

      {/* ── AI cost footer ── */}
      <div className="text-muted-foreground flex items-center justify-between border-t pt-2 text-[10px]">
        <span>AI Cost: ${totalCost.toFixed(4)}</span>
        <span className="font-mono tabular-nums">
          {data.tier2Model?.split("-").slice(-2).join("-") ?? "haiku"} →{" "}
          {data.tier3Model?.split("-").slice(-2).join("-") ?? "sonnet"}
        </span>
      </div>
    </div>
  )
}

/** Condensed technical snapshot at entry time */
function AiTraderTechSummary({ snap }: { snap: AiTraderTechnicalSummary }) {
  const emaAligned =
    snap.ema20 !== null && snap.ema50 !== null && snap.ema200 !== null
      ? snap.ema20 > snap.ema50 && snap.ema50 > snap.ema200
        ? "Bullish (20 > 50 > 200)"
        : snap.ema20 < snap.ema50 && snap.ema50 < snap.ema200
          ? "Bearish (20 < 50 < 200)"
          : "Mixed"
      : null

  const macdDir =
    snap.macd?.histogram !== undefined ? (snap.macd.histogram > 0 ? "Bullish" : "Bearish") : null

  return (
    <div className="bg-muted/40 grid grid-cols-2 gap-x-6 gap-y-1 rounded-md px-3 py-2 text-xs">
      {snap.rsi !== null && (
        <StatRow
          label="RSI(14)"
          value={
            <span
              className={cn(snap.rsi > 70 ? "text-red-500" : snap.rsi < 30 ? "text-green-500" : "")}
            >
              {snap.rsi.toFixed(1)}
            </span>
          }
        />
      )}
      {macdDir && <StatRow label="MACD" value={macdDir} />}
      {snap.adx && (
        <StatRow
          label="ADX"
          value={`${snap.adx.adx.toFixed(0)} (${snap.adx.adx > 25 ? "Trending" : "Weak"})`}
        />
      )}
      {emaAligned && <StatRow label="EMA Stack" value={emaAligned} />}
      {snap.atr !== null && <StatRow label="ATR(14)" value={snap.atr.toFixed(5)} />}
      {snap.htfTrendBullish !== null && (
        <StatRow label="HTF Trend" value={snap.htfTrendBullish ? "Bullish" : "Bearish"} />
      )}
      {snap.isKillZone && (
        <StatRow label="Kill Zone" value={<span className="text-amber-500">Active</span>} />
      )}
    </div>
  )
}

/** Pipeline timeline: detected → suggested → placed → filled */
function AiTraderTimeline({ data }: { data: AiTraderContext }) {
  const steps = [
    { label: "Detected", time: data.detectedAt },
    { label: "Suggested", time: data.suggestedAt },
    { label: "Placed", time: data.placedAt },
    { label: "Filled", time: data.filledAt },
  ].filter((s) => s.time !== null) as { label: string; time: string }[]

  if (steps.length <= 1) return null

  const totalMs =
    new Date(steps[steps.length - 1]!.time).getTime() - new Date(steps[0]!.time).getTime()

  return (
    <div className="space-y-1">
      <div className="text-muted-foreground flex items-center gap-1 text-[10px] font-medium">
        <Clock className="size-3" />
        Pipeline (
        {totalMs < 60_000
          ? `${(totalMs / 1000).toFixed(0)}s`
          : `${Math.floor(totalMs / 60_000)}m ${Math.round((totalMs % 60_000) / 1000)}s`}
        )
      </div>
      <div className="flex items-center gap-1">
        {steps.map((step, i) => (
          <div key={step.label} className="flex items-center gap-1">
            <div className="text-center">
              <div className="bg-primary mx-auto size-1.5 rounded-full" />
              <p className="text-muted-foreground mt-0.5 text-[9px]">{step.label}</p>
              <p className="font-mono text-[9px] tabular-nums">
                {new Date(step.time).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </p>
            </div>
            {i < steps.length - 1 && <div className="bg-border mb-3 h-px w-4 shrink-0" />}
          </div>
        ))}
      </div>
    </div>
  )
}

function TVAlertPanel({ data }: { data: TVAlertContext }) {
  const processingMs =
    data.processedAt && data.receivedAt
      ? new Date(data.processedAt).getTime() - new Date(data.receivedAt).getTime()
      : null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Radio className="size-4 text-emerald-500" />
        <span className="text-xs font-semibold">TradingView Signal</span>
        <Badge
          variant="outline"
          className={cn(
            "ml-auto px-1.5 py-0 text-[10px]",
            data.status === "executed"
              ? "border-green-500/30 bg-green-500/10 text-green-500"
              : data.status === "rejected" || data.status === "failed"
                ? "border-red-500/30 bg-red-500/10 text-red-500"
                : "border-amber-500/30 bg-amber-500/10 text-amber-500",
          )}
        >
          {data.status}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
        <StatRow label="Direction" value={data.direction.toUpperCase()} />
        {processingMs !== null && <StatRow label="Processing" value={`${processingMs}ms`} />}
        {data.rejectionReason && (
          <StatRow
            label="Rejection"
            value={
              <span className="text-red-500">
                {data.rejectionReason.replace(/_/g, " ").toLowerCase()}
              </span>
            }
          />
        )}
        {data.executionDetails?.spreadAtExecution != null && (
          <StatRow label="Spread at Entry" value={`${data.executionDetails.spreadAtExecution}p`} />
        )}
        {data.executionDetails?.positionSize != null && (
          <StatRow label="Size" value={`${data.executionDetails.positionSize} units`} />
        )}
      </div>
    </div>
  )
}

const PHASE_LABELS: Record<string, { label: string; color: string }> = {
  entry: { label: "Entry", color: "text-amber-500" },
  breakeven: { label: "Breakeven", color: "text-green-500" },
  trailing: { label: "Trailing", color: "text-blue-500" },
  partial: { label: "Partial Exit", color: "text-purple-500" },
  recovery: { label: "Recovery", color: "text-orange-500" },
  safety_net: { label: "Safety Net", color: "text-red-500" },
  target: { label: "Target", color: "text-green-500" },
}

function SmartFlowPanel({ data }: { data: SmartFlowContext }) {
  const phase = PHASE_LABELS[data.currentPhase] ?? { label: data.currentPhase, color: "" }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Workflow className="size-4 text-sky-500" />
        <span className="text-xs font-semibold">SmartFlow Management</span>
        <Badge
          variant="outline"
          className="ml-auto border-sky-500/20 bg-sky-500/10 px-1.5 py-0 text-[10px]"
        >
          <span className={phase.color}>{phase.label}</span>
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
        {data.preset && <StatRow label="Preset" value={data.preset} />}
        {data.configName && <StatRow label="Config" value={data.configName} />}
        {data.recoveryLevel > 0 && (
          <StatRow label="Recovery Level" value={`DCA #${data.recoveryLevel}`} />
        )}
        {data.financingAccumulated !== 0 && (
          <StatRow label="Swap Costs" value={`$${data.financingAccumulated.toFixed(2)}`} />
        )}
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap gap-2">
        {data.breakevenTriggered && (
          <Badge
            variant="outline"
            className="border-green-500/20 bg-green-500/5 px-1.5 py-0 text-[10px] text-green-600 dark:text-green-400"
          >
            <ShieldCheck className="mr-1 size-3" />
            Breakeven
          </Badge>
        )}
        {data.trailingActivated && (
          <Badge
            variant="outline"
            className="border-blue-500/20 bg-blue-500/5 px-1.5 py-0 text-[10px] text-blue-600 dark:text-blue-400"
          >
            <TrendingUp className="mr-1 size-3" />
            Trailing
          </Badge>
        )}
        {data.safetyNetTriggered && (
          <Badge
            variant="outline"
            className="border-red-500/20 bg-red-500/5 px-1.5 py-0 text-[10px] text-red-600 dark:text-red-400"
          >
            Safety: {data.safetyNetTriggered.replace("_", " ")}
          </Badge>
        )}
      </div>

      {/* Recent management log */}
      {data.managementLog.length > 0 && (
        <div className="space-y-1">
          <span className="text-muted-foreground text-[10px] font-medium">Recent Activity</span>
          {data.managementLog.map((entry, i) => (
            <div key={i} className="text-muted-foreground flex justify-between text-[10px]">
              <span>{entry.action}</span>
              <span className="font-mono tabular-nums">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────

interface SourceContextPanelProps {
  sourceTradeId: string
  tradeId: string
  source: TradeSource
  isExpanded: boolean
}

export function SourceContextPanel({
  sourceTradeId,
  tradeId,
  source,
  isExpanded,
}: SourceContextPanelProps) {
  const { data, loading } = useSourceContext(sourceTradeId, source, tradeId, isExpanded)

  // Don't render for sources without context
  const hasContext =
    source === "trade_finder" ||
    source === "trade_finder_auto" ||
    source === "ai_trader" ||
    source === "ai_trader_manual" ||
    source === "ut_bot_alerts" ||
    source === "smart_flow"
  if (!hasContext) return null

  if (loading) {
    return (
      <div className="flex items-center justify-center py-3">
        <Loader2 className="text-muted-foreground size-4 animate-spin" />
        <span className="text-muted-foreground ml-2 text-xs">Loading source details...</span>
      </div>
    )
  }

  if (!data || !data.found) return null

  return (
    <div className="border-border/40 rounded-lg border p-3">
      {(data.source === "trade_finder" || data.source === "trade_finder_auto") && (
        <TradeFinderPanel data={data.data} />
      )}
      {(data.source === "ai_trader" || data.source === "ai_trader_manual") && (
        <AiTraderPanel data={data.data} />
      )}
      {data.source === "ut_bot_alerts" && <TVAlertPanel data={data.data} />}
      {data.source === "smart_flow" && <SmartFlowPanel data={data.data} />}
    </div>
  )
}
