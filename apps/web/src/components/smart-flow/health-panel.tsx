"use client"

import { useState, useEffect, useCallback } from "react"
import type { SmartFlowHealthData } from "@fxflow/types"
import { formatRelativeTime } from "@fxflow/shared"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

export function HealthPanel() {
  const [health, setHealth] = useState<SmartFlowHealthData | null>(null)

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/daemon/smart-flow/health")
      if (!res.ok) return
      const json = (await res.json()) as { ok: boolean; data?: SmartFlowHealthData }
      if (json.ok && json.data) setHealth(json.data)
    } catch {
      /* daemon may be down */
    }
  }, [])

  useEffect(() => {
    void fetchHealth()
    const id = setInterval(fetchHealth, 10_000)
    return () => clearInterval(id)
  }, [fetchHealth])

  if (!health) return null

  const running = health.engineRunning
  const budgetPct =
    health.aiDailyBudget > 0 ? Math.min(100, (health.aiDailySpend / health.aiDailyBudget) * 100) : 0

  return (
    <div className="border-b px-4 py-3 md:px-6">
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[11px] sm:grid-cols-4 lg:grid-cols-7">
        {/* Engine Status */}
        <div className="flex items-center gap-1.5">
          <div className={cn("size-2 rounded-full", running ? "bg-green-500" : "bg-red-500")} />
          <span className="text-muted-foreground">Engine:</span>
          <span className="text-foreground font-medium">{running ? "Running" : "Stopped"}</span>
        </div>

        {/* Instruments */}
        <div className="flex items-center gap-1.5" title={health.subscribedInstruments.join(", ")}>
          <span className="text-muted-foreground">Instruments:</span>
          <span className="text-foreground font-medium">{health.subscribedInstruments.length}</span>
        </div>

        {/* Active Rules */}
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Rules:</span>
          <span className="text-foreground font-medium">{health.activeRuleCount}</span>
        </div>

        {/* Last Action */}
        <div className="flex items-center gap-1.5 truncate">
          <span className="text-muted-foreground">Last:</span>
          <span className="text-foreground truncate font-medium">
            {health.lastManagementActionAt
              ? formatRelativeTime(health.lastManagementActionAt)
              : "--"}
          </span>
        </div>

        {/* Tick Rate */}
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Ticks:</span>
          <span className="text-foreground font-medium">{health.ticksPerSecond}</span>
        </div>

        {/* AI Budget */}
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">AI:</span>
          <Progress value={budgetPct} className="h-1.5 w-16" />
          <span className="text-foreground font-mono text-[10px]">
            ${health.aiDailySpend.toFixed(2)}
          </span>
        </div>

        {/* Priority */}
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Priority:</span>
          <Badge variant="outline" className="px-1 py-0 text-[10px]">
            {health.priorityMode}
          </Badge>
        </div>
      </div>
    </div>
  )
}
