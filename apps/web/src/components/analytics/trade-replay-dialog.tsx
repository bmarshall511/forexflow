"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import type { TradeFinderSetupData } from "@fxflow/types"
import { useTradeReplay } from "@/hooks/use-trade-replay"
import { TradeReplay } from "./trade-replay"
import { ReplayControls } from "./replay-controls"
import { ReplayTradeInfoPanel } from "./replay-trade-info"
import { ReplayCandleInfo } from "./replay-candle-info"
import { ReplayOverlayLegend, type OverlayVisibility } from "./replay-overlay-legend"
import { Loader2 } from "lucide-react"

interface TradeReplayDialogProps {
  tradeId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Trade Finder setup snapshot for zone/trend/curve overlays */
  tfSetup?: TradeFinderSetupData | null
}

const SPEEDS = [1, 2, 5, 10] as const

export function TradeReplayDialog({
  tradeId,
  open,
  onOpenChange,
  tfSetup,
}: TradeReplayDialogProps) {
  const { candles, tradeInfo, isLoading, error, currentIndex, isPlaying, speed, controls } =
    useTradeReplay(open ? tradeId : null)

  const [overlayVisibility, setOverlayVisibility] = useState<OverlayVisibility>({
    entry: true,
    stopLoss: true,
    takeProfit: true,
    exit: true,
    zones: true,
  })

  const toggleOverlay = useCallback((key: keyof OverlayVisibility) => {
    setOverlayVisibility((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  // Keyboard controls (Space, arrows, Home)
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      const target = e.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
      switch (e.key) {
        case " ":
          e.preventDefault()
          if (isPlaying) controls.pause()
          else controls.play()
          break
        case "ArrowRight":
          e.preventDefault()
          controls.stepForward()
          break
        case "ArrowLeft":
          e.preventDefault()
          controls.stepBack()
          break
        case "ArrowUp": {
          e.preventDefault()
          const idx = SPEEDS.indexOf(speed)
          if (idx < SPEEDS.length - 1) controls.setSpeed(SPEEDS[idx + 1]!)
          break
        }
        case "ArrowDown": {
          e.preventDefault()
          const idx = SPEEDS.indexOf(speed)
          if (idx > 0) controls.setSpeed(SPEEDS[idx - 1]!)
          break
        }
        case "Home":
          e.preventDefault()
          controls.reset()
          break
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, isPlaying, speed, controls])

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

  // Determine entry candle for hasEnteredTrade calculation
  const entryTime = tradeInfo ? Math.floor(new Date(tradeInfo.openedAt).getTime() / 1000) : 0
  const entryCandleIdx = useMemo(
    () => candles.findIndex((c) => c.time >= entryTime),
    [candles, entryTime],
  )
  const hasEnteredTrade = entryCandleIdx >= 0 && currentIndex >= entryCandleIdx

  const currentCandle = candles[currentIndex] ?? null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex h-[85vh] flex-col gap-3 overflow-y-auto p-4 sm:p-6"
      >
        <SheetHeader>
          <SheetTitle className="text-base">
            {pair ? `Replay: ${pair} ${dirLabel}` : "Trade Replay"}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {tradeInfo
              ? "Watch how this trade played out candle by candle"
              : "Loading replay data..."}
          </SheetDescription>
        </SheetHeader>

        {isLoading && (
          <div className="flex flex-1 items-center justify-center">
            <Loader2
              className="text-muted-foreground size-6 animate-spin"
              aria-label="Loading replay"
            />
          </div>
        )}

        {error && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        {!isLoading && !error && tradeInfo && candles.length > 0 && (
          <>
            {/* Plain-English trade summary */}
            <ReplayTradeInfoPanel trade={tradeInfo} />

            {/* OHLC readout + live pip P&L + overlay toggles */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <ReplayCandleInfo
                candle={currentCandle}
                trade={tradeInfo}
                hasEnteredTrade={hasEnteredTrade}
              />
              <ReplayOverlayLegend
                visibility={overlayVisibility}
                onToggle={toggleOverlay}
                hasZones={tfSetup != null}
                hasSL={tradeInfo.stopLoss != null}
                hasTP={tradeInfo.takeProfit != null}
              />
            </div>

            {/* Chart — fills remaining flex space */}
            <div className="min-h-0 flex-1">
              <TradeReplay
                candles={candles}
                tradeInfo={tradeInfo}
                currentIndex={currentIndex}
                tfSetup={tfSetup}
                overlayVisibility={overlayVisibility}
                height={0}
              />
            </div>

            {/* Transport controls */}
            <ReplayControls
              controls={controls}
              currentIndex={currentIndex}
              totalCandles={candles.length}
              isPlaying={isPlaying}
              speed={speed}
              currentTime={currentTime}
            />

            {/* Keyboard shortcut hint */}
            <p className="text-muted-foreground/50 text-center text-[10px]">
              Space = play/pause · ← → = step · ↑ ↓ = speed · Home = reset
            </p>
          </>
        )}

        {!isLoading && !error && candles.length === 0 && tradeInfo && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-muted-foreground text-sm">
              No candle data available for this trade.
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
