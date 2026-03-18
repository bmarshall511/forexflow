"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TrendingUp, TrendingDown, Zap, Check, Info, Globe2, Eye } from "lucide-react"
import type { SmartFlowPreset } from "@fxflow/types"
import { PRESET_INFO } from "./trade-builder-presets"

export function StepReview({
  pair,
  direction,
  preset,
  entryMode = "market",
  entryPrice,
  entryExpireHours,
  submitting,
  onSubmit,
}: {
  pair: string
  direction: "long" | "short"
  preset: Exclude<SmartFlowPreset, "custom">
  entryMode?: "market" | "smart_entry"
  entryPrice?: string
  entryExpireHours?: string
  submitting: boolean
  onSubmit: () => void
}) {
  const info = PRESET_INFO[preset]
  const isLong = direction === "long"
  return (
    <div className="space-y-4">
      {/* Summary card */}
      <Card className="overflow-hidden border-2">
        <div
          className="h-1"
          style={{
            background: isLong
              ? "linear-gradient(90deg, rgb(16 185 129), rgb(52 211 153))"
              : "linear-gradient(90deg, rgb(239 68 68), rgb(248 113 113))",
          }}
        />
        <CardContent className="space-y-4 p-5">
          <h3 className="text-center text-base font-semibold">Your Trade Summary</h3>

          {/* Visual pair display */}
          <div className="bg-muted/50 flex items-center justify-center gap-3 rounded-xl py-4">
            <Globe2 className="text-muted-foreground size-6" aria-hidden="true" />
            <span className="text-xl font-bold">{pair}</span>
          </div>

          {/* Direction + strategy row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/50 rounded-xl p-3 text-center">
              <div className="text-muted-foreground mb-1 text-[10px] uppercase tracking-wider">
                Direction
              </div>
              <div className="flex items-center justify-center gap-1.5">
                {isLong ? (
                  <TrendingUp className="size-4" style={{ color: "rgb(16 185 129)" }} />
                ) : (
                  <TrendingDown className="size-4" style={{ color: "rgb(239 68 68)" }} />
                )}
                <Badge variant={isLong ? "default" : "destructive"} className="text-xs">
                  {isLong ? "Buy" : "Sell"}
                </Badge>
              </div>
            </div>
            <div className="bg-muted/50 rounded-xl p-3 text-center">
              <div className="text-muted-foreground mb-1 text-[10px] uppercase tracking-wider">
                Strategy
              </div>
              <div className="flex items-center justify-center gap-1.5">
                <info.icon className="size-4" aria-hidden="true" />
                <span className="text-sm font-semibold">{info.label}</span>
              </div>
            </div>
          </div>

          {/* Entry mode row */}
          <div className="bg-muted/50 flex items-center gap-2 rounded-xl p-3">
            <Eye className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
            <div className="text-xs">
              {entryMode === "market" ? (
                <span>
                  <span className="font-medium">Entry:</span>{" "}
                  <span className="text-foreground/80">Right now at market price</span>
                </span>
              ) : (
                <span>
                  <span className="font-medium">Entry:</span>{" "}
                  <span className="text-foreground/80">
                    Wait for price{entryPrice ? ` → ${entryPrice}` : ""}
                    {entryExpireHours ? ` (expires in ${entryExpireHours}h)` : ""}
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* Risk + hold time */}
          <div className="grid grid-cols-2 gap-3 text-center text-xs">
            <div>
              <span className="text-muted-foreground">Risk: </span>
              <span className={`font-medium ${info.riskColor}`}>{info.risk}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Typical hold: </span>
              <span className="font-medium">{info.holdTime}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* What SmartFlow will do */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <h4 className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
            <Zap className="text-primary size-4" />
            SmartFlow will automatically:
          </h4>
          <ul className="space-y-2" aria-label="SmartFlow protections">
            {info.protections.map((p, i) => (
              <li key={i} className="flex items-start gap-2.5 text-xs">
                <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                <span className="text-foreground/80">{p}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Submit button */}
      <Button
        onClick={onSubmit}
        disabled={submitting}
        size="lg"
        className="animate-subtle-pulse min-h-[52px] w-full gap-2.5 text-base font-semibold"
      >
        <Zap className="size-5" />
        {submitting ? "Saving..." : "Start SmartFlow Trade"}
      </Button>

      {/* Reassurance */}
      <div className="bg-muted/30 flex items-start gap-2 rounded-lg p-2.5">
        <Info className="text-muted-foreground mt-0.5 size-3 shrink-0" aria-hidden="true" />
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          You can change these settings later or stop the trade at any time. SmartFlow will protect
          your position automatically.
        </p>
      </div>
    </div>
  )
}
