"use client"

import { useState } from "react"
import type { SmartFlowTradeData, SmartFlowPhase } from "@fxflow/types"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { DirectionBadge } from "@/components/positions/direction-badge"
import { TradeTimeline } from "./trade-timeline"
import { ChevronDown, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface ActiveTradeCardProps {
  trade: SmartFlowTradeData
  onCancel?: (id: string) => void
}

const phases: Record<SmartFlowPhase, { label: string; color: string }> = {
  entry: { label: "Entry", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  breakeven: {
    label: "Breakeven Set",
    color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  },
  trailing: {
    label: "Trailing",
    color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  },
  partial: {
    label: "Partial Close",
    color: "bg-violet-500/10 text-violet-500 border-violet-500/20",
  },
  recovery: { label: "Recovery", color: "bg-red-500/10 text-red-500 border-red-500/20" },
  target: { label: "At Target", color: "bg-green-500/10 text-green-500 border-green-500/20" },
  safety_net: {
    label: "Safety Net",
    color: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  },
}

export function ActiveTradeCard({ trade, onCancel }: ActiveTradeCardProps) {
  const [logOpen, setLogOpen] = useState(false)

  const direction = (trade.direction ?? "long") as "long" | "short"
  const instrument = trade.instrument ?? "Unknown"
  const lastLog = trade.managementLog.slice(-5)
  const currentPL = trade.managementLog[trade.managementLog.length - 1]?.priceBid ?? null

  const { entryPrice, estimatedHigh, estimatedLow } = trade
  const progressValue =
    entryPrice && estimatedHigh && estimatedLow
      ? Math.min(
          100,
          Math.max(
            0,
            (((currentPL ?? entryPrice) - estimatedLow) / (estimatedHigh - estimatedLow)) * 100,
          ),
        )
      : 50
  const phase = phases[trade.currentPhase]

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-mono text-sm font-semibold">{instrument}</span>
          <DirectionBadge direction={direction} />
          <Badge variant="outline" className={cn("text-[10px]", phase.color)}>
            {phase.label}
          </Badge>
        </div>
        {trade.estimatedHours != null && (
          <span className="text-muted-foreground shrink-0 text-[10px]">
            ~
            {trade.estimatedHours < 1
              ? `${Math.round(trade.estimatedHours * 60)}m`
              : `${trade.estimatedHours.toFixed(1)}h`}{" "}
            est.
          </span>
        )}
      </CardHeader>

      <CardContent className="space-y-3 pb-3">
        <Progress value={progressValue} className="h-1.5" />

        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Entry:{" "}
            <span className="text-foreground font-mono">
              {trade.entryPrice?.toFixed(5) ?? "--"}
            </span>
          </span>
          {currentPL != null && (
            <span
              className={cn(
                "font-mono font-semibold",
                currentPL >= 0 ? "text-status-connected" : "text-status-disconnected",
              )}
            >
              {currentPL >= 0 ? "+" : ""}
              {currentPL.toFixed(2)}
            </span>
          )}
        </div>

        {lastLog.length > 0 && (
          <Collapsible open={logOpen} onOpenChange={setLogOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1 text-[10px] transition-colors"
              >
                <ChevronDown
                  className={cn("size-3 transition-transform", logOpen && "rotate-180")}
                />
                Management log ({trade.managementLog.length})
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <TradeTimeline entries={lastLog} />
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>

      {onCancel && (
        <CardFooter className="border-t pt-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive h-7 gap-1.5 text-xs"
            onClick={() => onCancel(trade.id)}
          >
            <X className="size-3" />
            Cancel
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
