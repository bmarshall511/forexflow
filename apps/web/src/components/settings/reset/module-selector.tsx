"use client"

import { useState } from "react"
import type { ResetModule } from "@fxflow/db"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface ModuleInfo {
  id: ResetModule
  label: string
  description: string
}

const MODULES: ModuleInfo[] = [
  { id: "trading_history", label: "Trading History", description: "Trades, events, and tags" },
  { id: "tv_alerts", label: "TradingView Alerts", description: "Signals and audit events" },
  {
    id: "ai_analysis",
    label: "AI Analysis",
    description: "Analyses, conditions, outcomes, and digests",
  },
  {
    id: "ai_trader",
    label: "EdgeFinder",
    description: "Opportunities, market data, and strategy performance",
  },
  {
    id: "trade_finder",
    label: "Trade Finder",
    description: "Setups, scanner history, and performance stats",
  },
  {
    id: "smart_flow",
    label: "SmartFlow",
    description: "Trades, activity logs, and time estimates",
  },
  {
    id: "technical_data",
    label: "Technical Data",
    description: "Supply/demand zones, trends, and curves",
  },
  { id: "notifications", label: "Notifications", description: "All notification records" },
  { id: "chart_state", label: "Chart State", description: "Saved chart layouts" },
]

interface ModuleSelectorProps {
  moduleCounts: Record<ResetModule, number>
  onNext: (modules: ResetModule[]) => void
  onBack: () => void
}

export function ModuleSelector({ moduleCounts, onNext, onBack }: ModuleSelectorProps) {
  const [selected, setSelected] = useState<Set<ResetModule>>(new Set())

  function toggle(id: ResetModule) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Select Modules</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Choose which data modules to reset. Only selected modules will be cleared.
        </p>
      </div>

      <div className="space-y-2">
        {MODULES.map((mod) => {
          const count = moduleCounts[mod.id] ?? 0
          const isSelected = selected.has(mod.id)
          return (
            <button
              key={mod.id}
              type="button"
              role="checkbox"
              aria-checked={isSelected}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                "hover:bg-accent/50 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2",
                isSelected ? "border-destructive/50 bg-destructive/5" : "border-border",
              )}
              onClick={() => toggle(mod.id)}
            >
              <div
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded border",
                  isSelected
                    ? "border-destructive bg-destructive text-white"
                    : "border-muted-foreground/30",
                )}
                aria-hidden="true"
              >
                {isSelected && (
                  <svg className="size-3" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2 6l3 3 5-5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{mod.label}</span>
                  <Badge variant="secondary" className="text-xs">
                    {count.toLocaleString()} records
                  </Badge>
                </div>
                <p className="text-muted-foreground text-xs">{mod.description}</p>
              </div>
            </button>
          )
        })}
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          variant="destructive"
          disabled={selected.size === 0}
          onClick={() => onNext(Array.from(selected))}
        >
          Next ({selected.size} selected)
        </Button>
      </div>
    </div>
  )
}
