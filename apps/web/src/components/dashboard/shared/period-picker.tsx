"use client"

import { Check, Settings2 } from "lucide-react"
import type { DashboardPeriod, DashboardPeriodMode } from "@fxflow/shared"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

/**
 * Dashboard period picker — segmented control for the five periods plus an
 * overflow menu for the local/forex boundary mode toggle.
 *
 * Controlled: parent owns state via `useDashboardPeriod()`.
 * Keyboard nav: native button focus + Tab order; the dropdown handles its
 * own arrow-key nav.
 */
interface PeriodPickerProps {
  period: DashboardPeriod
  mode: DashboardPeriodMode
  onPeriodChange: (period: DashboardPeriod) => void
  onModeChange: (mode: DashboardPeriodMode) => void
  className?: string
}

const OPTIONS: { value: DashboardPeriod; label: string; shortLabel: string }[] = [
  { value: "today", label: "Today", shortLabel: "D" },
  { value: "thisWeek", label: "Week", shortLabel: "W" },
  { value: "thisMonth", label: "Month", shortLabel: "M" },
  { value: "thisYear", label: "Year", shortLabel: "Y" },
  { value: "allTime", label: "All time", shortLabel: "All" },
]

export function PeriodPicker({
  period,
  mode,
  onPeriodChange,
  onModeChange,
  className,
}: PeriodPickerProps) {
  return (
    <div
      className={cn("bg-muted/60 inline-flex items-center rounded-full p-0.5", className)}
      role="radiogroup"
      aria-label="Dashboard period"
    >
      {OPTIONS.map((opt) => {
        const selected = opt.value === period
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={selected}
            onClick={() => onPeriodChange(opt.value)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              "focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2",
              selected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="hidden sm:inline">{opt.label}</span>
            <span className="sm:hidden">{opt.shortLabel}</span>
          </button>
        )
      })}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded-full"
            aria-label="Period settings"
          >
            <Settings2 className="size-3.5" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Period boundary</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onModeChange("local")}>
            <Check className={cn("size-4", mode === "local" ? "opacity-100" : "opacity-0")} />
            <div className="flex flex-col">
              <span className="text-sm">Local day</span>
              <span className="text-muted-foreground text-[10px]">
                Your timezone, ISO week (Mon start)
              </span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onModeChange("forex")}>
            <Check className={cn("size-4", mode === "forex" ? "opacity-100" : "opacity-0")} />
            <div className="flex flex-col">
              <span className="text-sm">Forex day</span>
              <span className="text-muted-foreground text-[10px]">
                5 PM ET anchors, Sunday week
              </span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-muted-foreground text-[10px] font-normal">
            Boundary affects today / week / month / year scoping for analytics.
          </DropdownMenuLabel>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
