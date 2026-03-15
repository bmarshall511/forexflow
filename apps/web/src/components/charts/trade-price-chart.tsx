"use client"

import { useMemo } from "react"
import { priceToPips, formatPips, getDecimalPlaces } from "@fxflow/shared"
import { cn } from "@/lib/utils"

interface KeyLevel {
  price: number
  label: string
  type: "support" | "resistance" | "pivot"
}

interface TradePriceChartProps {
  instrument: string
  direction: "long" | "short"
  entryPrice: number
  currentPrice: number | null
  stopLoss: number | null
  takeProfit: number | null
  exitPrice?: number | null
  keyLevels?: KeyLevel[]
  className?: string
  height?: number
  showLabels?: boolean
  compact?: boolean
}

interface PriceLevel {
  label: string
  price: number
  pct: number // 0–100% from bottom
  colorClass: string
  colorVar: string
  dashed: boolean
}

export function TradePriceChart({
  instrument,
  direction,
  entryPrice,
  currentPrice,
  stopLoss,
  takeProfit,
  exitPrice,
  keyLevels,
  className,
  height = 140,
  showLabels = true,
  compact = false,
}: TradePriceChartProps) {
  const effectiveHeight = compact ? 60 : Math.max(height, 60)
  const effectiveShowLabels = compact ? false : showLabels
  const decimals = getDecimalPlaces(instrument)

  const layout = useMemo(() => {
    const prices: number[] = [entryPrice]
    if (stopLoss !== null) prices.push(stopLoss)
    if (takeProfit !== null) prices.push(takeProfit)
    if (currentPrice !== null) prices.push(currentPrice)
    if (exitPrice !== null && exitPrice !== undefined) prices.push(exitPrice)
    if (keyLevels?.length) keyLevels.forEach((kl) => prices.push(kl.price))

    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    const range = maxPrice - minPrice || entryPrice * 0.002
    const pad = range * 0.15
    const low = minPrice - pad
    const high = maxPrice + pad
    const totalRange = high - low

    const priceToPct = (p: number): number => ((p - low) / totalRange) * 100

    // Build levels
    const levels: PriceLevel[] = []

    levels.push({
      label: "Entry",
      price: entryPrice,
      pct: priceToPct(entryPrice),
      colorClass: "text-foreground/50",
      colorVar: "var(--foreground)",
      dashed: false,
    })

    if (stopLoss !== null) {
      levels.push({
        label: "SL",
        price: stopLoss,
        pct: priceToPct(stopLoss),
        colorClass: "text-status-disconnected",
        colorVar: "var(--status-disconnected)",
        dashed: true,
      })
    }

    if (takeProfit !== null) {
      levels.push({
        label: "TP",
        price: takeProfit,
        pct: priceToPct(takeProfit),
        colorClass: "text-status-connected",
        colorVar: "var(--status-connected)",
        dashed: true,
      })
    }

    if (exitPrice !== null && exitPrice !== undefined) {
      levels.push({
        label: "Exit",
        price: exitPrice,
        pct: priceToPct(exitPrice),
        colorClass: "text-chart-3",
        colorVar: "var(--chart-3)",
        dashed: false,
      })
    }

    // AI key levels
    if (keyLevels?.length) {
      const klColorMap: Record<string, { colorClass: string; colorVar: string }> = {
        support: { colorClass: "text-emerald-500", colorVar: "var(--color-emerald-500, #10b981)" },
        resistance: { colorClass: "text-red-500", colorVar: "var(--color-red-500, #ef4444)" },
        pivot: { colorClass: "text-blue-500", colorVar: "var(--color-blue-500, #3b82f6)" },
      }
      for (const kl of keyLevels) {
        const colors = klColorMap[kl.type] ?? klColorMap.pivot!
        levels.push({
          label: kl.label,
          price: kl.price,
          pct: priceToPct(kl.price),
          colorClass: colors!.colorClass,
          colorVar: colors!.colorVar,
          dashed: true,
        })
      }
    }

    const entryPct = priceToPct(entryPrice)
    const slPct = stopLoss !== null ? priceToPct(stopLoss) : null
    const tpPct = takeProfit !== null ? priceToPct(takeProfit) : null
    const currentPct = currentPrice !== null ? priceToPct(currentPrice) : null

    const isProfit =
      currentPrice !== null
        ? direction === "long"
          ? currentPrice > entryPrice
          : currentPrice < entryPrice
        : false

    return { levels, entryPct, slPct, tpPct, currentPct, isProfit }
  }, [entryPrice, stopLoss, takeProfit, currentPrice, exitPrice, direction, keyLevels])

  return (
    <div className={cn("relative w-full", className)} style={{ height: effectiveHeight }}>
      {/* Chart area */}
      <div
        className="absolute inset-0 overflow-hidden rounded-md"
        style={{ right: effectiveShowLabels ? 110 : 0 }}
      >
        {/* Risk zone (SL → Entry) */}
        {layout.slPct !== null && (
          <div
            className="bg-status-disconnected/8 absolute left-0 right-0"
            style={{
              bottom: `${Math.min(layout.slPct, layout.entryPct)}%`,
              height: `${Math.abs(layout.entryPct - layout.slPct)}%`,
            }}
          />
        )}

        {/* Reward zone (Entry → TP) */}
        {layout.tpPct !== null && (
          <div
            className="bg-status-connected/8 absolute left-0 right-0"
            style={{
              bottom: `${Math.min(layout.tpPct, layout.entryPct)}%`,
              height: `${Math.abs(layout.entryPct - layout.tpPct)}%`,
            }}
          />
        )}

        {/* Price level lines */}
        {layout.levels.map((level) => (
          <div
            key={level.label}
            className="absolute left-0 right-0 h-px"
            style={{
              bottom: `${level.pct}%`,
              opacity: level.label === "Entry" ? 0.3 : 0.5,
              ...(level.dashed
                ? {
                    backgroundImage: `repeating-linear-gradient(to right, ${level.colorVar} 0, ${level.colorVar} 4px, transparent 4px, transparent 8px)`,
                  }
                : {
                    backgroundColor: level.colorVar,
                  }),
            }}
          />
        ))}

        {/* Current price line + marker */}
        {layout.currentPct !== null && (
          <>
            <div
              className="absolute left-0 right-0 h-px transition-all duration-300"
              style={{
                bottom: `${layout.currentPct}%`,
                backgroundColor: layout.isProfit
                  ? "var(--status-connected)"
                  : "var(--status-disconnected)",
                opacity: 0.6,
              }}
            />
            <div
              className="absolute left-1/2 size-2.5 -translate-x-1/2 animate-pulse rounded-full transition-all duration-300"
              style={{
                bottom: `calc(${layout.currentPct}% - 5px)`,
                backgroundColor: layout.isProfit
                  ? "var(--status-connected)"
                  : "var(--status-disconnected)",
              }}
            />
          </>
        )}
      </div>

      {/* Labels */}
      {effectiveShowLabels && (
        <div className="absolute inset-y-0 right-0 w-[106px]">
          {layout.levels.map((level) => (
            <div
              key={level.label}
              className="absolute right-0 flex -translate-y-1/2 items-center gap-1 whitespace-nowrap font-mono text-[10px] tabular-nums"
              style={{ bottom: `${level.pct}%` }}
            >
              <span className={cn("font-sans font-medium", level.colorClass)}>{level.label}</span>
              <span className="text-muted-foreground">{level.price.toFixed(decimals)}</span>
            </div>
          ))}

          {layout.currentPct !== null && currentPrice !== null && (
            <div
              className="absolute right-0 flex -translate-y-1/2 items-center gap-1 whitespace-nowrap font-mono text-[10px] tabular-nums transition-all duration-300"
              style={{ bottom: `${layout.currentPct}%` }}
            >
              <span
                className={cn(
                  "font-sans font-medium",
                  layout.isProfit ? "text-status-connected" : "text-status-disconnected",
                )}
              >
                Now
              </span>
              <span
                className={cn(
                  "font-semibold",
                  layout.isProfit ? "text-status-connected" : "text-status-disconnected",
                )}
              >
                {currentPrice.toFixed(decimals)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Compact: pip distance summary */}
      {compact && currentPrice !== null && (
        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1 text-[10px] tabular-nums">
          {stopLoss !== null && (
            <span className="text-status-disconnected">
              SL: -{formatPips(priceToPips(instrument, Math.abs(entryPrice - stopLoss)))}p
            </span>
          )}
          <span className={layout.isProfit ? "text-status-connected" : "text-status-disconnected"}>
            {layout.isProfit ? "+" : "-"}
            {formatPips(priceToPips(instrument, Math.abs(currentPrice - entryPrice)))}p
          </span>
          {takeProfit !== null && (
            <span className="text-status-connected">
              TP: +{formatPips(priceToPips(instrument, Math.abs(takeProfit - entryPrice)))}p
            </span>
          )}
        </div>
      )}
    </div>
  )
}
