"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import type { PositionPriceTick, TradeDirection, PlaceOrderRequest, Timeframe } from "@fxflow/types"
import type { TradeUnion } from "@/components/positions/trade-editor-panel"
import type { TradeChartConfig } from "@/components/charts/chart-panel"
import type { OrderOverlayConfig } from "@/components/charts/standalone-chart"
import type { LineType } from "@/hooks/use-price-line-drag"
import { useDaemonStatus } from "@/hooks/use-daemon-status"
import { usePositions } from "@/hooks/use-positions"
import { useChartLayout } from "@/hooks/use-chart-layout"
import { useChartTradeEditor } from "@/hooks/use-chart-trade-editor"
import { useOrderTicket } from "@/hooks/use-order-ticket"
import { useTradeActions } from "@/hooks/use-trade-actions"
import { useIsMobile } from "@/hooks/use-is-mobile"
import { LayoutSelector } from "@/components/charts/layout-selector"
import { PositionPicker } from "@/components/charts/position-picker"
import { TradeControlBar } from "@/components/charts/trade-control-bar"
import { OrderTicketPanel } from "@/components/charts/order-ticket-panel"
import { ChartGrid } from "@/components/charts/chart-grid"
import { MobileChartSwiper } from "@/components/charts/mobile-chart-swiper"
import { ErrorBoundary } from "@/components/ui/error-boundary"

/** Map of panel index → assigned trade */
type TradesByPanel = Record<number, TradeUnion>

const NO_OP_DRAFT = () => {}

const STORAGE_KEY = "fxflow-chart-trades"

/** Saved shape: panel index → trade id + type */
type SavedAssignments = Record<string, { id: string; _type: string }>

/** Order ticket state */
interface OrderTicketState {
  direction: TradeDirection
  panelIndex: number
}

export default function ChartsPage() {
  const { layout, isLoading, setLayout, setPanel, syncSubscriptions } = useChartLayout()
  const { chartPrices, accountOverview } = useDaemonStatus()
  const { positions, openWithPrices } = usePositions()
  const { modifyTrade, modifyPendingOrder, placeOrder, refreshPositions } = useTradeActions()
  const isMobile = useIsMobile()

  const [activeIndex, setActiveIndex] = useState(0)
  const [tradesByPanel, setTradesByPanel] = useState<TradesByPanel>({})
  const restoredRef = useRef(false)

  // Keep daemon price subscriptions in sync with assigned trade instruments
  // so the chart receives live ticks for instruments that differ from the panel default.
  useEffect(() => {
    const tradeInstruments = Object.values(tradesByPanel).map((t) => t.instrument)
    syncSubscriptions(tradeInstruments)
  }, [tradesByPanel, syncSubscriptions])
  // Set after a successful order placement so the reactive effect can assign the
  // new trade to the correct panel once positions_update arrives via WebSocket.
  const pendingAutoAssignRef = useRef<{ panelIndex: number; instrument: string } | null>(null)

  // Restore saved trade assignments once positions data is available,
  // then auto-assign open/pending trades to panels matching the instrument.
  useEffect(() => {
    if (restoredRef.current || !positions || isLoading) return
    restoredRef.current = true

    const allTrades: TradeUnion[] = [
      ...openWithPrices.map((t) => ({ ...t, _type: "open" as const })),
      ...positions.pending.map((o) => ({ ...o, _type: "pending" as const })),
      ...positions.closed.map((t) => ({ ...t, _type: "closed" as const })),
    ]
    const tradeMap = new Map(allTrades.map((t) => [t.id, t]))

    // Step 1: Restore from localStorage
    const restored: TradesByPanel = {}
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved: SavedAssignments = JSON.parse(raw)
        for (const [key, { id }] of Object.entries(saved)) {
          const trade = tradeMap.get(id)
          if (trade) restored[Number(key)] = trade as TradeUnion
        }
      }
    } catch {
      /* ignore corrupted storage */
    }

    // Step 2: Auto-assign open/pending trades to unassigned panels matching instrument
    const assignedIds = new Set(Object.values(restored).map((t) => t.id))
    const autoAssignable = allTrades.filter((t) => t._type !== "closed" && !assignedIds.has(t.id))

    for (let i = 0; i < layout.panels.length; i++) {
      if (restored[i]) continue // already assigned
      const panelInstrument = layout.panels[i]?.instrument
      if (!panelInstrument) continue
      const match = autoAssignable.find(
        (t) => t.instrument === panelInstrument && !assignedIds.has(t.id),
      )
      if (match) {
        restored[i] = match
        assignedIds.add(match.id)
      }
    }

    if (Object.keys(restored).length > 0) setTradesByPanel(restored)
  }, [positions, openWithPrices, isLoading, layout.panels])

  // Persist trade assignments to localStorage on change
  useEffect(() => {
    if (!restoredRef.current) return
    const saved: SavedAssignments = {}
    for (const [key, trade] of Object.entries(tradesByPanel)) {
      saved[key] = { id: trade.id, _type: trade._type }
    }
    try {
      if (Object.keys(saved).length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      /* storage full or unavailable */
    }
  }, [tradesByPanel])

  // Reactive auto-assign: runs whenever positions or panel instruments change.
  // Handles the case where a panel's instrument changes (or comes back) to match a position.
  // Runs after the one-time restore (guarded by restoredRef) to avoid conflicting with it.
  useEffect(() => {
    if (!restoredRef.current || !positions) return

    const allTrades: TradeUnion[] = [
      ...openWithPrices.map((t) => ({ ...t, _type: "open" as const })),
      ...positions.pending.map((o) => ({ ...o, _type: "pending" as const })),
    ]

    setTradesByPanel((prev) => {
      const assignedIds = new Set(Object.values(prev).map((t) => t.id))
      const updates: TradesByPanel = {}

      for (let i = 0; i < layout.panels.length; i++) {
        if (prev[i]) continue // already assigned — don't overwrite
        const panelInstrument = layout.panels[i]?.instrument
        if (!panelInstrument) continue
        const match = allTrades.find(
          (t) => t.instrument === panelInstrument && !assignedIds.has(t.id),
        )
        if (match) {
          updates[i] = match
          assignedIds.add(match.id)
        }
      }

      if (Object.keys(updates).length === 0) return prev
      return { ...prev, ...updates }
    })
  }, [positions, openWithPrices, layout.panels])

  // After a successful order placement, watch for the new trade to appear in positions
  // and auto-assign it to the panel that opened the order ticket.
  useEffect(() => {
    if (!pendingAutoAssignRef.current || !positions) return
    const { panelIndex, instrument } = pendingAutoAssignRef.current

    const candidates: TradeUnion[] = [
      ...openWithPrices.map((t) => ({ ...t, _type: "open" as const })),
      ...positions.pending.map((o) => ({ ...o, _type: "pending" as const })),
    ]

    const assignedIds = new Set(Object.values(tradesByPanel).map((t) => t.id))
    const match = candidates.find((t) => t.instrument === instrument && !assignedIds.has(t.id))

    if (match) {
      pendingAutoAssignRef.current = null
      setTradesByPanel((prev) => ({ ...prev, [panelIndex]: match }))
    }
  }, [positions, openWithPrices, tradesByPanel])

  const [orderTicket, setOrderTicket] = useState<OrderTicketState | null>(null)

  // Active panel's trade (for the editor hook + control bar)
  const activeTrade = tradesByPanel[activeIndex] ?? null

  // Price map from latest chart WS prices
  const priceMap = useMemo(() => {
    const map = new Map<string, PositionPriceTick>()
    if (chartPrices?.prices) {
      for (const tick of chartPrices.prices) {
        map.set(tick.instrument, tick)
      }
    }
    return map
  }, [chartPrices])

  // Live price for the active trade
  const activeLivePrice = useMemo(() => {
    if (!activeTrade) return null
    const tick = priceMap.get(activeTrade.instrument)
    if (!tick) return null
    // Use mid price to match candle data (OANDA candles use mid OHLC)
    return (tick.bid + tick.ask) / 2
  }, [activeTrade, priceMap])

  // Save function for the active panel's trade
  const saveFn = useCallback(
    async (stopLoss: number | null, takeProfit: number | null): Promise<boolean> => {
      if (!activeTrade || activeTrade._type === "closed") return false
      if (activeTrade._type === "open") {
        return modifyTrade(activeTrade.sourceTradeId, { stopLoss, takeProfit })
      }
      return modifyPendingOrder(activeTrade.sourceOrderId, { stopLoss, takeProfit })
    },
    [activeTrade, modifyTrade, modifyPendingOrder],
  )

  // Editor hook — only meaningful when the active panel has an editable trade
  const editor = useChartTradeEditor({
    instrument: activeTrade?.instrument ?? "EUR_USD",
    direction: activeTrade?.direction ?? "long",
    entryPrice: activeTrade?.entryPrice ?? 0,
    savedSL: activeTrade?.stopLoss ?? null,
    savedTP: activeTrade?.takeProfit ?? null,
    saveFn,
  })

  // Assign a trade to the active panel
  const assignTrade = useCallback(
    (trade: TradeUnion | null) => {
      setTradesByPanel((prev) => {
        const next = { ...prev }
        if (trade) {
          next[activeIndex] = trade
        } else {
          delete next[activeIndex]
        }
        return next
      })
    },
    [activeIndex],
  )

  // Build trade chart configs for ALL panels that have trades
  const tradeCharts = useMemo((): Record<number, TradeChartConfig> => {
    const result: Record<number, TradeChartConfig> = {}
    for (const [key, trade] of Object.entries(tradesByPanel)) {
      const index = Number(key)
      const tick = priceMap.get(trade.instrument)
      // Use mid price to match candle data (OANDA candles use mid OHLC)
      const price = tick ? (tick.bid + tick.ask) / 2 : null

      if (index === activeIndex) {
        // Active panel: use editor draft values + drag callbacks
        result[index] = {
          trade,
          currentPrice: price,
          draftSL: editor.draftSL,
          draftTP: editor.draftTP,
          onDraftChange: (lineType, p) => {
            if (lineType === "sl") editor.setDraftSL(p)
            else editor.setDraftTP(p)
          },
        }
      } else {
        // Non-active panels: read-only overlay with saved SL/TP
        result[index] = {
          trade,
          currentPrice: price,
          draftSL: trade.stopLoss,
          draftTP: trade.takeProfit,
          onDraftChange: NO_OP_DRAFT,
        }
      }
    }
    return result
  }, [tradesByPanel, priceMap, activeIndex, editor])

  // Clear a specific panel's trade (e.g. when user changes instrument)
  const clearPanelTrade = useCallback((index: number) => {
    setTradesByPanel((prev) => {
      const next = { ...prev }
      delete next[index]
      return next
    })
  }, [])

  // Set of trade IDs already assigned to panels (for picker indication)
  const assignedTradeIds = useMemo(
    () => new Set(Object.values(tradesByPanel).map((t) => t.id)),
    [tradesByPanel],
  )

  const handleLayoutChange = useCallback(
    (newLayout: Parameters<typeof setLayout>[0]) => {
      setLayout(newLayout)
      setTradesByPanel({})
      setActiveIndex(0)
      setOrderTicket(null)
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        /* ignore */
      }
    },
    [setLayout],
  )

  // ─── Order Ticket ────────────────────────────────────────────────────────

  const handleOrderEntry = useCallback((panelIndex: number, direction: TradeDirection) => {
    setActiveIndex(panelIndex)
    setOrderTicket({ direction, panelIndex })
  }, [])

  const handleCloseOrderTicket = useCallback(() => {
    setOrderTicket(null)
  }, [])

  const handlePlaceOrder = useCallback(
    async (request: PlaceOrderRequest): Promise<boolean> => {
      const result = await placeOrder(request)
      if (result !== null) {
        // Flag the target panel to receive the new trade once positions_update arrives.
        // By the time placeOrder() resolves, the daemon has already run two reconcile
        // cycles and broadcast positions_update — so positions in the context is likely
        // already updated. The reactive useEffect above will catch it on the next render.
        pendingAutoAssignRef.current = {
          panelIndex: orderTicket?.panelIndex ?? activeIndex,
          instrument: request.instrument,
        }
        // Belt-and-suspenders: explicitly ask the daemon to rebroadcast positions in
        // case there was a timing gap (e.g. order took longer than two reconcile cycles).
        void refreshPositions()
      }
      return result !== null
    },
    [placeOrder, refreshPositions, orderTicket, activeIndex],
  )

  // Active panel's live tick for the order ticket
  const orderTicketInstrument = orderTicket
    ? (layout.panels[orderTicket.panelIndex]?.instrument ?? "EUR_USD")
    : "EUR_USD"
  const orderTicketTick = useMemo(() => {
    if (!orderTicket) return null
    return priceMap.get(orderTicketInstrument) ?? null
  }, [orderTicket, orderTicketInstrument, priceMap])

  // Lifted order ticket hook — shared between panel UI and chart overlay lines
  const ticket = useOrderTicket({
    instrument: orderTicketInstrument,
    direction: orderTicket?.direction ?? "long",
    bid: orderTicketTick?.bid ?? null,
    ask: orderTicketTick?.ask ?? null,
    accountBalance: accountOverview?.summary.balance ?? 0,
    accountCurrency: accountOverview?.summary.currency ?? "USD",
    initialTimeframe: orderTicket
      ? ((layout.panels[orderTicket.panelIndex]?.timeframe ?? null) as Timeframe | null)
      : null,
  })

  // Sync chart line drags → ticket form state
  const handleOrderDraftChange = useCallback(
    (lineType: LineType, price: number) => {
      if (lineType === "entry") ticket.setEntryPrice(price)
      else if (lineType === "sl") {
        if (!ticket.slEnabled) ticket.setSlEnabled(true)
        ticket.setStopLoss(price)
      } else if (lineType === "tp") {
        if (!ticket.tpEnabled) ticket.setTpEnabled(true)
        ticket.setTakeProfit(price)
      }
    },
    [ticket],
  )

  // Build order overlay config from ticket hook state
  const orderOverlay: OrderOverlayConfig | null = useMemo(() => {
    if (!orderTicket) return null
    return {
      direction: orderTicket.direction,
      orderType: ticket.orderType,
      entryPrice: ticket.orderType === "LIMIT" ? ticket.entryPrice : null,
      stopLoss: ticket.stopLoss,
      takeProfit: ticket.takeProfit,
      onDraftChange: handleOrderDraftChange,
    }
  }, [
    orderTicket,
    ticket.orderType,
    ticket.entryPrice,
    ticket.stopLoss,
    ticket.takeProfit,
    handleOrderDraftChange,
  ])

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading charts...</p>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-var(--header-height))] flex-col overflow-hidden">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-2 border-b px-3 py-1.5">
        <h1 className="text-sm font-semibold">Charts</h1>
        {!isMobile && <LayoutSelector value={layout.layout} onChange={handleLayoutChange} />}
        <PositionPicker value={activeTrade} onChange={assignTrade} assignedIds={assignedTradeIds} />
      </header>

      {/* Trade control bar — shows editor for the active panel's trade */}
      {activeTrade && (
        <TradeControlBar
          trade={activeTrade}
          editor={editor}
          currentPrice={activeLivePrice}
          onClear={() => assignTrade(null)}
        />
      )}

      {/* Chart grid + order ticket */}
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-1 flex-col">
          <ErrorBoundary>
            {isMobile ? (
              <MobileChartSwiper
                panels={layout.panels}
                onPanelChange={setPanel}
                chartPrices={priceMap}
                tradeCharts={tradeCharts}
                onClearTrade={clearPanelTrade}
                onOrderEntry={handleOrderEntry}
                orderOverlay={orderOverlay}
                orderOverlayPanelIndex={orderTicket?.panelIndex}
              />
            ) : (
              <ChartGrid
                layout={layout.layout}
                panels={layout.panels}
                onPanelChange={setPanel}
                chartPrices={priceMap}
                activeIndex={activeIndex}
                onActiveChange={setActiveIndex}
                tradeCharts={tradeCharts}
                onClearTrade={clearPanelTrade}
                onOrderEntry={handleOrderEntry}
                orderOverlay={orderOverlay}
                orderOverlayPanelIndex={orderTicket?.panelIndex}
              />
            )}
          </ErrorBoundary>
        </div>
        {orderTicket && (
          <OrderTicketPanel
            instrument={orderTicketInstrument}
            direction={orderTicket.direction}
            bid={orderTicketTick?.bid ?? null}
            ask={orderTicketTick?.ask ?? null}
            accountBalance={accountOverview?.summary.balance ?? 0}
            accountCurrency={accountOverview?.summary.currency ?? "USD"}
            ticket={ticket}
            openTrades={openWithPrices}
            onClose={handleCloseOrderTicket}
            onSubmit={handlePlaceOrder}
          />
        )}
      </div>
    </div>
  )
}
