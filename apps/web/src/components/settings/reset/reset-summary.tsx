"use client"

import { AlertTriangle } from "lucide-react"
import type { ResetModule, PreflightStatus } from "@fxflow/db"
import { Button } from "@/components/ui/button"
import type { ResetLevel } from "./reset-level-selector"

const MODULE_LABELS: Record<ResetModule, string> = {
  trading_history: "Trading History",
  tv_alerts: "TradingView Alerts",
  ai_analysis: "AI Analysis",
  ai_trader: "AI Trader",
  trade_finder: "Trade Finder",
  smart_flow: "SmartFlow",
  technical_data: "Technical Data",
  notifications: "Notifications",
  chart_state: "Chart State",
}

interface ResetSummaryProps {
  level: ResetLevel
  selectedModules: ResetModule[]
  preflight: PreflightStatus
  onNext: () => void
  onBack: () => void
}

export function ResetSummary({
  level,
  selectedModules,
  preflight,
  onNext,
  onBack,
}: ResetSummaryProps) {
  const modulesToShow =
    level === "selective" ? selectedModules : (Object.keys(preflight.moduleCounts) as ResetModule[])

  const totalRecords = modulesToShow.reduce(
    (sum, mod) => sum + (preflight.moduleCounts[mod] ?? 0),
    0,
  )

  const isDestructive = level === "factory" || level === "fresh_install"

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Reset Summary</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Review what will be deleted before proceeding.
        </p>
      </div>

      {isDestructive && (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-500" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-red-400">
              {level === "fresh_install"
                ? "The database file will be permanently deleted."
                : "All data AND settings will be permanently deleted."}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">This action cannot be undone.</p>
          </div>
        </div>
      )}

      <div className="space-y-1 rounded-lg border p-3">
        {modulesToShow.map((mod) => {
          const count = preflight.moduleCounts[mod] ?? 0
          return (
            <div key={mod} className="flex items-center justify-between py-1.5 text-sm">
              <span>{MODULE_LABELS[mod]}</span>
              <span className="text-muted-foreground tabular-nums">
                {count.toLocaleString()} records
              </span>
            </div>
          )
        })}
        {level === "factory" && (
          <div className="mt-1.5 border-t pt-1.5">
            <div className="flex items-center justify-between py-1.5 text-sm">
              <span className="text-red-400">Settings and Configurations</span>
              <span className="text-muted-foreground">All</span>
            </div>
          </div>
        )}
        <div className="mt-2 border-t pt-2">
          <div className="flex items-center justify-between text-sm font-medium">
            <span>Total</span>
            <span className="tabular-nums">{totalRecords.toLocaleString()} records</span>
          </div>
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button variant="destructive" onClick={onNext}>
          Continue
        </Button>
      </div>
    </div>
  )
}
