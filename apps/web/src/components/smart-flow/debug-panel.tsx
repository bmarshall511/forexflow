"use client"

import { useState, useEffect, useCallback } from "react"
import type { SmartFlowHealthData } from "@fxflow/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Bug } from "lucide-react"
import { cn } from "@/lib/utils"

export function DebugPanel() {
  const [open, setOpen] = useState(false)
  const [health, setHealth] = useState<SmartFlowHealthData | null>(null)

  const fetchHealth = useCallback(async () => {
    if (!open) return
    try {
      const res = await fetch("/api/daemon/smart-flow/health")
      if (!res.ok) return
      const json = (await res.json()) as { ok: boolean; data?: SmartFlowHealthData }
      if (json.ok && json.data) setHealth(json.data)
    } catch {
      /* daemon may be down */
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    void fetchHealth()
    const id = setInterval(fetchHealth, 5_000)
    return () => clearInterval(id)
  }, [open, fetchHealth])

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-[10px]">
          <Bug className="size-3" />
          Debug
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {!health ? (
          <p className="text-muted-foreground py-4 text-center text-xs">Loading debug data...</p>
        ) : (
          <div className="mt-3 space-y-4">
            {/* ATR Cache */}
            <DebugSection title="ATR Cache">
              {health.atrCache && health.atrCache.length > 0 ? (
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-muted-foreground text-left">
                      <th className="pb-1 pr-4 font-medium">Instrument</th>
                      <th className="pb-1 pr-4 font-medium">ATR</th>
                      <th className="pb-1 font-medium">Fetched</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {health.atrCache.map((row) => (
                      <tr key={row.instrument}>
                        <td className="py-0.5 pr-4">{row.instrument}</td>
                        <td className="py-0.5 pr-4">{row.atr.toFixed(5)}</td>
                        <td className="py-0.5">{new Date(row.fetchedAt).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-muted-foreground text-[10px]">No ATR data cached.</p>
              )}
            </DebugSection>

            {/* Spread Tracking */}
            <DebugSection title="Spread Tracking">
              {health.spreadCache && health.spreadCache.length > 0 ? (
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-muted-foreground text-left">
                      <th className="pb-1 pr-4 font-medium">Instrument</th>
                      <th className="pb-1 pr-4 font-medium">Current</th>
                      <th className="pb-1 pr-4 font-medium">Avg</th>
                      <th className="pb-1 pr-4 font-medium">Multiple</th>
                      <th className="pb-1 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {health.spreadCache.map((row) => {
                      const status =
                        row.multiple > 3 ? "blocked" : row.multiple > 1.5 ? "elevated" : "normal"
                      return (
                        <tr key={row.instrument}>
                          <td className="py-0.5 pr-4">{row.instrument}</td>
                          <td className="py-0.5 pr-4">{row.current.toFixed(1)}</td>
                          <td className="py-0.5 pr-4">{row.average.toFixed(1)}</td>
                          <td className="py-0.5 pr-4">{row.multiple.toFixed(1)}x</td>
                          <td className="py-0.5">
                            <Badge
                              variant="outline"
                              className={cn(
                                "px-1 py-0 text-[9px]",
                                status === "normal"
                                  ? "text-green-500"
                                  : status === "elevated"
                                    ? "text-amber-500"
                                    : "text-red-500",
                              )}
                            >
                              {status}
                            </Badge>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="text-muted-foreground text-[10px]">No spread data.</p>
              )}
            </DebugSection>

            {/* Tick Stats */}
            <DebugSection title="Tick Stats">
              <p className="font-mono text-[10px]">
                Ticks/sec: <span className="text-foreground">{health.ticksPerSecond}</span>
              </p>
            </DebugSection>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}

function DebugSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-muted-foreground mb-1.5 text-[10px] font-semibold uppercase tracking-wider">
        {title}
      </h4>
      {children}
    </div>
  )
}
