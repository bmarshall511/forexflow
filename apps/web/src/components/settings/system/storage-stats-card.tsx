"use client"

import { Database } from "lucide-react"
import { SectionCard, DetailRow } from "@/components/ui/section-card"
import type { StorageStats } from "@/hooks/use-system-health"

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

const TABLE_LABELS: { key: keyof Omit<StorageStats, "total">; label: string }[] = [
  { key: "trades", label: "Trades" },
  { key: "signals", label: "TV Alert Signals" },
  { key: "analyses", label: "AI Analyses" },
  { key: "conditions", label: "Trade Conditions" },
  { key: "setups", label: "Trade Finder Setups" },
  { key: "opportunities", label: "AI Trader Opportunities" },
  { key: "notifications", label: "Notifications" },
  { key: "zones", label: "S/D Zones" },
]

interface StorageStatsCardProps {
  storage: StorageStats | null
}

export function StorageStatsCard({ storage }: StorageStatsCardProps) {
  if (!storage) {
    return (
      <SectionCard icon={Database} title="Database Storage">
        <p className="text-muted-foreground text-xs">No data available</p>
      </SectionCard>
    )
  }

  return (
    <SectionCard icon={Database} title="Database Storage">
      <div className="space-y-0.5">
        {TABLE_LABELS.map(({ key, label }) => (
          <DetailRow key={key} label={label} value={formatCount(storage[key])} />
        ))}
        <div className="border-border/50 mt-1 border-t pt-1">
          <DetailRow
            label="Total Records"
            value={formatCount(storage.total)}
            className="font-semibold"
          />
        </div>
      </div>
    </SectionCard>
  )
}
