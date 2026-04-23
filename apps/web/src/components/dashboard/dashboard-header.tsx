"use client"

import { useTradingMode } from "@/hooks/use-trading-mode"
import { useDashboardPeriod } from "@/hooks/use-dashboard-period"
import {
  ConnectionHealthIndicator,
  PeriodPicker,
  PrivacyToggle,
} from "@/components/dashboard/shared"
import { cn } from "@/lib/utils"

/**
 * Sticky dashboard header — owns period state and exposes it to every
 * card below via `useDashboardPeriod` (it's a hook, not a context, so
 * cards read their own copy; URL + localStorage keep them in sync).
 *
 * Layout:
 *   [ Practice ▾ pill ]   [ today | week | month | year | all · ⚙ ]   [ 👁 ]   [ ● Live ]
 *
 * The active-account pill is visual-only — mode-switching itself remains
 * in the main header's TradingModeToggle. That avoids two toggles on one
 * screen and keeps the redesign's header compact.
 */
const ACCOUNT_LABEL: Record<"practice" | "live", string> = {
  practice: "Practice",
  live: "Live",
}

export function DashboardHeader() {
  const { mode: account } = useTradingMode()
  const { period, mode, setPeriod, setMode } = useDashboardPeriod()

  return (
    <div
      className={cn(
        "bg-background/80 sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b px-4 py-2 backdrop-blur-sm md:px-6",
        "animate-in fade-in duration-300",
      )}
      role="toolbar"
      aria-label="Dashboard controls"
    >
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
          account === "live"
            ? "border-status-connected/30 bg-status-connected/10 text-status-connected"
            : "border-status-warning/30 bg-status-warning/10 text-status-warning",
        )}
        aria-label={`Active account: ${ACCOUNT_LABEL[account]}`}
      >
        <span
          className={cn(
            "size-1.5 rounded-full",
            account === "live" ? "bg-status-connected" : "bg-status-warning",
          )}
          aria-hidden="true"
        />
        {ACCOUNT_LABEL[account]}
      </span>

      <div className="flex-1" />

      <PeriodPicker period={period} mode={mode} onPeriodChange={setPeriod} onModeChange={setMode} />

      <PrivacyToggle />
      <ConnectionHealthIndicator className="pl-1" />
    </div>
  )
}
