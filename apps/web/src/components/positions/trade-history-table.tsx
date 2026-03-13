"use client"

import { useState, useMemo } from "react"
import type { ClosedTradeData, AiAnalysisData } from "@fxflow/types"
import type { ActiveAnalysisProgress } from "@/hooks/use-active-ai-analyses"
import { formatCurrency, formatPips } from "@fxflow/shared"
import {
  Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table"
import { useIsMobile } from "@/hooks/use-is-mobile"
import { DirectionBadge } from "./direction-badge"
import { SourceBadge } from "./source-badge"
import { TimeframeSelect } from "./timeframe-select"
import { TagBadges } from "./tag-badges"
import { OutcomeBadge } from "./outcome-badge"
import { RiskRewardDisplay } from "./risk-reward-display"
import { DurationDisplay } from "./duration-display"
import { TradeCardMobile } from "./trade-card-mobile"
import { TradeDetailDrawer } from "./trade-detail-drawer"
import { AiAnalysisSheet } from "@/components/ai/ai-analysis-sheet"
import { Button } from "@/components/ui/button"
import { SortableHead, nextSort, compareValues, type SortState } from "./sortable-head"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AiAnalysisCell } from "./ai-analysis-cell"
import { MoreHorizontal, Eye, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface TradeHistoryTableProps {
  trades: ClosedTradeData[]
  currency?: string
  isLoading?: boolean
  totalCount: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  latestAnalysisByTradeId?: Record<string, AiAnalysisData>
  countByTradeId?: Record<string, number>
  activeAiByTradeId?: Record<string, ActiveAnalysisProgress>
  onTagMutated?: () => void
}

export function TradeHistoryTable({
  trades,
  currency = "USD",
  isLoading = false,
  totalCount,
  page,
  pageSize,
  onPageChange,
  latestAnalysisByTradeId,
  countByTradeId,
  activeAiByTradeId,
  onTagMutated,
}: TradeHistoryTableProps) {
  const isMobile = useIsMobile()
  const totalPages = Math.ceil(totalCount / pageSize)
  const [sort, setSort] = useState<SortState>({ key: "closedAt", direction: "desc" })
  const [drawerTrade, setDrawerTrade] = useState<ClosedTradeData | null>(null)
  const [aiAnalysisTrade, setAiAnalysisTrade] = useState<ClosedTradeData | null>(null)


  const handleSort = (key: string) => setSort(nextSort(sort, key))

  const sorted = useMemo(() => {
    return [...trades].sort((a, b) => {
      const key = sort.key
      let va: unknown, vb: unknown
      switch (key) {
        case "instrument": va = a.instrument; vb = b.instrument; break
        case "direction": va = a.direction; vb = b.direction; break
        case "source": va = a.source; vb = b.source; break
        case "timeframe": va = a.timeframe; vb = b.timeframe; break
        case "entryPrice": va = a.entryPrice; vb = b.entryPrice; break
        case "exitPrice": va = a.exitPrice; vb = b.exitPrice; break
        case "stopLoss": va = a.stopLoss; vb = b.stopLoss; break
        case "takeProfit": va = a.takeProfit; vb = b.takeProfit; break
        case "units": va = a.units; vb = b.units; break
        case "realizedPL": va = a.realizedPL; vb = b.realizedPL; break
        case "outcome": va = a.outcome; vb = b.outcome; break
        case "mfe": va = a.mfe; vb = b.mfe; break
        case "mae": va = a.mae; vb = b.mae; break
        case "duration": {
          const da = new Date(a.closedAt).getTime() - new Date(a.openedAt).getTime()
          const db = new Date(b.closedAt).getTime() - new Date(b.openedAt).getTime()
          va = da; vb = db; break
        }
        case "closedAt": va = a.closedAt; vb = b.closedAt; break
        case "tags": va = a.tags.length; vb = b.tags.length; break
        default: va = a.closedAt; vb = b.closedAt
      }
      return compareValues(va, vb, sort.direction)
    })
  }, [trades, sort])

  if (!isLoading && sorted.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        No trade history
      </div>
    )
  }

  if (isMobile) {
    return (
      <>
        <div className="space-y-3">
          {sorted.map((trade) => (
            <TradeCardMobile
              key={trade.id}
              variant="closed"
              data={trade}
              currency={currency}
              onViewDetails={() => setDrawerTrade(trade)}
            />
          ))}
          {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />}
        </div>
        <TradeDetailDrawer
          trade={drawerTrade ? { ...drawerTrade, _type: "closed" } : null}
          open={!!drawerTrade}
          onOpenChange={(open) => !open && setDrawerTrade(null)}
          currency={currency}
          onTagMutated={onTagMutated}
        />
      </>
    )
  }

  return (
    <>
      <div className="space-y-3">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Pair" sortKey="instrument" currentSort={sort} onSort={handleSort} />
              <SortableHead label="Dir" sortKey="direction" currentSort={sort} onSort={handleSort} title="Direction (Long or Short)" />
              <SortableHead label="Source" sortKey="source" currentSort={sort} onSort={handleSort} />
              <SortableHead label="TF" sortKey="timeframe" currentSort={sort} onSort={handleSort} title="Timeframe" />
              <SortableHead label="Entry" sortKey="entryPrice" currentSort={sort} onSort={handleSort} className="text-right" title="Entry Price" />
              <SortableHead label="Exit" sortKey="exitPrice" currentSort={sort} onSort={handleSort} className="text-right" title="Exit Price" />
              <SortableHead label="SL" sortKey="stopLoss" currentSort={sort} onSort={handleSort} className="text-right" title="Stop Loss" />
              <SortableHead label="TP" sortKey="takeProfit" currentSort={sort} onSort={handleSort} className="text-right" title="Take Profit" />
              <SortableHead label="Units" sortKey="units" currentSort={sort} onSort={handleSort} className="text-right" />
              <SortableHead label="P/L" sortKey="realizedPL" currentSort={sort} onSort={handleSort} className="text-right" title="Realized Profit / Loss" />
              <SortableHead label="R:R" sortKey="rr" currentSort={sort} onSort={handleSort} className="text-right" title="Risk / Reward Ratio" />
              <SortableHead label="Outcome" sortKey="outcome" currentSort={sort} onSort={handleSort} />
              <SortableHead label="MFE" sortKey="mfe" currentSort={sort} onSort={handleSort} className="text-right" title="Best Pip Run (Maximum Favorable Excursion)" />
              <SortableHead label="MAE" sortKey="mae" currentSort={sort} onSort={handleSort} className="text-right" title="Worst Drawdown (Maximum Adverse Excursion)" />
              <SortableHead label="Duration" sortKey="duration" currentSort={sort} onSort={handleSort} />
              <SortableHead label="Closed" sortKey="closedAt" currentSort={sort} onSort={handleSort} />
              <SortableHead label="Tags" sortKey="tags" currentSort={sort} onSort={handleSort} />
              <TableHead className="w-10">AI</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((trade) => {
              const plColor = trade.realizedPL >= 0 ? "text-status-connected" : "text-status-disconnected"

              return (
                <TableRow
                  key={trade.id}
                  className="cursor-pointer select-none"
                  onMouseDown={(e) => { if (e.button === 0) setDrawerTrade(trade) }}
                >
                  <TableCell className="text-xs font-medium">
                    {trade.instrument.replace("_", "/")}
                  </TableCell>
                  <TableCell><DirectionBadge direction={trade.direction} /></TableCell>
                  <TableCell><SourceBadge source={trade.source} /></TableCell>
                  <TableCell onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                    <TimeframeSelect
                      value={trade.timeframe}
                      onChange={async (tf) => {
                        await fetch(`/api/trades/${trade.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ timeframe: tf }),
                        })
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-xs text-right font-mono tabular-nums">{trade.entryPrice}</TableCell>
                  <TableCell className="text-xs text-right font-mono tabular-nums">{trade.exitPrice ?? "—"}</TableCell>
                  <TableCell className="text-xs text-right font-mono tabular-nums text-muted-foreground">
                    {trade.stopLoss ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-right font-mono tabular-nums text-muted-foreground">
                    {trade.takeProfit ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-right font-mono tabular-nums">{trade.units}</TableCell>
                  <TableCell className={cn("text-xs text-right font-mono tabular-nums font-semibold", plColor)}>
                    {formatCurrency(trade.realizedPL, currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    <RiskRewardDisplay
                      direction={trade.direction}
                      entryPrice={trade.entryPrice}
                      stopLoss={trade.stopLoss}
                      takeProfit={trade.takeProfit}
                      instrument={trade.instrument}
                      compact
                    />
                  </TableCell>
                  <TableCell>
                    <OutcomeBadge outcome={trade.outcome} closeReason={trade.closeReason} />
                  </TableCell>
                  <TableCell className="text-xs text-right font-mono tabular-nums">
                    {trade.mfe !== null ? (
                      <span className="text-status-connected">{formatPips(trade.mfe)}</span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-right font-mono tabular-nums">
                    {trade.mae !== null ? (
                      <span className="text-status-disconnected">{formatPips(Math.abs(trade.mae))}</span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    <DurationDisplay
                      openedAt={trade.openedAt}
                      closedAt={trade.closedAt}
                      className="font-mono tabular-nums"
                    />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(trade.closedAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell>
                    <TagBadges tags={trade.tags} />
                  </TableCell>
                  <TableCell onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                    <AiAnalysisCell
                      latestAnalysis={latestAnalysisByTradeId?.[trade.id]}
                      analysisCount={countByTradeId?.[trade.id]}
                      activeProgress={activeAiByTradeId?.[trade.id]}
                      onClick={() => setAiAnalysisTrade(trade)}
                    />
                  </TableCell>
                  <TableCell onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="size-7 p-0">
                          <MoreHorizontal className="size-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setDrawerTrade(trade)}>
                          <Eye className="size-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setAiAnalysisTrade(trade)}>
                          <Sparkles className="size-4" />
                          AI Analysis
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />}
      </div>

      <TradeDetailDrawer
        trade={drawerTrade ? { ...drawerTrade, _type: "closed" } : null}
        open={!!drawerTrade}
        onOpenChange={(open) => !open && setDrawerTrade(null)}
        currency={currency}
        onTagMutated={onTagMutated}
      />
      <AiAnalysisSheet
        trade={aiAnalysisTrade}
        tradeStatus="closed"
        open={!!aiAnalysisTrade}
        onOpenChange={(open) => !open && setAiAnalysisTrade(null)}
      />
    </>
  )
}

function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}) {
  return (
    <div className="flex items-center justify-between px-2">
      <span className="text-xs text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
