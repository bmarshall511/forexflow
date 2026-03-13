"use client"

import { useState, useMemo } from "react"
import type { AiAnalysisSections, AiKeyLevel, PositionPriceTick } from "@fxflow/types"
import { getDecimalPlaces } from "@fxflow/shared"
import { createEntryLevel } from "@/components/charts/chart-markers"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { GlossaryTerm } from "@/components/ui/glossary-term"
import { TldrCard } from "./tldr-card"
import { TradingViewChart } from "@/components/charts/tradingview-chart"
import { cn } from "@/lib/utils"
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  Target,
  Newspaper,
  History,
  Lightbulb,
  GraduationCap,
  ChevronDown,
  Layers,
  Crosshair,
  ShieldAlert,
} from "lucide-react"

interface TradeChartInfo {
  instrument: string
  direction: "long" | "short"
  entryPrice: number
  currentPrice: number | null
  stopLoss: number | null
  takeProfit: number | null
  timeframe?: string | null
  openedAt?: string | null
}

interface AnalysisResultsProps {
  sections: AiAnalysisSections
  trade?: TradeChartInfo | null
  /** Live price tick for real-time candle updates */
  lastTick?: PositionPriceTick | null
}

// ─── Risk Badge ───────────────────────────────────────────────────────────────

function RiskBadge({ level }: { level: AiAnalysisSections["risk"]["assessment"] }) {
  const map = {
    low: { label: "Low Risk", className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
    medium: { label: "Medium Risk", className: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
    high: { label: "High Risk", className: "bg-red-500/15 text-red-600 border-red-500/30" },
    very_high: { label: "Very High Risk", className: "bg-red-700/20 text-red-700 border-red-700/30" },
  }
  const { label, className } = map[level] ?? map.medium
  return <Badge variant="outline" className={cn("text-xs", className)}>{label}</Badge>
}

// ─── Win Probability Bar ──────────────────────────────────────────────────────

function WinProbabilityBar({ probability, qualityScore }: { probability: number; qualityScore: number }) {
  const probColor = probability >= 65 ? "bg-emerald-500" : probability >= 45 ? "bg-amber-500" : "bg-red-500"
  const qualColor = qualityScore >= 70 ? "bg-emerald-500" : qualityScore >= 50 ? "bg-amber-500" : "bg-red-500"

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground"><GlossaryTerm term="win rate">Win Probability</GlossaryTerm></span>
          <span className="font-medium tabular-nums">{probability}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className={cn("h-full rounded-full transition-all", probColor)} style={{ width: `${probability}%` }} />
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Trade Quality</span>
          <span className="font-medium tabular-nums">{qualityScore}/100</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className={cn("h-full rounded-full transition-all", qualColor)} style={{ width: `${qualityScore}%` }} />
        </div>
      </div>
    </div>
  )
}

// ─── Key Levels ───────────────────────────────────────────────────────────────

function KeyLevels({ levels }: { levels: AiKeyLevel[] }) {
  if (!levels.length) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {levels.map((level, i) => (
        <div
          key={i}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] border",
            level.type === "support" && "bg-emerald-500/10 border-emerald-500/30 text-emerald-600",
            level.type === "resistance" && "bg-red-500/10 border-red-500/30 text-red-600",
            level.type === "pivot" && "bg-blue-500/10 border-blue-500/30 text-blue-600",
          )}
        >
          <GlossaryTerm term={level.type}>
            <span className="capitalize">{level.type}</span>
          </GlossaryTerm>
          <span className="font-mono font-medium">{level.price}</span>
          <span className="text-muted-foreground">— {level.label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Section Wrapper ──────────────────────────────────────────────────────────

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-sm font-semibold">
        {icon}
        {title}
      </div>
      {children}
    </div>
  )
}

// ─── Educational Panel ────────────────────────────────────────────────────────

function EducationalPanel({ content }: { content: string }) {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <div className="rounded-md border border-primary/20 bg-primary/5">
      <button
        type="button"
        className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10 transition-colors rounded-md"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <GraduationCap className="size-3.5 shrink-0" />
        <span>Learn why this matters</span>
        <ChevronDown className={cn("size-3 ml-auto transition-transform", isOpen && "rotate-180")} />
      </button>
      {isOpen && (
        <div className="px-3 pb-3 text-xs text-muted-foreground leading-relaxed">
          {content}
        </div>
      )}
    </div>
  )
}

// ─── Confluence Trend Arrow ──────────────────────────────────────────────────

function TrendArrow({ trend, label }: { trend: "bullish" | "bearish" | "sideways"; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
      <div className={cn(
        "flex items-center justify-center size-8 rounded-full",
        trend === "bullish" && "bg-emerald-500/10 text-emerald-500",
        trend === "bearish" && "bg-red-500/10 text-red-500",
        trend === "sideways" && "bg-amber-500/10 text-amber-500",
      )}>
        {trend === "bullish" && <TrendingUp className="size-4" />}
        {trend === "bearish" && <TrendingDown className="size-4" />}
        {trend === "sideways" && <Minus className="size-4" />}
      </div>
      <span className={cn(
        "text-[10px] font-medium capitalize",
        trend === "bullish" && "text-emerald-600",
        trend === "bearish" && "text-red-600",
        trend === "sideways" && "text-amber-600",
      )}>
        {trend}
      </span>
    </div>
  )
}

// ─── Main Results ─────────────────────────────────────────────────────────────

export function AnalysisResults({ sections, trade, lastTick }: AnalysisResultsProps) {
  const sentimentNote = sections.marketContext?.sentimentNote ?? ""
  const sentimentIcon =
    sentimentNote.toLowerCase().includes("bull") ? (
      <TrendingUp className="size-4 text-emerald-500" />
    ) : sentimentNote.toLowerCase().includes("bear") ? (
      <TrendingDown className="size-4 text-red-500" />
    ) : (
      <Minus className="size-4 text-muted-foreground" />
    )

  // Build trade entry level for the chart primitive (same as chart-panel.tsx)
  const entryTradeLevels = useMemo(() => {
    if (!trade?.openedAt) return []
    const tf = trade.timeframe ?? "H1"
    const decimals = getDecimalPlaces(trade.instrument)
    return [createEntryLevel(trade.openedAt, trade.direction, trade.entryPrice, tf, decimals)]
  }, [trade])

  // Scroll to entry candle for closed trades; open trades use fitContent (shows current price)
  const isLiveTrade = !!lastTick
  const scrollToTime = useMemo(() => {
    if (isLiveTrade || !trade?.openedAt) return undefined
    return Math.floor(new Date(trade.openedAt).getTime() / 1000)
  }, [trade, isLiveTrade])

  return (
    <div className="space-y-5">
      {/* TL;DR Card */}
      {sections.tldr && (
        <TldrCard
          tldr={sections.tldr}
          winProbability={sections.winProbability}
          qualityScore={sections.tradeQualityScore}
        />
      )}

      {/* Mini Trade Chart */}
      {trade && (
        <div className="rounded-lg border bg-muted/30 overflow-hidden">
          <TradingViewChart
            instrument={trade.instrument}
            direction={trade.direction}
            entryPrice={trade.entryPrice}
            currentPrice={trade.currentPrice}
            lastTick={lastTick}
            stopLoss={trade.stopLoss}
            takeProfit={trade.takeProfit}
            defaultTimeframe={trade.timeframe ?? "H1"}
            tradeLevels={entryTradeLevels}
            scrollToTime={scrollToTime}
            height={220}
          />
        </div>
      )}

      {/* Summary */}
      <div className="rounded-lg bg-muted/50 p-4 space-y-3">
        <div className="flex items-start gap-2">
          {sentimentIcon}
          <p className="text-sm leading-relaxed">{sections.summary}</p>
        </div>
        <WinProbabilityBar probability={sections.winProbability ?? 50} qualityScore={sections.tradeQualityScore ?? 50} />
        <div className="flex items-center gap-2">
          <RiskBadge level={sections.risk?.assessment ?? "medium"} />
          {sections.marketContext?.currentSession && (
            <span className="text-xs text-muted-foreground">
              <GlossaryTerm term="session">{sections.marketContext.currentSession} session</GlossaryTerm>
            </span>
          )}
        </div>
      </div>

      <Separator />

      {/* Timeframe Confluence */}
      {sections.confluenceScore && (
        <>
          <Section icon={<Layers className="size-4 text-indigo-500" />} title="Timeframe Confluence">
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-6">
                <TrendArrow trend={sections.confluenceScore.m15Trend} label="M15" />
                <TrendArrow trend={sections.confluenceScore.h1Trend} label="H1" />
                <TrendArrow trend={sections.confluenceScore.h4Trend} label="H4" />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GlossaryTerm term="confluence">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs capitalize",
                        sections.confluenceScore.alignment === "strong" && "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
                        sections.confluenceScore.alignment === "moderate" && "bg-blue-500/15 text-blue-600 border-blue-500/30",
                        sections.confluenceScore.alignment === "weak" && "bg-amber-500/15 text-amber-600 border-amber-500/30",
                        sections.confluenceScore.alignment === "conflicting" && "bg-red-500/15 text-red-600 border-red-500/30",
                      )}
                    >
                      {sections.confluenceScore.alignment} alignment
                    </Badge>
                  </GlossaryTerm>
                  <span className="text-xs text-muted-foreground font-medium tabular-nums">
                    {sections.confluenceScore.score}/10
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{sections.confluenceScore.explanation}</p>
            </div>
          </Section>
          <Separator />
        </>
      )}

      {/* Entry Quality */}
      {sections.entryQuality && (
        <>
          <Section icon={<Crosshair className="size-4 text-cyan-500" />} title="Entry Quality">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex items-center justify-center size-10 rounded-lg text-sm font-bold",
                  sections.entryQuality.score >= 7 && "bg-emerald-500/15 text-emerald-600",
                  sections.entryQuality.score >= 4 && sections.entryQuality.score < 7 && "bg-amber-500/15 text-amber-600",
                  sections.entryQuality.score < 4 && "bg-red-500/15 text-red-600",
                )}>
                  {sections.entryQuality.score}/10
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {sections.entryQuality.levelType && (
                      <span className="rounded bg-muted px-1.5 py-0.5">{sections.entryQuality.levelType}</span>
                    )}
                    {sections.entryQuality.distanceFromKey && (
                      <span className="rounded bg-muted px-1.5 py-0.5">{sections.entryQuality.distanceFromKey}</span>
                    )}
                  </div>
                  {sections.entryQuality.timingNote && (
                    <p className="text-xs text-muted-foreground">{sections.entryQuality.timingNote}</p>
                  )}
                </div>
              </div>
              {sections.entryQuality.improvements && (
                <p className="text-xs italic text-muted-foreground border-l-2 pl-2">
                  {sections.entryQuality.improvements}
                </p>
              )}
            </div>
          </Section>
          <Separator />
        </>
      )}

      {/* Technical Analysis */}
      {sections.technical && (
        <>
          <Section icon={<TrendingUp className="size-4 text-primary" />} title="Price Action">
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-muted p-2">
                  <span className="text-muted-foreground block"><GlossaryTerm term="trend">Trend</GlossaryTerm></span>
                  <span className="font-medium">{sections.technical.trend ?? "—"}</span>
                </div>
                <div className="rounded-md bg-muted p-2">
                  <span className="text-muted-foreground block">Momentum</span>
                  <span className="font-medium">{sections.technical.momentum ?? "—"}</span>
                </div>
              </div>
              {sections.technical.indicators && (
                <p className="text-xs text-muted-foreground">{sections.technical.indicators}</p>
              )}
              {sections.technical.candlePatterns && (
                <p className="text-xs italic text-muted-foreground">
                  <GlossaryTerm term="candlestick">{sections.technical.candlePatterns}</GlossaryTerm>
                </p>
              )}
              {(sections.technical.keyLevels?.length ?? 0) > 0 && (
                <KeyLevels levels={sections.technical.keyLevels} />
              )}
              {sections.technical.educational && (
                <EducationalPanel content={sections.technical.educational} />
              )}
            </div>
          </Section>
          <Separator />
        </>
      )}


      {/* Risk Assessment */}
      {sections.risk && (
        <>
          <Separator />
          <Section icon={<AlertTriangle className="size-4 text-amber-500" />} title="Risk Check">
            <div className="space-y-2">
              {sections.risk.riskRewardAnalysis && (
                <p className="text-xs text-muted-foreground">
                  <GlossaryTerm term="risk reward">{sections.risk.riskRewardAnalysis}</GlossaryTerm>
                </p>
              )}
              {(sections.risk.factors?.length ?? 0) > 0 && (
                <ul className="space-y-1">
                  {sections.risk.factors.map((factor, i) => (
                    <li key={i} className="text-xs flex items-start gap-1.5">
                      <span className="text-amber-500 mt-0.5">•</span>
                      {factor}
                    </li>
                  ))}
                </ul>
              )}
              {sections.risk.positionSizingComment && (
                <p className="text-xs italic text-muted-foreground border-l-2 pl-2">
                  <GlossaryTerm term="position size">{sections.risk.positionSizingComment}</GlossaryTerm>
                </p>
              )}
              {sections.risk.educational && (
                <EducationalPanel content={sections.risk.educational} />
              )}
            </div>
          </Section>
        </>
      )}

      {/* Portfolio Risk */}
      {sections.portfolioRisk && (
        <>
          <Separator />
          <Section icon={<ShieldAlert className="size-4 text-orange-500" />} title="Portfolio Risk">
            <div className="space-y-2">
              {sections.portfolioRisk.correlatedExposure && (
                <div className="flex items-start gap-1.5 text-xs rounded-md bg-orange-500/5 border border-orange-500/20 p-2">
                  <AlertTriangle className="size-3 text-orange-500 mt-0.5 shrink-0" />
                  <span>
                    <GlossaryTerm term="correlation">{sections.portfolioRisk.correlatedExposure}</GlossaryTerm>
                  </span>
                </div>
              )}
              <div className="grid grid-cols-1 gap-2 text-xs">
                <div className="rounded-md bg-muted p-2 flex items-center justify-between">
                  <span className="text-muted-foreground">Total Risk</span>
                  <span className="font-medium">{sections.portfolioRisk.totalRiskPercent}</span>
                </div>
              </div>
              {sections.portfolioRisk.concentrationWarning && (
                <div className="flex items-start gap-1.5 text-xs rounded-md bg-amber-500/5 border border-amber-500/20 p-2">
                  <AlertTriangle className="size-3 text-amber-500 mt-0.5 shrink-0" />
                  <span>{sections.portfolioRisk.concentrationWarning}</span>
                </div>
              )}
            </div>
          </Section>
        </>
      )}

      {/* Market Context */}
      {sections.marketContext && (
        <>
          <Separator />
          <Section icon={<Newspaper className="size-4 text-blue-500" />} title="What's Happening">
            <div className="space-y-2">
              {sections.marketContext.volatility && (
                <p className="text-xs text-muted-foreground">
                  <GlossaryTerm term="atr">{sections.marketContext.volatility}</GlossaryTerm>
                </p>
              )}
              {sections.marketContext.correlations && (
                <p className="text-xs text-muted-foreground">
                  <GlossaryTerm term="correlation">{sections.marketContext.correlations}</GlossaryTerm>
                </p>
              )}
              {(sections.marketContext.newsEvents?.length ?? 0) > 0 && (
                <div className="space-y-1">
                  <span className="text-xs font-medium">Upcoming Events</span>
                  {sections.marketContext.newsEvents.map((ev, i) => (
                    <div key={i} className="flex items-center justify-between text-xs rounded bg-muted px-2 py-1">
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            "h-4 text-[9px] px-1",
                            ev.impact === "high" && "border-red-500/50 text-red-600",
                            ev.impact === "medium" && "border-amber-500/50 text-amber-600",
                            ev.impact === "low" && "border-muted-foreground/30 text-muted-foreground",
                          )}
                        >
                          {ev.impact}
                        </Badge>
                        <span>{ev.currency}</span>
                        <span className="text-muted-foreground">{ev.title}</span>
                      </div>
                      <span className="text-muted-foreground">{new Date(ev.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  ))}
                </div>
              )}
              {sections.marketContext.educational && (
                <EducationalPanel content={sections.marketContext.educational} />
              )}
            </div>
          </Section>
        </>
      )}

      {/* Trade History */}
      {sections.tradeHistory && (
        <>
          <Separator />
          <Section icon={<History className="size-4 text-purple-500" />} title="How This Pair Usually Behaves">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md bg-muted p-2">
                <span className="text-muted-foreground block"><GlossaryTerm term="win rate">Win Rate</GlossaryTerm></span>
                <span className="font-medium">{sections.tradeHistory.pairWinRate ?? "—"}</span>
              </div>
              <div className="rounded-md bg-muted p-2">
                <span className="text-muted-foreground block"><GlossaryTerm term="risk reward">Avg R:R</GlossaryTerm></span>
                <span className="font-medium">{sections.tradeHistory.averageRR ?? "—"}</span>
              </div>
            </div>
            {sections.tradeHistory.recentPerformance && (
              <p className="text-xs text-muted-foreground">{sections.tradeHistory.recentPerformance}</p>
            )}
            {sections.tradeHistory.commonPatterns && (
              <p className="text-xs italic text-muted-foreground">{sections.tradeHistory.commonPatterns}</p>
            )}
            {sections.tradeHistory.educational && (
              <EducationalPanel content={sections.tradeHistory.educational} />
            )}
          </Section>
        </>
      )}

      {/* Recommendations */}
      {(sections.recommendations?.length ?? 0) > 0 && (
        <>
          <Section icon={<Lightbulb className="size-4 text-yellow-500" />} title="What To Consider">
            <ul className="space-y-1">
              {sections.recommendations.map((rec, i) => (
                <li key={i} className="text-xs flex items-start gap-1.5">
                  <CheckCircle2 className="size-3 text-emerald-500 mt-0.5 shrink-0" />
                  {rec}
                </li>
              ))}
            </ul>
          </Section>
          <Separator />
        </>
      )}

      {/* Post-mortem (for closed trades) */}
      {sections.postMortem && (
        <>
          <Section icon={<Target className="size-4 text-muted-foreground" />} title="Trade Review">
            <p className="text-xs text-muted-foreground leading-relaxed">{sections.postMortem}</p>
          </Section>
          <Separator />
        </>
      )}
    </div>
  )
}
