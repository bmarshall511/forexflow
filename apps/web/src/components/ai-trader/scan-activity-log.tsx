"use client"

import { useRef, useEffect, useState } from "react"
import type { AiTraderScanLogEntry } from "@fxflow/types"
import { cn } from "@/lib/utils"
import {
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap,
  TrendingUp,
  ShieldAlert,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { ScanLogEntryDetail } from "./scan-log-entry-detail"

interface ScanActivityLogProps {
  entries: AiTraderScanLogEntry[]
}

interface EntryStyle {
  icon: React.ReactNode
  color: string
  label: string
}

const BASE_STYLE: Record<string, { icon: React.ReactNode; color: string }> = {
  scan_start: { icon: <Search className="size-3.5" />, color: "text-blue-500" },
  scan_complete: { icon: <CheckCircle2 className="size-3.5" />, color: "text-emerald-500" },
  scan_skip: { icon: <AlertTriangle className="size-3.5" />, color: "text-amber-500" },
  scan_error: { icon: <XCircle className="size-3.5" />, color: "text-red-500" },
  pair_scanned: { icon: <Search className="size-3.5" />, color: "text-muted-foreground" },
  candidate_found: { icon: <Zap className="size-3.5" />, color: "text-amber-500" },
  tier2_pass: { icon: <CheckCircle2 className="size-3.5" />, color: "text-blue-500" },
  tier2_fail: { icon: <XCircle className="size-3.5" />, color: "text-muted-foreground" },
  tier3_pass: { icon: <TrendingUp className="size-3.5" />, color: "text-emerald-500" },
  tier3_fail: { icon: <XCircle className="size-3.5" />, color: "text-red-400" },
  trade_placed: { icon: <ArrowUpRight className="size-3.5" />, color: "text-emerald-500" },
  trade_rejected: { icon: <XCircle className="size-3.5" />, color: "text-red-500" },
  gate_blocked: { icon: <ShieldAlert className="size-3.5" />, color: "text-amber-500" },
}

/** Generate a plain-English summary label based on entry type and metadata */
function getEntryStyle(entry: AiTraderScanLogEntry): EntryStyle {
  const base = BASE_STYLE[entry.type] ?? {
    icon: <Search className="size-3.5" />,
    color: "text-muted-foreground",
  }
  const m = entry.metadata
  const pair = m?.instrument ? String(m.instrument).replace("_", "/") : ""
  const conf = m?.confidence != null ? `${m.confidence}%` : ""
  const dir = m?.direction ? String(m.direction).toUpperCase() : ""

  // Build a rich inline summary from filter diagnostics (pair_scanned entries)
  const filterSummary = (() => {
    if (entry.type !== "pair_scanned" || !m) return ""
    const passed = m.filterPassed ?? m.candidatesFound ?? 0
    const parts: string[] = []
    if (m.filterLowVol) parts.push(`${m.filterLowVol} low volatility`)
    if (m.filterNoSignal) parts.push(`${m.filterNoSignal} no signal`)
    if (m.filterLowConfluence) parts.push(`${m.filterLowConfluence} low confluence`)
    if (m.filterSpread) parts.push(`${m.filterSpread} spread too wide`)
    if (m.filterRR) parts.push(`${m.filterRR} low R:R`)
    if (m.filterHTF) parts.push(`${m.filterHTF} HTF disagreement`)
    if (m.filterRSI) parts.push(`${m.filterRSI} RSI overextended`)
    const filtersText = parts.length > 0 ? ` · Filtered: ${parts.join(", ")}` : ""
    return ` · ${passed} passed${filtersText}`
  })()

  // Build scan_complete pipeline funnel summary
  const funnelSummary = (() => {
    if (entry.type !== "scan_complete" || !m) return ""
    const parts: string[] = []
    if (m.candidatesFound != null) parts.push(`${m.candidatesFound} signals`)
    if (m.candidatesAnalyzed != null) parts.push(`${m.candidatesAnalyzed} sent to AI`)
    if (m.tier2Passed != null) parts.push(`${m.tier2Passed} passed Tier 2`)
    if (m.tier3Passed != null) parts.push(`${m.tier3Passed} passed Tier 3`)
    if (m.tradesPlaced != null) parts.push(`${m.tradesPlaced} placed`)
    return parts.length > 0 ? ` — ${parts.join(" → ")}` : ""
  })()

  const profile = m?.profile ? ` (${String(m.profile)})` : ""
  const reason = m?.reason || entry.detail
  const rr = m?.riskRewardRatio != null ? ` · ${Number(m.riskRewardRatio).toFixed(1)}:1 R:R` : ""

  const labels: Record<string, string> = {
    scan_start: "Starting market scan...",
    scan_complete: `Scan finished — ${m?.pairsScanned ?? "?"} pairs checked${funnelSummary}`,
    scan_skip: entry.message || "Scan skipped — conditions not met",
    scan_error: entry.message || "Scan error — something went wrong",
    pair_scanned: `Scanned ${m?.pairsScanned ?? "?"} pairs, found ${m?.candidatesFound ?? 0} Tier 1 signals${filterSummary}`,
    candidate_found: `${pair}${profile}: ${conf} confident ${dir}${rr}`,
    tier2_pass: `${pair} passed quick screening — ${conf} confident ${dir}`,
    tier2_fail: `${pair} rejected by quick screening${reason ? ` — ${reason}` : ""}`,
    tier3_pass: `${pair} approved by deep analysis — ${conf} confident ${dir}${rr}`,
    tier3_fail: `${pair} rejected by deep analysis${reason ? ` — ${reason}` : ""}`,
    trade_placed: `Placed ${dir} on ${pair}${m?.entryPrice ? ` @ ${m.entryPrice}` : ""}${rr}`,
    trade_rejected: `${pair} placement failed${reason ? ` — ${reason}` : ""}`,
    gate_blocked: `${pair} blocked — ${m?.reason || entry.message || "risk check failed"}`,
  }

  return { ...base, label: labels[entry.type] ?? entry.type }
}

/** Types that show a separator line before them (scan cycle boundaries) */
const CYCLE_START_TYPES = new Set(["scan_start"])

/** Types that have expandable detail */
const EXPANDABLE_TYPES = new Set([
  "scan_complete",
  "candidate_found",
  "tier2_pass",
  "tier2_fail",
  "tier3_pass",
  "tier3_fail",
  "trade_placed",
  "trade_rejected",
  "gate_blocked",
  "pair_scanned",
  "scan_error",
  "scan_skip",
])

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  })
}

export function ScanActivityLog({ entries }: ScanActivityLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [entries.length])

  if (entries.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center text-sm">
        No activity yet. Events will appear here once the scanner runs.
      </div>
    )
  }

  const displayed = [...entries].reverse()
  const hasDetail = (e: AiTraderScanLogEntry) =>
    EXPANDABLE_TYPES.has(e.type) && (e.metadata != null || e.detail != null)

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div
      ref={scrollRef}
      className="border-border/50 bg-card max-h-[480px] overflow-y-auto rounded-lg border"
    >
      {displayed.map((entry, idx) => {
        const style = getEntryStyle(entry)
        const isExpanded = expanded.has(entry.id)
        const canExpand = hasDetail(entry)
        const showSeparator = idx > 0 && CYCLE_START_TYPES.has(entry.type)

        return (
          <div key={entry.id}>
            {showSeparator && (
              <div className="flex items-center gap-2 px-3 py-1.5">
                <div className="bg-border h-px flex-1" />
                <span className="text-muted-foreground/60 text-[10px] uppercase tracking-wider">
                  New Scan
                </span>
                <div className="bg-border h-px flex-1" />
              </div>
            )}
            <button
              type="button"
              className={cn(
                "flex w-full items-start gap-2.5 px-3 py-2.5 text-left text-xs transition-colors",
                canExpand && "hover:bg-muted/50 cursor-pointer",
                !canExpand && "cursor-default",
                isExpanded && "bg-muted/30",
              )}
              onClick={() => canExpand && toggle(entry.id)}
              aria-expanded={canExpand ? isExpanded : undefined}
              disabled={!canExpand}
              tabIndex={canExpand ? 0 : -1}
            >
              <span className={cn("mt-0.5 shrink-0", style.color)}>{style.icon}</span>
              <div className="min-w-0 flex-1">
                <p className={cn("font-medium leading-snug", style.color)}>{style.label}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="text-muted-foreground text-[10px] tabular-nums">
                  {formatTime(entry.timestamp)}
                </span>
                {canExpand &&
                  (isExpanded ? (
                    <ChevronDown className="text-muted-foreground size-3" />
                  ) : (
                    <ChevronRight className="text-muted-foreground size-3" />
                  ))}
              </div>
            </button>
            {isExpanded && (
              <div className="px-3 pb-3 pl-9">
                <div className="border-border/40 bg-muted/20 rounded-md border p-3">
                  <ScanLogEntryDetail entry={entry} />
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
