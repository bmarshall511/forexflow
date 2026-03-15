"use client"

import { useMemo, useState } from "react"
import { SectionCard } from "@/components/ui/section-card"
import { Calculator } from "lucide-react"
import { getPipSize } from "@fxflow/shared"
import { FOREX_PAIR_GROUPS, formatInstrument } from "@fxflow/shared"

interface PositionSizerProps {
  accountBalance: number
  currency: string
}

export function PositionSizer({ accountBalance, currency }: PositionSizerProps) {
  const [instrument, setInstrument] = useState("EUR_USD")
  const [slPips, setSlPips] = useState(20)
  const [riskPercent, setRiskPercent] = useState(1)

  const result = useMemo(() => {
    if (accountBalance <= 0 || slPips <= 0 || riskPercent <= 0) {
      return { units: 0, riskAmount: 0 }
    }
    const riskAmount = (accountBalance * riskPercent) / 100
    const pipSize = getPipSize(instrument)
    // For most pairs, pip value per unit ~ pipSize. For JPY pairs, 1 pip = 0.01 per unit.
    // Simplified: pipValue per standard lot (100k) = pipSize * 100000
    // So per-unit pip value = pipSize
    const pipValuePerUnit = pipSize
    const units = riskAmount / (slPips * pipValuePerUnit)
    return { units: Math.round(units), riskAmount }
  }, [accountBalance, instrument, slPips, riskPercent])

  const fmt = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(v)

  return (
    <SectionCard icon={Calculator} title="Position Sizer">
      <div className="space-y-3">
        {/* Instrument selector */}
        <div className="space-y-1">
          <label htmlFor="ps-instrument" className="text-muted-foreground text-[10px] font-medium">
            Instrument
          </label>
          <select
            id="ps-instrument"
            value={instrument}
            onChange={(e) => setInstrument(e.target.value)}
            className="border-border bg-background text-foreground w-full rounded-md border px-2.5 py-1.5 font-mono text-xs"
          >
            {FOREX_PAIR_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.pairs.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* SL distance */}
        <div className="space-y-1">
          <label htmlFor="ps-sl-pips" className="text-muted-foreground text-[10px] font-medium">
            Stop Loss Distance (pips)
          </label>
          <input
            id="ps-sl-pips"
            type="number"
            min={1}
            max={500}
            step={1}
            value={slPips}
            onChange={(e) => setSlPips(Math.max(1, parseInt(e.target.value) || 1))}
            className="border-border bg-background text-foreground w-full rounded-md border px-2.5 py-1.5 font-mono text-xs tabular-nums"
          />
        </div>

        {/* Risk percentage slider + input */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label htmlFor="ps-risk" className="text-muted-foreground text-[10px] font-medium">
              Risk Per Trade
            </label>
            <span className="font-mono text-xs font-medium tabular-nums">
              {riskPercent.toFixed(1)}%
            </span>
          </div>
          <input
            id="ps-risk"
            type="range"
            min={0.1}
            max={5}
            step={0.1}
            value={riskPercent}
            onChange={(e) => setRiskPercent(parseFloat(e.target.value))}
            className="w-full accent-current"
            aria-label={`Risk percent: ${riskPercent}%`}
          />
          <div className="text-muted-foreground flex justify-between text-[10px]">
            <span>0.1%</span>
            <span>5%</span>
          </div>
        </div>

        {/* Result */}
        <div className="border-border/50 rounded-md border p-3">
          <p className="text-muted-foreground mb-1 text-[10px] font-medium uppercase tracking-wider">
            Calculated Position Size
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-primary font-mono text-xl font-bold tabular-nums">
              {result.units.toLocaleString()}
            </span>
            <span className="text-muted-foreground text-xs">units</span>
          </div>
          <div className="mt-1.5 flex items-center gap-3">
            <span className="text-muted-foreground text-[10px]">
              {formatInstrument(instrument)}
            </span>
            <span className="text-muted-foreground text-[10px]">
              Risk: {fmt(result.riskAmount)}
            </span>
            <span className="text-muted-foreground text-[10px]">SL: {slPips} pips</span>
          </div>
        </div>

        {accountBalance <= 0 && (
          <p className="text-muted-foreground py-1 text-center text-[10px]">
            Connect OANDA account to use position sizer
          </p>
        )}
      </div>
    </SectionCard>
  )
}
