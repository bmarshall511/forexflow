"use client"

import type { SmartFlowManagementEntry } from "@fxflow/types"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, Shield, TrendingUp, Scissors, AlertTriangle, Target } from "lucide-react"
import { cn } from "@/lib/utils"

const ACTION_CONFIG: Record<string, { icon: typeof ArrowRight; color: string }> = {
  entry: { icon: ArrowRight, color: "text-blue-500 border-blue-500/20 bg-blue-500/10" },
  breakeven: { icon: Shield, color: "text-amber-500 border-amber-500/20 bg-amber-500/10" },
  trailing: { icon: TrendingUp, color: "text-emerald-500 border-emerald-500/20 bg-emerald-500/10" },
  partial: { icon: Scissors, color: "text-violet-500 border-violet-500/20 bg-violet-500/10" },
  safety_net: {
    icon: AlertTriangle,
    color: "text-orange-500 border-orange-500/20 bg-orange-500/10",
  },
  close: { icon: Target, color: "text-green-500 border-green-500/20 bg-green-500/10" },
}

const SOURCE_STYLES: Record<string, string> = {
  rule: "bg-muted text-muted-foreground",
  ai: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  user: "bg-sky-500/10 text-sky-500 border-sky-500/20",
}

interface TradeTimelineProps {
  entries: SmartFlowManagementEntry[]
}

export function TradeTimeline({ entries }: TradeTimelineProps) {
  if (entries.length === 0) {
    return <p className="text-muted-foreground py-2 text-[10px]">No management actions yet.</p>
  }

  return (
    <div className="relative mt-2 pl-4">
      {/* Vertical connecting line */}
      <div className="bg-border absolute bottom-0 left-[7px] top-0 w-px" />

      <ul className="space-y-2" role="list" aria-label="Trade management timeline">
        {entries.map((entry, i) => {
          const config = ACTION_CONFIG[entry.action] ?? ACTION_CONFIG.entry!
          if (!config) return null
          const Icon = config.icon
          const fmtTime = new Date(entry.at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })

          return (
            <li key={`${entry.at}-${i}`} className="relative flex items-start gap-2.5">
              {/* Timeline dot */}
              <div
                className={cn(
                  "z-10 -ml-4 flex size-4 shrink-0 items-center justify-center rounded-full border",
                  config.color,
                )}
              >
                <Icon className="size-2.5" />
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1 pb-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-foreground/50 font-mono text-[10px]">{fmtTime}</span>
                  <Badge variant="outline" className={cn("px-1 py-0 text-[9px]", config.color)}>
                    {entry.action}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn("px-1 py-0 text-[9px]", SOURCE_STYLES[entry.source])}
                  >
                    {entry.source}
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-0.5 text-[10px]">{entry.detail}</p>
                {entry.priceBid != null && (
                  <span className="text-muted-foreground font-mono text-[10px]">
                    Bid: {entry.priceBid.toFixed(5)}
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
