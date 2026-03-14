"use client"

import { cn } from "@/lib/utils"
import { SectionCard, DetailRow } from "@/components/ui/section-card"
import { Flame } from "lucide-react"
import type { TradeRisk } from "@/hooks/use-risk-dashboard"
import { formatInstrument } from "@fxflow/shared"

interface PortfolioHeatGaugeProps {
  heat: number
  tradeRisks: TradeRisk[]
  currency: string
}

function getHeatZone(heat: number): { label: string; color: string; bgColor: string } {
  if (heat < 2) return { label: "Low Risk", color: "text-emerald-500", bgColor: "bg-emerald-500" }
  if (heat < 5) return { label: "Moderate", color: "text-amber-500", bgColor: "bg-amber-500" }
  return { label: "High Risk", color: "text-red-500", bgColor: "bg-red-500" }
}

export function PortfolioHeatGauge({ heat, tradeRisks, currency }: PortfolioHeatGaugeProps) {
  const zone = getHeatZone(heat)
  const clampedWidth = Math.min(heat, 10) * 10 // Scale to 10% max = 100% bar

  return (
    <SectionCard icon={Flame} title="Portfolio Heat">
      <div className="space-y-4">
        {/* Main gauge value */}
        <div className="flex items-baseline gap-2">
          <span className={cn("font-mono text-2xl font-bold tabular-nums", zone.color)}>
            {heat.toFixed(1)}%
          </span>
          <span className={cn("text-xs font-medium", zone.color)}>{zone.label}</span>
        </div>

        {/* Horizontal bar gauge */}
        <div className="space-y-1.5">
          <div className="bg-muted relative h-3 overflow-hidden rounded-full">
            {/* Zone markers */}
            <div className="absolute inset-y-0 left-[20%] w-px bg-amber-500/30" />
            <div className="absolute inset-y-0 left-[50%] w-px bg-red-500/30" />
            {/* Fill */}
            <div
              className={cn("h-full rounded-full transition-all duration-500", zone.bgColor)}
              style={{ width: `${Math.min(clampedWidth, 100)}%` }}
            />
          </div>
          <div className="text-muted-foreground flex justify-between text-[10px]">
            <span>0%</span>
            <span>2%</span>
            <span>5%</span>
            <span>10%</span>
          </div>
        </div>

        {/* Contributing trades */}
        {tradeRisks.length > 0 && (
          <div className="space-y-0.5">
            <p className="text-muted-foreground mb-1 text-[10px] font-medium uppercase tracking-wider">
              Open Position Risk
            </p>
            {tradeRisks.map((risk) => (
              <DetailRow
                key={risk.tradeId}
                label={`${formatInstrument(risk.instrument)} ${risk.direction.toUpperCase()}`}
                value={
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency,
                      }).format(risk.riskAmount)}
                    </span>
                    <span
                      className={cn(
                        "font-semibold",
                        risk.riskPercent > 2
                          ? "text-red-500"
                          : risk.riskPercent > 1
                            ? "text-amber-500"
                            : "text-emerald-500",
                      )}
                    >
                      {risk.riskPercent.toFixed(1)}%
                    </span>
                  </span>
                }
              />
            ))}
          </div>
        )}

        {tradeRisks.length === 0 && (
          <p className="text-muted-foreground py-2 text-center text-xs">No open positions</p>
        )}
      </div>
    </SectionCard>
  )
}
