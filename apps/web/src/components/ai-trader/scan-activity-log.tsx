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

const ENTRY_STYLE: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  scan_start: {
    icon: <Search className="size-3.5" />,
    color: "text-blue-500",
    label: "Scan Started",
  },
  scan_complete: {
    icon: <CheckCircle2 className="size-3.5" />,
    color: "text-emerald-500",
    label: "Scan Complete",
  },
  scan_skip: {
    icon: <AlertTriangle className="size-3.5" />,
    color: "text-amber-500",
    label: "Scan Skipped",
  },
  scan_error: {
    icon: <XCircle className="size-3.5" />,
    color: "text-red-500",
    label: "Scan Error",
  },
  pair_scanned: {
    icon: <Search className="size-3.5" />,
    color: "text-muted-foreground",
    label: "Pairs Scanned",
  },
  candidate_found: {
    icon: <Zap className="size-3.5" />,
    color: "text-amber-500",
    label: "Signal Found",
  },
  tier2_pass: {
    icon: <CheckCircle2 className="size-3.5" />,
    color: "text-blue-500",
    label: "AI Quick Check Passed",
  },
  tier2_fail: {
    icon: <XCircle className="size-3.5" />,
    color: "text-muted-foreground",
    label: "AI Quick Check Failed",
  },
  tier3_pass: {
    icon: <TrendingUp className="size-3.5" />,
    color: "text-emerald-500",
    label: "AI Deep Analysis Approved",
  },
  tier3_fail: {
    icon: <XCircle className="size-3.5" />,
    color: "text-red-400",
    label: "AI Deep Analysis Rejected",
  },
  trade_placed: {
    icon: <ArrowUpRight className="size-3.5" />,
    color: "text-emerald-500",
    label: "Trade Placed",
  },
  trade_rejected: {
    icon: <XCircle className="size-3.5" />,
    color: "text-red-500",
    label: "Trade Failed",
  },
  gate_blocked: {
    icon: <ShieldAlert className="size-3.5" />,
    color: "text-amber-500",
    label: "Risk Gate Blocked",
  },
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
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
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
        const style = ENTRY_STYLE[entry.type] ?? {
          icon: <Search className="size-3.5" />,
          color: "text-muted-foreground",
          label: entry.type,
        }
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
                <div className="flex items-center gap-1.5">
                  <span className={cn("font-medium", style.color)}>{style.label}</span>
                  {entry.metadata?.instrument && (
                    <span className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-[10px]">
                      {entry.metadata.instrument.replace("_", "/")}
                    </span>
                  )}
                  {entry.metadata?.confidence != null && (
                    <span className="text-muted-foreground text-[10px]">
                      {entry.metadata.confidence}%
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground mt-0.5">{entry.message}</p>
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
