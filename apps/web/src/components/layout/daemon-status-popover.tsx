"use client"

import type { DaemonStatusSnapshot } from "@fxflow/types"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface DaemonStatusPopoverProps {
  snapshot: DaemonStatusSnapshot | null
  isConnected: boolean
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60

  const parts: string[] = []
  if (d > 0) parts.push(`${d}d`)
  if (h > 0) parts.push(`${h}h`)
  if (m > 0) parts.push(`${m}m`)
  if (parts.length === 0) parts.push(`${s}s`)
  return parts.join(" ")
}

function formatStartedAt(isoString: string): string {
  return new Date(isoString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  })
}

export function DaemonStatusPopover({ snapshot, isConnected }: DaemonStatusPopoverProps) {
  if (!isConnected || !snapshot) {
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-semibold">Daemon Service</h4>
        <p className="text-xs text-muted-foreground">
          Daemon not connected. Ensure the daemon process is running on the configured port.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", "bg-status-connected")} aria-hidden="true" />
          <h4 className="text-sm font-semibold">Daemon Service</h4>
        </div>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-status-connected">
          Connected
        </Badge>
      </div>

      {/* Details */}
      <div className="space-y-1.5 border-t border-border pt-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">WebSocket</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-status-connected">{"\u2713"}</span>
            <span>Connected</span>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Trading Mode</span>
          <span className="font-medium capitalize">{snapshot.tradingMode}</span>
        </div>
      </div>

      {/* Uptime */}
      <div className="space-y-1.5 border-t border-border pt-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Process
        </span>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Uptime</span>
            <span className="font-mono tabular-nums">{formatUptime(snapshot.uptimeSeconds)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Started</span>
            <span>{formatStartedAt(snapshot.startedAt)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
