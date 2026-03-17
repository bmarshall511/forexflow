"use client"

import { useState, useEffect, useCallback } from "react"
import type { SourcePriorityLog } from "@/hooks/use-source-priority"
import { formatRelativeTime } from "@fxflow/shared"
import { formatInstrument } from "@fxflow/shared"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Check, Ban, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

const ACTION_CONFIG: Record<string, { icon: typeof Check; color: string; border: string }> = {
  placed: { icon: Check, color: "text-green-500", border: "border-l-green-500" },
  blocked: { icon: Ban, color: "text-amber-500", border: "border-l-amber-500" },
  overridden: { icon: RefreshCw, color: "text-blue-500", border: "border-l-blue-500" },
  queued: { icon: RefreshCw, color: "text-blue-500", border: "border-l-blue-500" },
}

export function PriorityLogPanel() {
  const [logs, setLogs] = useState<SourcePriorityLog[]>([])

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/source-priority/logs")
      if (!res.ok) return
      const json = (await res.json()) as { ok: boolean; data?: SourcePriorityLog[] }
      if (json.ok && json.data) setLogs(json.data)
    } catch {
      /* API may not be ready */
    }
  }, [])

  useEffect(() => {
    void fetchLogs()
    const id = setInterval(fetchLogs, 10_000)
    return () => clearInterval(id)
  }, [fetchLogs])

  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground text-sm">No priority decisions yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-1">
      {logs.map((log) => {
        const config = ACTION_CONFIG[log.action] ?? ACTION_CONFIG.blocked!
        if (!config) return null
        const Icon = config.icon
        return (
          <div
            key={log.id}
            className={cn(
              "hover:bg-muted/50 flex items-start gap-2.5 rounded-md border-l-2 px-3 py-2 transition-colors",
              config.border,
            )}
          >
            <div
              className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full")}
            >
              <Icon className={cn("size-3", config.color)} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium">{formatInstrument(log.instrument)}</span>
                <Badge variant="outline" className={cn("px-1.5 py-0 text-[10px]", config.color)}>
                  {log.action}
                </Badge>
                <span className="text-muted-foreground text-[10px]">{log.winningSource}</span>
              </div>
              <p className="text-muted-foreground mt-0.5 truncate text-[11px]">{log.reason}</p>
            </div>
            <span className="text-muted-foreground mt-0.5 shrink-0 text-[10px]">
              {formatRelativeTime(log.timestamp)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
