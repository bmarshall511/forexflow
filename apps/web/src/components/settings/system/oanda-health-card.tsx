"use client"

import { Landmark } from "lucide-react"
import { SectionCard, DetailRow } from "@/components/ui/section-card"
import type { OandaHealthData } from "@fxflow/types"

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`inline-block size-2 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`}
        aria-hidden="true"
      />
      {ok ? "Connected" : "Disconnected"}
    </span>
  )
}

function formatTime(iso: string | null): string {
  if (!iso) return "Never"
  const d = new Date(iso)
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

interface OandaHealthCardProps {
  oanda: OandaHealthData | null
}

export function OandaHealthCard({ oanda }: OandaHealthCardProps) {
  if (!oanda) {
    return (
      <SectionCard icon={Landmark} title="OANDA Connection">
        <p className="text-muted-foreground text-xs">No data available</p>
      </SectionCard>
    )
  }

  const isConnected = oanda.status === "connected" || oanda.status === "warning"
  const isUnconfigured = oanda.status === "unconfigured"

  return (
    <SectionCard icon={Landmark} title="OANDA Connection">
      <div className="space-y-0.5">
        <DetailRow
          label="API Status"
          value={
            isUnconfigured ? (
              <span className="text-muted-foreground">Not configured</span>
            ) : (
              <StatusDot ok={isConnected} />
            )
          }
        />
        <DetailRow label="Pricing Stream" value={<StatusDot ok={oanda.streamConnected} />} />
        <DetailRow label="API Reachable" value={<StatusDot ok={oanda.apiReachable} />} />
        <DetailRow label="Account Valid" value={<StatusDot ok={oanda.accountValid} />} />
        <DetailRow label="Last Health Check" value={formatTime(oanda.lastHealthCheck)} />
        <DetailRow label="Trading Mode" value={oanda.tradingMode} />
        {oanda.errorMessage && (
          <p className="pt-1 text-[10px] text-red-400">{oanda.errorMessage}</p>
        )}
      </div>
    </SectionCard>
  )
}
