"use client"

import Link from "next/link"
import { Zap, ArrowRight } from "lucide-react"
import { useSmartFlow } from "@/hooks/use-smart-flow"
import { formatPnL } from "@fxflow/shared"
import { cn } from "@/lib/utils"

export function SmartFlowCard() {
  const { settings, activeTrades, closedTrades, isLoading } = useSmartFlow()

  if (isLoading || !settings) return null

  const enabled = settings.enabled
  const activeCount = activeTrades.length

  // Today's closed P&L from SmartFlow trades. `realizedPL` comes from the
  // joined Trade row; `financingAccumulated` is swap cost, not P&L — summing
  // it instead silently misreported the day's performance.
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayPL = closedTrades
    .filter((t) => t.closedAt && new Date(t.closedAt) >= today)
    .reduce((sum, t) => sum + (t.realizedPL ?? 0), 0)
  const hasTodayPL = todayPL !== 0

  return (
    <Link
      href="/smart-flow"
      className={cn(
        "bg-card border-border/50 group flex items-center gap-3 rounded-xl border p-4 transition-colors",
        "hover:border-border hover:bg-muted/30",
        "animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500",
      )}
      style={{ animationDelay: "250ms" }}
    >
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          enabled ? "bg-amber-500/10 text-amber-500" : "bg-muted text-muted-foreground",
        )}
      >
        <Zap className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">SmartFlow</span>
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              enabled ? "bg-amber-500/15 text-amber-500" : "bg-muted text-muted-foreground",
            )}
          >
            {enabled ? "On" : "Off"}
          </span>
        </div>
        <p className="text-muted-foreground text-xs">
          {activeCount} active trade{activeCount !== 1 ? "s" : ""}
          {hasTodayPL && (
            <span
              className={cn(
                "ml-2 font-medium",
                todayPL >= 0 ? "text-status-connected" : "text-status-disconnected",
              )}
            >
              {formatPnL(todayPL, "USD").formatted} today
            </span>
          )}
        </p>
      </div>
      <ArrowRight className="text-muted-foreground/40 group-hover:text-muted-foreground size-4 transition-colors" />
    </Link>
  )
}
