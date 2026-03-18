"use client"

import { useState, useEffect, useCallback } from "react"
import type { SmartFlowHealthData } from "@fxflow/types"
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
  const pairs = health.subscribedInstruments.length
  const tps = health.ticksPerSecond

  // Build plain English status
  let statusText: string
  if (!running) {
    statusText = "SmartFlow is stopped"
  } else if (pairs === 0) {
    statusText = "SmartFlow is running — no trade plans active"
  } else {
    const pairNames = health.subscribedInstruments
      .slice(0, 3)
      .map((i) => i.replace("_", "/"))
      .join(", ")
    const extra = pairs > 3 ? ` +${pairs - 3} more` : ""
    statusText = `Watching ${pairNames}${extra} — prices updating ${tps}×/sec`
  }

  return (
    <div className="border-b px-4 py-2 md:px-6">
      <div className="flex items-center gap-2 text-[11px]">
        <span
          className={cn(
            "size-1.5 rounded-full",
            running ? "animate-pulse bg-emerald-500" : "bg-red-500",
          )}
        />
        <span className="text-muted-foreground">{statusText}</span>
        {health.upSince && running && (
          <span className="text-muted-foreground/50 ml-auto">
            Up since{" "}
            {new Date(health.upSince).toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>
    </div>
  )
}
