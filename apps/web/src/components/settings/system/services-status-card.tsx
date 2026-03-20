"use client"

import { Layers } from "lucide-react"
import { SectionCard, DetailRow } from "@/components/ui/section-card"
import type { DaemonHealth } from "@/hooks/use-system-health"
import type { DaemonStatusSnapshot } from "@fxflow/types"

function ServiceStatus({ enabled, label }: { enabled: boolean; label?: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`inline-block size-2 rounded-full ${enabled ? "bg-emerald-500" : "bg-zinc-500"}`}
        aria-hidden="true"
      />
      {label ?? (enabled ? "Enabled" : "Disabled")}
    </span>
  )
}

interface ServicesStatusCardProps {
  daemon: DaemonHealth | null
  snapshot: DaemonStatusSnapshot | null
}

export function ServicesStatusCard({ daemon, snapshot }: ServicesStatusCardProps) {
  const tvEnabled = daemon?.tvAlerts?.enabled ?? false
  const cfConnected = daemon?.tvAlerts?.cfWorkerConnected ?? false
  const tfEnabled = daemon?.tradeFinder?.enabled ?? false
  const aiTraderEnabled = daemon?.aiTrader?.enabled ?? false

  // Try to get AI auto-analysis setting from snapshot or fallback
  const aiAutoEnabled = snapshot?.tvAlerts?.enabled !== undefined

  return (
    <SectionCard icon={Layers} title="Services">
      <div className="space-y-0.5">
        <DetailRow
          label="TV Alerts"
          value={
            <span className="flex items-center gap-2">
              <ServiceStatus enabled={tvEnabled} />
              {tvEnabled && (
                <span className="text-muted-foreground text-[10px]">
                  CF Worker: {cfConnected ? "connected" : "disconnected"}
                </span>
              )}
            </span>
          }
        />
        <DetailRow label="Trade Finder" value={<ServiceStatus enabled={tfEnabled} />} />
        <DetailRow label="EdgeFinder" value={<ServiceStatus enabled={aiTraderEnabled} />} />
        <DetailRow
          label="AI Analysis"
          value={
            <ServiceStatus
              enabled={aiAutoEnabled}
              label={aiAutoEnabled ? "Available" : "Unavailable"}
            />
          }
        />
        <DetailRow
          label="Market Status"
          value={
            <span className="flex items-center gap-1.5">
              <span
                className={`inline-block size-2 rounded-full ${snapshot?.market.isOpen ? "bg-emerald-500" : "bg-amber-500"}`}
                aria-hidden="true"
              />
              {snapshot?.market.isOpen ? "Open" : "Closed"}
            </span>
          }
        />
      </div>
    </SectionCard>
  )
}
