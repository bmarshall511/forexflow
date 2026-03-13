"use client"

import { useCallback } from "react"
import type { OpenTradeData, PendingOrderData, ClosedTradeData, PositionPriceTick } from "@fxflow/types"
import { useChartTradeEditor } from "@/hooks/use-chart-trade-editor"
import { useTradeActions } from "@/hooks/use-trade-actions"
import { DraggableTradeChart } from "@/components/charts/draggable-trade-chart"
import type { TradeLevel } from "@/components/charts/trade-level-primitive"
import { OpenProgressBar } from "./progress-bar-open"
import { PendingProgressBar } from "./progress-bar-pending"
import { TradeEditorForm } from "./trade-editor-form"

export type TradeEditorTrade =
  | (OpenTradeData & { _type: "open" })
  | (PendingOrderData & { _type: "pending" })

export type TradeUnion =
  | TradeEditorTrade
  | (ClosedTradeData & { _type: "closed" })

interface TradeEditorPanelProps {
  trade: TradeEditorTrade
  defaultTimeframe?: string | null
  currency?: string
  /** For open trades: open close dialog; for pending: open cancel dialog */
  onAction?: () => void
  /** Called after a successful SL/TP save — use to refetch trade detail/events */
  onSaved?: () => void
  /** Live market price (for pending orders passed from parent) */
  currentPrice?: number | null
  /** Full price tick for real-time candle updates */
  lastTick?: PositionPriceTick | null
  /** Trade entry/exit levels drawn as lines on the candles */
  tradeLevels?: TradeLevel[]
  /** Unix seconds to scroll/center the chart on after data loads */
  scrollToTime?: number
}

export function TradeEditorPanel({
  trade,
  defaultTimeframe,
  onAction,
  onSaved,
  currentPrice: externalCurrentPrice,
  lastTick,
  tradeLevels,
  scrollToTime,
}: TradeEditorPanelProps) {
  const { modifyTrade, modifyPendingOrder } = useTradeActions()

  const livePrice = trade._type === "open"
    ? trade.currentPrice
    : externalCurrentPrice ?? null

  const saveFn = useCallback(
    async (stopLoss: number | null, takeProfit: number | null): Promise<boolean> => {
      if (trade._type === "open") {
        return modifyTrade(trade.sourceTradeId, { stopLoss, takeProfit })
      }
      return modifyPendingOrder(trade.sourceOrderId, { stopLoss, takeProfit })
    },
    [trade, modifyTrade, modifyPendingOrder],
  )

  const editor = useChartTradeEditor({
    instrument: trade.instrument,
    direction: trade.direction,
    entryPrice: trade.entryPrice,
    savedSL: trade.stopLoss,
    savedTP: trade.takeProfit,
    saveFn,
    onSaved,
  })

  return (
    <div className="space-y-0">
      <DraggableTradeChart
        instrument={trade.instrument}
        direction={trade.direction}
        entryPrice={trade.entryPrice}
        currentPrice={livePrice}
        lastTick={lastTick}
        draftSL={editor.draftSL}
        draftTP={editor.draftTP}
        savedSL={trade.stopLoss}
        savedTP={trade.takeProfit}
        defaultTimeframe={defaultTimeframe}
        onDraftChange={(lineType, price) => {
          if (lineType === "sl") editor.setDraftSL(price)
          else editor.setDraftTP(price)
        }}
        tradeLevels={tradeLevels}
        scrollToTime={scrollToTime}
        height={260}
      />

      <div className="mt-3">
        {trade._type === "open" ? (
          <OpenProgressBar
            instrument={trade.instrument}
            direction={trade.direction}
            entryPrice={trade.entryPrice}
            currentPrice={trade.currentPrice}
            stopLoss={editor.draftSL}
            takeProfit={editor.draftTP}
          />
        ) : (
          <PendingProgressBar
            instrument={trade.instrument}
            entryPrice={trade.entryPrice}
            currentPrice={livePrice}
          />
        )}
      </div>

      <TradeEditorForm
        instrument={trade.instrument}
        direction={trade.direction}
        entryPrice={trade.entryPrice}
        draftSL={editor.draftSL}
        draftTP={editor.draftTP}
        savedSL={trade.stopLoss}
        savedTP={trade.takeProfit}
        onSLChange={editor.setDraftSL}
        onTPChange={editor.setDraftTP}
        onCancel={editor.cancel}
        onSave={editor.save}
        onCloseTrade={onAction}
        variant={trade._type === "pending" ? "pending" : "open"}
        isSaving={editor.isSaving}
        isDirty={editor.isDirty}
        isSLDirty={editor.isSLDirty}
        isTPDirty={editor.isTPDirty}
        validationErrors={editor.validationErrors}
        slPips={editor.slPips}
        tpPips={editor.tpPips}
        defaultSL={editor.defaultSL}
        defaultTP={editor.defaultTP}
      />
    </div>
  )
}
