"use client"

import { useState, useRef, useCallback } from "react"
import type { ChartPanelConfig, PositionPriceTick, TradeDirection } from "@fxflow/types"
import { formatInstrument } from "@fxflow/shared"
import { cn } from "@/lib/utils"
import type { OrderOverlayConfig } from "./standalone-chart"
import type { TradeChartConfig } from "./chart-panel"
import { ChartPanel } from "./chart-panel"

interface MobileChartSwiperProps {
  panels: ChartPanelConfig[]
  onPanelChange: (index: number, config: Partial<ChartPanelConfig>) => void
  chartPrices: Map<string, PositionPriceTick>
  /** Per-panel trade chart configs (keyed by panel index) */
  tradeCharts: Record<number, TradeChartConfig>
  /** Called when a panel's instrument changes while it has a trade — clears that panel's trade */
  onClearTrade: (index: number) => void
  /** Called when user clicks Buy/Sell on a panel */
  onOrderEntry?: (panelIndex: number, direction: TradeDirection) => void
  /** Order overlay config for the active panel */
  orderOverlay?: OrderOverlayConfig | null
  /** Panel index that has the order overlay */
  orderOverlayPanelIndex?: number
}

export function MobileChartSwiper({
  panels,
  onPanelChange,
  chartPrices,
  tradeCharts,
  onClearTrade,
  onOrderEntry,
  orderOverlay,
  orderOverlayPanelIndex,
}: MobileChartSwiperProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollToIndex = useCallback((index: number) => {
    setActiveIndex(index)
    scrollRef.current?.children[index]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "start",
    })
  }, [])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const scrollLeft = el.scrollLeft
    const width = el.clientWidth
    const newIndex = Math.round(scrollLeft / width)
    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < panels.length) {
      setActiveIndex(newIndex)
    }
  }, [activeIndex, panels.length])

  if (panels.length === 0) return null

  if (panels.length === 1) {
    const config = panels[0]!
    const tickInstrument = tradeCharts[0] ? tradeCharts[0].trade.instrument : config.instrument
    const tick = chartPrices.get(tickInstrument) ?? null
    return (
      <div className="min-h-0 flex-1">
        <ChartPanel
          config={config}
          onConfigChange={(partial) => onPanelChange(0, partial)}
          lastTick={tick}
          isActive
          tradeChart={tradeCharts[0] ?? null}
          onClearTrade={() => onClearTrade(0)}
          showOrderOverlay={!tradeCharts[0] && !!onOrderEntry}
          onOrderEntry={onOrderEntry ? (dir) => onOrderEntry(0, dir) : undefined}
          orderOverlay={orderOverlayPanelIndex === 0 ? orderOverlay : null}
          className="h-full"
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        className="scrollbar-none flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto"
        onScroll={handleScroll}
      >
        {panels.map((config, index) => {
          const tradeConfig = tradeCharts[index]
          const tickInstrument = tradeConfig ? tradeConfig.trade.instrument : config.instrument
          const tick = chartPrices.get(tickInstrument) ?? null
          const isActive = index === activeIndex
          return (
            <div key={index} className="min-h-0 w-full shrink-0 snap-start">
              <ChartPanel
                config={config}
                onConfigChange={(partial) => onPanelChange(index, partial)}
                lastTick={tick}
                isActive={isActive}
                onActivate={() => setActiveIndex(index)}
                tradeChart={tradeCharts[index] ?? null}
                onClearTrade={() => onClearTrade(index)}
                showOrderOverlay={isActive && !tradeConfig && !!onOrderEntry}
                onOrderEntry={onOrderEntry ? (dir) => onOrderEntry(index, dir) : undefined}
                orderOverlay={orderOverlayPanelIndex === index ? orderOverlay : null}
                className="h-full"
              />
            </div>
          )
        })}
      </div>

      <div className="bg-background flex shrink-0 items-center justify-center gap-1 border-t py-1.5">
        {panels.map((config, index) => (
          <button
            key={index}
            type="button"
            onClick={() => scrollToIndex(index)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors",
              index === activeIndex
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
            aria-label={`View ${formatInstrument(config.instrument)} chart`}
          >
            {formatInstrument(config.instrument)}
          </button>
        ))}
      </div>
    </div>
  )
}
