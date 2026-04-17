"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import type { AiTraderOpportunityData } from "@fxflow/types"
import {
  Brain,
  ShieldAlert,
  Filter,
  Target,
  Clock,
  Gauge,
  Coins,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  BookOpen,
  MessageSquare,
  Scale,
  Lightbulb,
} from "lucide-react"

// ─── Parse tier responses ─────────────────────────────────────────────────────

interface Tier2Parsed {
  pass: boolean
  confidence: number
  reason: string
}

interface Tier3Parsed {
  execute: boolean
  confidence: number
  entryRationale?: string
  riskAssessment?: string
  managementPlan?: string
  scores?: Record<string, number>
}

function tryParseJSON<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    // Try extracting JSON from markdown fences
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return JSON.parse(match[0]) as T
      } catch {
        return null
      }
    }
    return null
  }
}

// ─── Detail row ──────────────────────────────────────────────────────────────

function DetailRow({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon: React.ElementType
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex gap-2", className)}>
      <Icon className="text-muted-foreground mt-0.5 size-3 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
          {label}
        </p>
        <div className="text-xs leading-relaxed">{children}</div>
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

interface Props {
  opportunity: AiTraderOpportunityData
}

export function OpportunityDecisionDetail({ opportunity: opp }: Props) {
  const tier2 = useMemo(() => tryParseJSON<Tier2Parsed>(opp.tier2Response), [opp.tier2Response])
  const tier3 = useMemo(() => tryParseJSON<Tier3Parsed>(opp.tier3Response), [opp.tier3Response])

  const isRejected = opp.status === "rejected" || opp.status === "skipped"
  const totalCost = opp.tier2Cost + opp.tier3Cost + (opp.debateCost ?? 0)
  const hasDebate = opp.bullCase || opp.bearCase
  const hasBriefs = opp.technicalBrief || opp.macroRiskBrief
  const hasAnyDetail =
    tier2 || tier3 || opp.entryRationale || opp.regime || opp.primaryTechnique || hasDebate

  if (!hasAnyDetail) return null

  return (
    <div className="space-y-3">
      {/* Rejection reason banner */}
      {isRejected && (tier2?.reason || opp.entryRationale) && (
        <div className="flex items-start gap-2 rounded-md border border-red-500/20 bg-red-500/5 p-2.5">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-red-500" />
          <div>
            <p className="text-xs font-medium text-red-600 dark:text-red-400">
              {opp.status === "skipped" ? "Blocked by risk gate" : "Rejected by AI"}
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
              {tier3
                ? tier3.entryRationale || tier3.riskAssessment
                : tier2?.reason || opp.entryRationale}
            </p>
          </div>
        </div>
      )}

      {/* Context row: regime, session, technique */}
      {(opp.regime || opp.session || opp.primaryTechnique) && (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {opp.regime && (
            <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
              <Gauge className="size-2.5" />
              {opp.regime.replace(/_/g, " ")}
            </span>
          )}
          {opp.session && (
            <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
              <Clock className="size-2.5" />
              {opp.session.replace(/_/g, " ")}
            </span>
          )}
          {opp.primaryTechnique && (
            <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
              <TrendingUp className="size-2.5" />
              {opp.primaryTechnique.replace(/_/g, " ")}
            </span>
          )}
        </div>
      )}

      {/* Tier 2 reasoning */}
      {tier2 && (
        <DetailRow
          icon={Filter}
          label={`Tier 2 — ${tier2.pass ? "Passed" : "Rejected"} (${tier2.confidence}%)`}
        >
          <p className="text-muted-foreground">{tier2.reason}</p>
        </DetailRow>
      )}

      {/* Tier 3 reasoning */}
      {tier3 && (
        <div className="space-y-2">
          {tier3.entryRationale && !isRejected && (
            <DetailRow
              icon={Brain}
              label={`Tier 3 — ${tier3.execute ? "Execute" : "No trade"} (${tier3.confidence}%)`}
            >
              <p className="text-muted-foreground">{tier3.entryRationale}</p>
            </DetailRow>
          )}
          {tier3.riskAssessment && (
            <DetailRow icon={ShieldAlert} label="Risk assessment">
              <p className="text-muted-foreground">{tier3.riskAssessment}</p>
            </DetailRow>
          )}
          {tier3.managementPlan && opp.status !== "rejected" && (
            <DetailRow icon={Target} label="Management plan">
              <p className="text-muted-foreground">{tier3.managementPlan}</p>
            </DetailRow>
          )}
        </div>
      )}

      {/* Analyst briefs (multi-agent) */}
      {hasBriefs && (
        <DetailRow icon={BookOpen} label="Analyst Briefs">
          <div className="space-y-1.5">
            {opp.technicalBrief && (
              <div>
                <p className="text-muted-foreground text-[10px] font-medium">Technical</p>
                <p className="text-muted-foreground">{opp.technicalBrief}</p>
              </div>
            )}
            {opp.macroRiskBrief && (
              <div>
                <p className="text-muted-foreground text-[10px] font-medium">Macro / Risk</p>
                <p className="text-muted-foreground">{opp.macroRiskBrief}</p>
              </div>
            )}
          </div>
        </DetailRow>
      )}

      {/* Bull/bear debate (multi-agent) */}
      {hasDebate && (
        <DetailRow icon={Scale} label="Bull / Bear Debate">
          <div className="space-y-2">
            {opp.bullCase && (
              <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-2">
                <p className="mb-0.5 flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="size-2.5" />
                  Bull Case
                </p>
                <p className="text-muted-foreground text-xs leading-relaxed">{opp.bullCase}</p>
              </div>
            )}
            {opp.bearCase && (
              <div className="rounded-md border border-red-500/20 bg-red-500/5 p-2">
                <p className="mb-0.5 flex items-center gap-1 text-[10px] font-medium text-red-600 dark:text-red-400">
                  <TrendingDown className="size-2.5" />
                  Bear Case
                </p>
                <p className="text-muted-foreground text-xs leading-relaxed">{opp.bearCase}</p>
              </div>
            )}
          </div>
        </DetailRow>
      )}

      {/* Cost row */}
      {totalCost > 0 && (
        <div className="text-muted-foreground flex items-center gap-1 text-[10px]">
          <Coins className="size-2.5" />
          <span className="tabular-nums">
            AI cost: ${totalCost.toFixed(4)}
            {opp.tier2Cost > 0 && opp.tier3Cost > 0 && (
              <span>
                {" "}
                (T2: ${opp.tier2Cost.toFixed(4)}
                {(opp.debateCost ?? 0) > 0 && ` + Debate: $${opp.debateCost.toFixed(4)}`} + T3: $
                {opp.tier3Cost.toFixed(4)})
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  )
}
