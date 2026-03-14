"use client"

import { useMemo } from "react"
import type {
  ChartGridLayout,
  ChartPanelConfig,
  PositionPriceTick,
  TradeDirection,
} from "@fxflow/types"
import type { OrderOverlayConfig } from "./standalone-chart"
import type { TradeChartConfig } from "./chart-panel"
import { ChartPanel } from "./chart-panel"

interface ChartGridProps {
  layout: ChartGridLayout
  panels: ChartPanelConfig[]
  onPanelChange: (index: number, config: Partial<ChartPanelConfig>) => void
  chartPrices: Map<string, PositionPriceTick>
  activeIndex: number
  onActiveChange: (index: number) => void
  /** Per-panel trade chart configs (keyed by panel index) */
  tradeCharts: Record<number, TradeChartConfig>
  /** Called when a panel's instrument changes while it has a trade — clears that panel's trade */
  onClearTrade: (index: number) => void
  /** Called when user clicks Buy/Sell on a panel */
  onOrderEntry?: (panelIndex: number, direction: TradeDirection) => void
  /** Order overlay config for the active panel (null if no order ticket open) */
  orderOverlay?: OrderOverlayConfig | null
  /** Panel index that has the order overlay */
  orderOverlayPanelIndex?: number
}

/** CSS grid class per layout type */
const GRID_CLASSES: Record<ChartGridLayout, string> = {
  single: "grid-cols-1 grid-rows-1",
  "2-horizontal": "grid-cols-2 grid-rows-1",
  "2-vertical": "grid-cols-1 grid-rows-2",
  "3-left": "grid-cols-2 grid-rows-2",
  "4-grid": "grid-cols-2 grid-rows-2",
  "6-grid": "grid-cols-3 grid-rows-2",
}

export function ChartGrid({
  layout,
  panels,
  onPanelChange,
  chartPrices,
  activeIndex,
  onActiveChange,
  tradeCharts,
  onClearTrade,
  onOrderEntry,
  orderOverlay,
  orderOverlayPanelIndex,
}: ChartGridProps) {
  // Clamp active index to valid range
  const clampedActive = Math.min(activeIndex, panels.length - 1)

  const panelElements = useMemo(
    () =>
      panels.map((config, index) => {
        const isActive = index === clampedActive
        const tradeConfig = tradeCharts[index]
        const tickInstrument = tradeConfig ? tradeConfig.trade.instrument : config.instrument
        const tick = chartPrices.get(tickInstrument) ?? null
        const spanClass = layout === "3-left" && index === 0 ? "row-span-2" : ""
        const hasOrderOverlay = orderOverlayPanelIndex === index

        return (
          <ChartPanel
            key={index}
            config={config}
            onConfigChange={(partial) => onPanelChange(index, partial)}
            lastTick={tick}
            loadDelay={index * 200}
            isActive={isActive}
            onActivate={() => onActiveChange(index)}
            tradeChart={tradeCharts[index] ?? null}
            onClearTrade={() => onClearTrade(index)}
            showOrderOverlay={isActive && !tradeConfig && !!onOrderEntry}
            onOrderEntry={onOrderEntry ? (dir) => onOrderEntry(index, dir) : undefined}
            orderOverlay={hasOrderOverlay ? orderOverlay : null}
            className={`min-h-0 min-w-0 ${spanClass}`}
          />
        )
      }),
    [
      panels,
      layout,
      onPanelChange,
      chartPrices,
      clampedActive,
      onActiveChange,
      tradeCharts,
      onClearTrade,
      onOrderEntry,
      orderOverlay,
      orderOverlayPanelIndex,
    ],
  )

  return (
    <div className={`bg-border grid min-h-0 flex-1 gap-px overflow-hidden ${GRID_CLASSES[layout]}`}>
      {panelElements}
    </div>
  )
}
