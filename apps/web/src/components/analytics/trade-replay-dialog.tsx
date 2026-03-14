"use client"

import { useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { useTradeReplay } from "@/hooks/use-trade-replay"
import { TradeReplay } from "./trade-replay"
import { ReplayControls } from "./replay-controls"
import { Loader2 } from "lucide-react"

interface TradeReplayDialogProps {
  tradeId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TradeReplayDialog({ tradeId, open, onOpenChange }: TradeReplayDialogProps) {
  const { candles, tradeInfo, isLoading, error, currentIndex, isPlaying, speed, controls } =
    useTradeReplay(open ? tradeId : null)

  const currentTime = useMemo(() => {
    if (candles.length === 0 || currentIndex >= candles.length) return null
    const candle = candles[currentIndex]
    if (!candle) return null
    return new Date(candle.time * 1000).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }, [candles, currentIndex])

  const pair = tradeInfo?.instrument.replace("_", "/") ?? ""
  const dirLabel = tradeInfo?.direction === "long" ? "Long" : "Short"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-3xl flex-col gap-3 p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base">
            {pair ? `Replay: ${pair} ${dirLabel}` : "Trade Replay"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {tradeInfo
              ? `${tradeInfo.timeframe} candles from entry to exit`
              : "Loading replay data..."}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="text-muted-foreground size-6 animate-spin" />
          </div>
        )}

        {error && (
          <div className="flex h-64 items-center justify-center">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        {!isLoading && !error && tradeInfo && candles.length > 0 && (
          <>
            <TradeReplay
              candles={candles}
              tradeInfo={tradeInfo}
              currentIndex={currentIndex}
              height={360}
            />
            <ReplayControls
              controls={controls}
              currentIndex={currentIndex}
              totalCandles={candles.length}
              isPlaying={isPlaying}
              speed={speed}
              currentTime={currentTime}
            />
          </>
        )}

        {!isLoading && !error && candles.length === 0 && tradeInfo && (
          <div className="flex h-64 items-center justify-center">
            <p className="text-muted-foreground text-sm">
              No candle data available for this trade.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
