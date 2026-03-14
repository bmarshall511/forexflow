"use client"

import { Server } from "lucide-react"
import { SectionCard, DetailRow } from "@/components/ui/section-card"
import type { DaemonHealth } from "@/hooks/use-system-health"

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

interface DaemonHealthCardProps {
  daemon: DaemonHealth | null
  daemonReachable: boolean
  wsConnected: boolean
}

export function DaemonHealthCard({ daemon, daemonReachable, wsConnected }: DaemonHealthCardProps) {
  const isRunning = daemonReachable && daemon !== null
  const memoryWarning = daemon ? daemon.memory.heapUsed / daemon.memory.heapTotal > 0.85 : false

  return (
    <SectionCard icon={Server} title="Daemon Process">
      <div className="space-y-0.5">
        <DetailRow
          label="Status"
          value={
            <span className="flex items-center gap-1.5">
              <span
                className={`inline-block size-2 rounded-full ${isRunning ? "bg-emerald-500" : "bg-red-500"}`}
                aria-hidden="true"
              />
              {isRunning ? "Running" : "Down"}
            </span>
          }
        />
        <DetailRow
          label="WebSocket"
          value={
            <span className="flex items-center gap-1.5">
              <span
                className={`inline-block size-2 rounded-full ${wsConnected ? "bg-emerald-500" : "bg-red-500"}`}
                aria-hidden="true"
              />
              {wsConnected ? "Connected" : "Disconnected"}
            </span>
          }
        />
        {daemon && (
          <>
            <DetailRow label="Uptime" value={formatUptime(daemon.uptimeSeconds)} />
            <DetailRow
              label="Heap Usage"
              value={`${formatMB(daemon.memory.heapUsed)} / ${formatMB(daemon.memory.heapTotal)}`}
              className={memoryWarning ? "text-amber-400" : undefined}
            />
            <DetailRow label="RSS" value={formatMB(daemon.memory.rss)} />
            <DetailRow label="WS Clients" value={String(daemon.wsClients)} />
          </>
        )}
        {!isRunning && (
          <p className="text-muted-foreground/60 pt-1 text-[10px]">
            Daemon is not reachable. Check that it is running on port 4100.
          </p>
        )}
      </div>
    </SectionCard>
  )
}
