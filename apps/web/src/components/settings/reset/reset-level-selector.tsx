"use client"

import { AlertTriangle, Trash2, RotateCcw, Skull } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

export type ResetLevel = "selective" | "trading_data" | "factory" | "fresh_install"

interface LevelOption {
  level: ResetLevel
  title: string
  description: string
  icon: LucideIcon
  risk: "low" | "medium" | "high" | "critical"
  borderClass: string
}

const LEVEL_OPTIONS: LevelOption[] = [
  {
    level: "selective",
    title: "Selective Reset",
    description: "Choose specific data modules to clear while keeping everything else intact.",
    icon: RotateCcw,
    risk: "low",
    borderClass: "border-amber-500/50 hover:border-amber-500",
  },
  {
    level: "trading_data",
    title: "Trading Data Reset",
    description:
      "Clear all trading data including history, signals, and analyses. Settings are preserved.",
    icon: Trash2,
    risk: "medium",
    borderClass: "border-orange-500/50 hover:border-orange-500",
  },
  {
    level: "factory",
    title: "Factory Reset",
    description: "Clear everything including settings. Returns the app to its initial state.",
    icon: AlertTriangle,
    risk: "high",
    borderClass: "border-red-500/50 hover:border-red-500",
  },
  {
    level: "fresh_install",
    title: "Fresh Install",
    description: "Delete the database file entirely. The app will recreate it on next start.",
    icon: Skull,
    risk: "critical",
    borderClass: "border-red-600/50 hover:border-red-600",
  },
]

const RISK_BADGE: Record<LevelOption["risk"], { label: string; className: string }> = {
  low: { label: "Low Risk", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  medium: {
    label: "Medium Risk",
    className: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  },
  high: { label: "High Risk", className: "bg-red-500/15 text-red-400 border-red-500/30" },
  critical: { label: "Critical", className: "bg-red-600/15 text-red-300 border-red-600/30" },
}

interface ResetLevelSelectorProps {
  onSelect: (level: ResetLevel) => void
}

export function ResetLevelSelector({ onSelect }: ResetLevelSelectorProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Choose Reset Level</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Select how much data you want to clear from the application.
        </p>
      </div>

      <div className="space-y-3">
        {LEVEL_OPTIONS.map((option) => {
          const badge = RISK_BADGE[option.risk]
          return (
            <Card
              key={option.level}
              className={cn("cursor-pointer transition-colors", option.borderClass)}
              role="button"
              tabIndex={0}
              aria-label={`${option.title} — ${badge.label}`}
              onClick={() => onSelect(option.level)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  onSelect(option.level)
                }
              }}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
                  <option.icon className="text-muted-foreground size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{option.title}</span>
                    <Badge variant="outline" className={badge.className}>
                      {badge.label}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">{option.description}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
