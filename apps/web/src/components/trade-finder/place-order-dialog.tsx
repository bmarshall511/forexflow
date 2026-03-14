"use client"

import type { TradeFinderSetupData } from "@fxflow/types"
import { TIMEFRAME_SET_MAP } from "@fxflow/types"
import { formatInstrument, getPipSize } from "@fxflow/shared"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Target,
  ShieldAlert,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface PlaceOrderDialogProps {
  setup: TradeFinderSetupData
  orderType: "MARKET" | "LIMIT"
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  isPlacing: boolean
}

function fmtDollar(amount: number): string {
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`
  return `$${amount.toFixed(2)}`
}

function computeDollarAmount(positionSize: number, pips: number, instrument: string): number {
  const pipSize = getPipSize(instrument)
  return positionSize * pips * pipSize
}

export function PlaceOrderDialog({
  setup,
  orderType,
  open,
  onOpenChange,
  onConfirm,
  isPlacing,
}: PlaceOrderDialogProps) {
  const isLong = setup.direction === "long"
  const isMarket = orderType === "MARKET"
  const riskDollars = computeDollarAmount(setup.positionSize, setup.riskPips, setup.instrument)
  const rewardDollars = computeDollarAmount(setup.positionSize, setup.rewardPips, setup.instrument)
  const tfSet = TIMEFRAME_SET_MAP[setup.timeframeSet]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isMarket ? "Place Market Order" : "Place Limit Order"}
          </DialogTitle>
          <DialogDescription>
            {isMarket
              ? "This will execute immediately at the current market price."
              : "This will create a pending order that executes when price reaches your entry level."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Pair + Direction header */}
          <div className="bg-muted/50 flex items-center gap-3 rounded-lg p-3">
            <div
              className={cn(
                "flex size-10 items-center justify-center rounded-full",
                isLong ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500",
              )}
            >
              {isLong ? <TrendingUp className="size-5" /> : <TrendingDown className="size-5" />}
            </div>
            <div>
              <p className="text-base font-semibold">{formatInstrument(setup.instrument)}</p>
              <p className={cn("text-sm font-medium", isLong ? "text-green-500" : "text-red-500")}>
                {isLong ? "Buying" : "Selling"} · {isMarket ? "Market" : "Limit"} Order
              </p>
            </div>
          </div>

          {/* Price levels */}
          <div className="grid grid-cols-3 gap-2">
            <PriceBox
              icon={<Target className="size-3.5" />}
              label={isMarket ? "Entry" : "Entry Price"}
              sublabel={isMarket ? "At market price" : "Pending order"}
              value={isMarket ? "Market" : setup.entryPrice.toFixed(5)}
              color="text-amber-500"
            />
            <PriceBox
              icon={<ShieldAlert className="size-3.5" />}
              label="Stop Loss"
              sublabel="Max you can lose"
              value={setup.stopLoss.toFixed(5)}
              color="text-red-500"
            />
            <PriceBox
              icon={<DollarSign className="size-3.5" />}
              label="Take Profit"
              sublabel="Target to close"
              value={setup.takeProfit.toFixed(5)}
              color="text-green-500"
            />
          </div>

          {/* Risk / Reward summary */}
          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex h-6 gap-1 overflow-hidden rounded">
              <div
                className="flex items-center justify-center bg-red-500/20 text-[11px] font-semibold text-red-500"
                style={{
                  width: `${Math.min(45, (1 / (1 + parseFloat(setup.rrRatio))) * 100)}%`,
                  minWidth: "18%",
                }}
              >
                -{fmtDollar(riskDollars)}
              </div>
              <div className="flex flex-1 items-center justify-center bg-green-500/20 text-[11px] font-semibold text-green-500">
                +{fmtDollar(rewardDollars)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">If you lose</span>
                <span className="font-medium text-red-500">
                  -{fmtDollar(riskDollars)} ({setup.riskPips.toFixed(1)}p)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">If you win</span>
                <span className="font-medium text-green-500">
                  +{fmtDollar(rewardDollars)} ({setup.rewardPips.toFixed(1)}p)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Risk:Reward</span>
                <span className="font-mono font-medium">{setup.rrRatio}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Trade Size</span>
                <span className="font-mono font-medium">
                  {setup.positionSize.toLocaleString()} units
                </span>
              </div>
            </div>
          </div>

          {/* Extra context */}
          <div className="text-muted-foreground grid grid-cols-2 gap-x-4 text-xs">
            <div className="flex justify-between">
              <span>Timeframe</span>
              <span className="text-foreground font-medium">{tfSet?.ltf ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span>Score</span>
              <span className="text-foreground font-medium">
                {setup.scores.total}/{setup.scores.maxPossible}
              </span>
            </div>
          </div>

          {/* Market order warning */}
          {isMarket && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                Market orders execute immediately. The actual fill price may differ slightly from
                the expected entry due to spread and slippage.
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPlacing}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isPlacing}
            className={cn(
              "min-w-[140px] gap-1.5",
              isLong
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-red-600 text-white hover:bg-red-700",
            )}
          >
            {isPlacing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Placing...
              </>
            ) : (
              <>Confirm {isLong ? "Buy" : "Sell"}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PriceBox({
  icon,
  label,
  sublabel,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  sublabel: string
  value: string
  color: string
}) {
  return (
    <div className="space-y-0.5 rounded-md border p-2 text-center">
      <div className={cn("flex items-center justify-center gap-1", color)}>
        {icon}
        <span className="text-[10px] font-medium">{label}</span>
      </div>
      <div
        className={cn(
          "font-mono text-sm font-semibold tabular-nums",
          value === "Market" ? "text-amber-500" : color,
        )}
      >
        {value}
      </div>
      <div className="text-muted-foreground text-[9px]">{sublabel}</div>
    </div>
  )
}
