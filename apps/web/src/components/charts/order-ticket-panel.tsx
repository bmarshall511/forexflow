"use client"

import { useState, useCallback, useRef, useMemo } from "react"
import {
  X, ArrowUp, ArrowDown, Loader2, Plus,
  BarChart3, DollarSign, Shield, Ruler, FileText, Clock, Tag,
} from "lucide-react"
import type { TradeDirection, PlaceOrderRequest, Timeframe, TradeTagData } from "@fxflow/types"
import {
  formatInstrument,
  formatPips,
  formatCurrency,
  getDecimalPlaces,
  getPipSize,
  TIMEFRAME_OPTIONS,
} from "@fxflow/shared"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-is-mobile"
import { useTags } from "@/hooks/use-tags"
import { LOT_UNITS } from "@/hooks/use-order-ticket"
import type { UseOrderTicketReturn, UnitsMode } from "@/hooks/use-order-ticket"
import type { PlaceableOrderType } from "@fxflow/types"
import { TagEditor } from "@/components/positions/tag-editor"

// ─── Props ───────────────────────────────────────────────────────────────────

interface OrderTicketPanelProps {
  instrument: string
  direction: TradeDirection
  bid: number | null
  ask: number | null
  accountBalance: number
  accountCurrency: string
  /** Pre-created hook return — lifted to page level for chart overlay sync */
  ticket: UseOrderTicketReturn
  onClose: () => void
  onSubmit: (request: PlaceOrderRequest) => Promise<boolean>
}

// ─── Preset Values ───────────────────────────────────────────────────────────

const UNIT_PRESETS = [1_000, 5_000, 10_000, 50_000, 100_000]
const RISK_PRESETS = [0.5, 1, 2, 5]

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({
  icon: Icon,
  title,
  helper,
  children,
}: {
  icon: React.ElementType
  title: string
  helper?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-card">
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
        <Icon className="size-3.5 text-muted-foreground shrink-0" />
        <span className="text-[11px] font-medium text-muted-foreground">{title}</span>
      </div>
      {helper && (
        <p className="text-[10px] text-muted-foreground/60 px-3 leading-tight">{helper}</p>
      )}
      <div className="px-3 pb-3 pt-1.5">{children}</div>
    </div>
  )
}

// ─── Panel Content ───────────────────────────────────────────────────────────

function OrderTicketContent({
  instrument,
  direction,
  bid,
  ask,
  accountBalance,
  accountCurrency,
  ticket,
  onClose,
  onSubmit,
}: OrderTicketPanelProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { tags: allTags, createTag } = useTags()
  const isBuy = direction === "long"
  const decimals = getDecimalPlaces(instrument)
  const pipSize = getPipSize(instrument)
  const step = pipSize * 0.1

  // Convert selectedTagIds to TradeTagData[] for TagEditor compatibility
  const selectedTradeTagData: TradeTagData[] = useMemo(() => {
    return ticket.selectedTagIds
      .map((id) => {
        const tag = allTags.find((t) => t.id === id)
        if (!tag) return null
        return { tagId: id, tag, assignedAt: new Date().toISOString() }
      })
      .filter((v): v is TradeTagData => v !== null)
  }, [ticket.selectedTagIds, allTags])

  // Cache last known bid/ask to prevent price bar flickering when live price
  // temporarily goes null (e.g. brief WebSocket reconnect)
  const lastPricesRef = useRef<{ instrument: string; bid: number | null; ask: number | null }>({
    instrument: "",
    bid: null,
    ask: null,
  })
  if (lastPricesRef.current.instrument !== instrument) {
    lastPricesRef.current = { instrument, bid: null, ask: null }
  }
  if (bid !== null) lastPricesRef.current.bid = bid
  if (ask !== null) lastPricesRef.current.ask = ask
  const displayBid = bid ?? lastPricesRef.current.bid
  const displayAsk = ask ?? lastPricesRef.current.ask

  const buttonLabel = useMemo(() => {
    const orderTypeLabel = ticket.orderType === "MARKET" ? "Market" : "Limit"
    const dirLabel = isBuy ? "Buy" : "Sell"
    return `Place ${orderTypeLabel} ${dirLabel}`
  }, [ticket.orderType, isBuy])

  const handleSubmit = useCallback(async () => {
    if (!ticket.isValid || isSubmitting) return
    setIsSubmitting(true)
    try {
      const request: PlaceOrderRequest = {
        instrument,
        direction,
        orderType: ticket.orderType,
        units: ticket.units,
        stopLoss: ticket.stopLoss,
        takeProfit: ticket.takeProfit,
        timeframe: ticket.timeframe,
        notes: ticket.notes || null,
        tagIds: ticket.selectedTagIds.length > 0 ? ticket.selectedTagIds : undefined,
        placedVia: "fxflow",
        ...(ticket.orderType === "LIMIT" && ticket.entryPrice !== null
          ? { entryPrice: ticket.entryPrice }
          : {}),
      }
      const success = await onSubmit(request)
      if (success) onClose()
    } finally {
      setIsSubmitting(false)
    }
  }, [ticket, instrument, direction, isSubmitting, onSubmit, onClose])

  const directionColor = isBuy ? "text-blue-500" : "text-red-500"
  const directionBg = isBuy ? "bg-blue-500" : "bg-red-500"
  const directionBgMuted = isBuy ? "bg-blue-500/10" : "bg-red-500/10"

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={cn("flex items-center justify-between px-4 py-3 border-b", directionBgMuted)}>
        <div className="flex items-center gap-2">
          {isBuy ? (
            <ArrowUp className="size-4 text-blue-500" />
          ) : (
            <ArrowDown className="size-4 text-red-500" />
          )}
          <h2 className={cn("text-sm font-semibold", directionColor)}>
            {isBuy ? "Buy" : "Sell"} {formatInstrument(instrument)}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close order ticket"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Scrollable body */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-3 p-3">

          {/* Live price bar */}
          <div className="flex items-center justify-between rounded-lg border p-2.5">
            <div className="flex flex-col items-center flex-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Bid</span>
              <span className="text-sm font-mono tabular-nums font-medium text-red-500">
                {displayBid !== null ? displayBid.toFixed(decimals) : "—"}
              </span>
            </div>
            <div className="flex flex-col items-center px-3">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Spread</span>
              <span className="text-xs font-mono tabular-nums text-muted-foreground">
                {ticket.spreadPips !== null ? `${formatPips(ticket.spreadPips)} pips` : "—"}
              </span>
            </div>
            <div className="flex flex-col items-center flex-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Ask</span>
              <span className="text-sm font-mono tabular-nums font-medium text-blue-500">
                {displayAsk !== null ? displayAsk.toFixed(decimals) : "—"}
              </span>
            </div>
          </div>

          {/* Order type */}
          <SectionCard
            icon={BarChart3}
            title="Order Type"
            helper="Limit lets you set your price. Market executes instantly."
          >
            <Tabs
              value={ticket.orderType}
              onValueChange={(v) => ticket.setOrderType(v as PlaceableOrderType)}
            >
              <TabsList className="w-full">
                <TabsTrigger value="LIMIT" className="flex-1">Limit</TabsTrigger>
                <TabsTrigger value="MARKET" className="flex-1">Market</TabsTrigger>
              </TabsList>
            </Tabs>
          </SectionCard>

          {/* Entry price (LIMIT only) */}
          {ticket.orderType === "LIMIT" && (
            <SectionCard
              icon={DollarSign}
              title="Entry Price"
              helper="The price you want to enter at. Your order waits until this price is reached."
            >
              <Input
                type="number"
                step={step}
                value={ticket.entryPrice ?? ""}
                onChange={(e) => {
                  const val = e.target.value === "" ? null : parseFloat(e.target.value)
                  ticket.setEntryPrice(val !== null && isNaN(val) ? null : val)
                }}
                placeholder={ticket.effectiveEntryPrice?.toFixed(decimals) ?? "Price"}
                className={cn(
                  "font-mono tabular-nums",
                  ticket.validationErrors.entryPrice && "border-destructive",
                )}
                aria-label="Limit entry price"
                aria-invalid={!!ticket.validationErrors.entryPrice}
              />
              {ticket.validationErrors.entryPrice && (
                <p className="text-[10px] text-destructive mt-1">{ticket.validationErrors.entryPrice}</p>
              )}
            </SectionCard>
          )}

          {/* Timeframe */}
          <SectionCard
            icon={Clock}
            title="Chart Timeframe"
            helper="Which chart timeframe is this trade idea based on?"
          >
            <Select
              value={ticket.timeframe ?? ""}
              onValueChange={(v) => ticket.setTimeframe((v || null) as Timeframe | null)}
            >
              <SelectTrigger aria-label="Select order timeframe">
                <SelectValue placeholder="Select timeframe..." />
              </SelectTrigger>
              <SelectContent>
                {TIMEFRAME_OPTIONS.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SectionCard>

          {/* Protection (SL / TP) */}
          <SectionCard
            icon={Shield}
            title="Protection"
            helper="Stop Loss limits your loss. Take Profit locks in your gain."
          >
            <div className="space-y-2.5">
              {/* Stop Loss */}
              {ticket.slEnabled ? (
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground w-[70px] shrink-0">Stop Loss</span>
                    <Input
                      type="number"
                      step={step}
                      value={ticket.stopLoss ?? ""}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value)
                        if (!isNaN(val)) ticket.setStopLoss(val)
                      }}
                      className={cn(
                        "h-8 font-mono tabular-nums flex-1",
                        ticket.validationErrors.stopLoss && "border-destructive",
                      )}
                      aria-label="Stop loss price"
                      aria-invalid={!!ticket.validationErrors.stopLoss}
                    />
                    {ticket.slPips !== null && (
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap w-12 text-right">
                        {formatPips(ticket.slPips)}p
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => ticket.setSlEnabled(false)}
                      className="p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Remove stop loss"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                  {ticket.validationErrors.stopLoss && (
                    <p className="text-[10px] text-destructive mt-1 ml-[78px]">{ticket.validationErrors.stopLoss}</p>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => ticket.setSlEnabled(true)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                  aria-label="Add stop loss"
                >
                  <Plus className="size-3.5" />
                  Add Stop Loss
                </button>
              )}

              {/* Take Profit */}
              {ticket.tpEnabled ? (
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground w-[70px] shrink-0">Take Profit</span>
                    <Input
                      type="number"
                      step={step}
                      value={ticket.takeProfit ?? ""}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value)
                        if (!isNaN(val)) ticket.setTakeProfit(val)
                      }}
                      className={cn(
                        "h-8 font-mono tabular-nums flex-1",
                        ticket.validationErrors.takeProfit && "border-destructive",
                      )}
                      aria-label="Take profit price"
                      aria-invalid={!!ticket.validationErrors.takeProfit}
                    />
                    {ticket.tpPips !== null && (
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap w-12 text-right">
                        {formatPips(ticket.tpPips)}p
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => ticket.setTpEnabled(false)}
                      className="p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Remove take profit"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                  {ticket.validationErrors.takeProfit && (
                    <p className="text-[10px] text-destructive mt-1 ml-[78px]">{ticket.validationErrors.takeProfit}</p>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => ticket.setTpEnabled(true)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                  aria-label="Add take profit"
                >
                  <Plus className="size-3.5" />
                  Add Take Profit
                </button>
              )}

              {/* Risk:Reward (when both SL and TP are active) */}
              {ticket.riskReward?.ratio && (
                <div className="flex items-center justify-between pt-1 border-t border-border/30">
                  <span className="text-[10px] text-muted-foreground">Risk : Reward</span>
                  <span className="text-xs font-mono tabular-nums font-medium">{ticket.riskReward.ratio}</span>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Trade size */}
          <SectionCard
            icon={Ruler}
            title="Trade Size"
            helper="How much to trade. 1,000 units = 0.01 lots (micro lot)."
          >
            <div>
              <div className="flex items-center justify-end mb-1.5">
                <div className="flex items-center rounded-md border text-[10px]">
                  {(["units", "lots", "risk"] as UnitsMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => ticket.setUnitsMode(mode)}
                      className={cn(
                        "px-2 py-0.5 capitalize transition-colors",
                        ticket.unitsMode === mode
                          ? "bg-muted text-foreground font-medium"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      aria-pressed={ticket.unitsMode === mode}
                    >
                      {mode === "risk" ? "risk %" : mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Units / Lots input */}
              {ticket.unitsMode !== "risk" ? (
                <>
                  <Input
                    type="number"
                    min={1}
                    value={ticket.units}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10)
                      if (!isNaN(val)) ticket.setUnits(val)
                    }}
                    className={cn(
                      "font-mono tabular-nums",
                      ticket.validationErrors.units && "border-destructive",
                    )}
                    aria-label={`Order size in ${ticket.unitsMode}`}
                    aria-invalid={!!ticket.validationErrors.units}
                  />
                  {/* Presets */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {ticket.unitsMode === "units"
                      ? UNIT_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => ticket.setUnits(preset)}
                            className={cn(
                              "px-2 py-0.5 text-[10px] rounded border transition-colors",
                              ticket.units === preset
                                ? "border-foreground/30 bg-muted text-foreground"
                                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50",
                            )}
                          >
                            {preset >= 1000 ? `${preset / 1000}K` : preset}
                          </button>
                        ))
                      : (Object.entries(LOT_UNITS) as [string, number][]).map(([name, size]) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => ticket.setUnits(size)}
                            className={cn(
                              "px-2 py-0.5 text-[10px] rounded border transition-colors capitalize",
                              ticket.units === size
                                ? "border-foreground/30 bg-muted text-foreground"
                                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50",
                            )}
                          >
                            {name}
                          </button>
                        ))}
                  </div>
                </>
              ) : (
                /* Risk mode */
                <>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={ticket.riskPercent}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value)
                        if (!isNaN(val)) ticket.setRiskPercent(val)
                      }}
                      className="font-mono tabular-nums w-20"
                      aria-label="Risk percentage"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      = {formatCurrency(accountBalance * (ticket.riskPercent / 100), accountCurrency)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {RISK_PRESETS.map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => ticket.setRiskPercent(pct)}
                        className={cn(
                          "px-2 py-0.5 text-[10px] rounded border transition-colors",
                          ticket.riskPercent === pct
                            ? "border-foreground/30 bg-muted text-foreground"
                            : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50",
                        )}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                  {ticket.validationErrors.units && (
                    <p className="text-[10px] text-destructive mt-1">{ticket.validationErrors.units}</p>
                  )}
                  <div className="text-[10px] text-muted-foreground mt-1">
                    Calculated units: <span className="font-mono tabular-nums font-medium text-foreground">{ticket.units.toLocaleString()}</span>
                  </div>
                </>
              )}
            </div>
          </SectionCard>

          {/* Notes */}
          <SectionCard
            icon={FileText}
            title="Trade Notes"
            helper="Why are you taking this trade? Record your reasoning."
          >
            <Textarea
              placeholder="e.g. Breakout above resistance, RSI oversold..."
              value={ticket.notes}
              onChange={(e) => ticket.setNotes(e.target.value)}
              className="min-h-16 resize-none text-xs"
              rows={2}
              aria-label="Trade notes"
            />
          </SectionCard>

          {/* Tags */}
          <SectionCard
            icon={Tag}
            title="Tags"
            helper="Categorize this trade for easy filtering later."
          >
            <TagEditor
              assignedTags={selectedTradeTagData}
              allTags={allTags}
              onAssign={(tagId) => ticket.addTag(tagId)}
              onRemove={(tagId) => ticket.removeTag(tagId)}
              onCreate={async (name, color) => {
                const tag = await createTag(name, color)
                if (tag) ticket.addTag(tag.id)
                return tag
              }}
            />
          </SectionCard>

          {/* Order summary */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
            <SummaryRow label="Direction" value={isBuy ? "Long" : "Short"} className={directionColor} />
            <SummaryRow label="Units" value={ticket.units.toLocaleString()} />
            <SummaryRow
              label="Entry"
              value={
                ticket.orderType === "MARKET"
                  ? `Market (${ticket.effectiveEntryPrice?.toFixed(decimals) ?? "—"})`
                  : ticket.entryPrice?.toFixed(decimals) ?? "—"
              }
            />
            {ticket.slEnabled && ticket.slPips !== null && (
              <SummaryRow label="SL distance" value={`${formatPips(ticket.slPips)} pips`} />
            )}
            {ticket.tpEnabled && ticket.tpPips !== null && (
              <SummaryRow label="TP distance" value={`${formatPips(ticket.tpPips)} pips`} />
            )}
            {ticket.riskReward?.ratio && (
              <SummaryRow label="Risk:Reward" value={ticket.riskReward.ratio} />
            )}
            {ticket.timeframe && (
              <SummaryRow
                label="Timeframe"
                value={TIMEFRAME_OPTIONS.find((o) => o.value === ticket.timeframe)?.label ?? ticket.timeframe}
              />
            )}
            {ticket.notes && (
              <SummaryRow label="Notes" value="Attached" />
            )}
            {ticket.selectedTagIds.length > 0 && (
              <SummaryRow label="Tags" value={`${ticket.selectedTagIds.length} selected`} />
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Execute button */}
      <div className="p-3 border-t">
        <Button
          onClick={handleSubmit}
          disabled={!ticket.isValid || isSubmitting || ticket.effectiveEntryPrice === null}
          className={cn("w-full h-11 text-sm font-semibold text-white", directionBg, `hover:${directionBg}/90`)}
          aria-label={`${buttonLabel} order for ${formatInstrument(instrument)}`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin mr-2" />
              Placing Order...
            </>
          ) : (
            buttonLabel
          )}
        </Button>
      </div>
    </div>
  )
}

// ─── Summary Row ─────────────────────────────────────────────────────────────

function SummaryRow({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className={cn("text-xs font-mono tabular-nums", className)}>{value}</span>
    </div>
  )
}

// ─── Responsive Wrapper ──────────────────────────────────────────────────────

export function OrderTicketPanel(props: OrderTicketPanelProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Sheet open onOpenChange={(open) => { if (!open) props.onClose() }}>
        <SheetContent side="bottom" className="h-[85vh] p-0" showCloseButton={false}>
          <SheetHeader className="sr-only">
            <SheetTitle>Order Ticket</SheetTitle>
          </SheetHeader>
          <OrderTicketContent {...props} />
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <div className="w-80 border-l bg-background flex flex-col shrink-0 h-full">
      <OrderTicketContent {...props} />
    </div>
  )
}
