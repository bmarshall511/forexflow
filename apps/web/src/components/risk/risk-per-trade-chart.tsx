"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { SectionCard } from "@/components/ui/section-card"
import { BarChart3 } from "lucide-react"
import { formatInstrument } from "@fxflow/shared"

interface TradeRiskEntry {
  tradeId: string
  instrument: string
  riskPercent: number
  outcome: "win" | "loss" | "breakeven"
}

interface RiskPerTradeChartProps {
  targetRisk: number
}

export function RiskPerTradeChart({ targetRisk }: RiskPerTradeChartProps) {
  const [trades, setTrades] = useState<TradeRiskEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/trades?status=closed&limit=20&sort=closedAt&order=desc")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!json?.ok) return
        const data = json.data as {
          trades: Array<{
            id: string
            instrument: string
            entryPrice: number
            stopLoss: number | null
            units: number
            outcome: "win" | "loss" | "breakeven"
          }>
        }
        // Approximate risk% from SL distance (we don't have account balance at trade time)
        // Show the SL distance in pips as a proxy bar
        const entries: TradeRiskEntry[] = data.trades
          .map((t) => {
            if (!t.stopLoss) return null
            const slDist = Math.abs(t.entryPrice - t.stopLoss)
            // Rough risk proxy: units * slDist / entryPrice * 100
            const riskProxy = (Math.abs(t.units) * slDist) / Math.max(t.entryPrice, 0.001)
            return {
              tradeId: t.id,
              instrument: t.instrument,
              riskPercent: Math.min(riskProxy, 10), // Cap display at 10%
              outcome: t.outcome,
            }
          })
          .filter((e): e is TradeRiskEntry => e !== null)
          .reverse() // Oldest first for left-to-right
        setTrades(entries)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const maxRisk = Math.max(targetRisk * 2, ...trades.map((t) => t.riskPercent), 3)

  if (loading) {
    return (
      <SectionCard icon={BarChart3} title="Risk Per Trade (Last 20)">
        <div className="flex h-32 items-center justify-center">
          <p className="text-muted-foreground text-xs">Loading...</p>
        </div>
      </SectionCard>
    )
  }

  if (trades.length === 0) {
    return (
      <SectionCard icon={BarChart3} title="Risk Per Trade (Last 20)">
        <p className="text-muted-foreground py-6 text-center text-xs">
          No closed trades with stop loss data
        </p>
      </SectionCard>
    )
  }

  return (
    <SectionCard icon={BarChart3} title="Risk Per Trade (Last 20)">
      <div className="space-y-2">
        {/* Chart area */}
        <div className="relative">
          {/* Target risk line */}
          <div
            className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-amber-500/60"
            style={{ bottom: `${(targetRisk / maxRisk) * 100}%` }}
          >
            <span className="absolute -top-3 right-0 text-[9px] font-medium text-amber-500">
              Target {targetRisk.toFixed(1)}%
            </span>
          </div>

          {/* Bars */}
          <div className="flex h-32 items-end gap-0.5">
            {trades.map((trade) => {
              const height = (trade.riskPercent / maxRisk) * 100
              const exceeded = trade.riskPercent > targetRisk
              return (
                <div
                  key={trade.tradeId}
                  className="group relative flex flex-1 flex-col items-center justify-end"
                  style={{ height: "100%" }}
                >
                  <div
                    className={cn(
                      "w-full min-w-[4px] rounded-t-sm transition-all",
                      exceeded ? "bg-red-500/80" : "bg-blue-500/60",
                    )}
                    style={{ height: `${Math.max(height, 2)}%` }}
                  />
                  {/* Tooltip on hover */}
                  <div className="border-border bg-popover pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 rounded border px-1.5 py-1 text-[9px] shadow-md group-hover:block">
                    <p className="font-medium">{formatInstrument(trade.instrument)}</p>
                    <p className="font-mono tabular-nums">{trade.riskPercent.toFixed(2)}%</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="text-muted-foreground flex items-center justify-center gap-4 text-[10px]">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-sm bg-blue-500/60" />
            Within target
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-sm bg-red-500/80" />
            Exceeded target
          </span>
        </div>
      </div>
    </SectionCard>
  )
}
