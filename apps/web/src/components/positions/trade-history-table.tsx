"use client"

import { useState, useMemo } from "react"
import type { ClosedTradeData, AiAnalysisData } from "@fxflow/types"
import type { ActiveAnalysisProgress } from "@/hooks/use-active-ai-analyses"
import { Table, TableHeader, TableHead, TableBody, TableRow } from "@/components/ui/table"
import { useIsMobile } from "@/hooks/use-is-mobile"
import { TradeCardMobile } from "./trade-card-mobile"
import { TradeHistoryRow } from "./trade-history-row"
import { TradeDetailDrawer } from "./trade-detail-drawer"
import { AiAnalysisSheet } from "@/components/ai/ai-analysis-sheet"
import { Button } from "@/components/ui/button"
import { SortableHead, nextSort, compareValues, type SortState } from "./sortable-head"
import { Checkbox } from "@/components/ui/checkbox"
import { useBulkSelection } from "@/hooks/use-bulk-selection"
import { BulkActionBar } from "./bulk-action-bar"

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
  const bulk = useBulkSelection<ClosedTradeData>()

  const handleSort = (key: string) => setSort(nextSort(sort, key))

  const sorted = useMemo(() => {
    return [...trades].sort((a, b) => {
      const key = sort.key
      let va: unknown, vb: unknown
      switch (key) {
        case "instrument":
          va = a.instrument
          vb = b.instrument
          break
        case "direction":
          va = a.direction
          vb = b.direction
          break
        case "source":
          va = a.source
          vb = b.source
          break
        case "timeframe":
          va = a.timeframe
          vb = b.timeframe
          break
        case "entryPrice":
          va = a.entryPrice
          vb = b.entryPrice
          break
        case "exitPrice":
          va = a.exitPrice
          vb = b.exitPrice
          break
        case "stopLoss":
          va = a.stopLoss
          vb = b.stopLoss
          break
        case "takeProfit":
          va = a.takeProfit
          vb = b.takeProfit
          break
        case "units":
          va = a.units
          vb = b.units
          break
        case "realizedPL":
          va = a.realizedPL
          vb = b.realizedPL
          break
        case "outcome":
          va = a.outcome
          vb = b.outcome
          break
        case "mfe":
          va = a.mfe
          vb = b.mfe
          break
        case "mae":
          va = a.mae
          vb = b.mae
          break
        case "duration": {
          const da = new Date(a.closedAt).getTime() - new Date(a.openedAt).getTime()
          const db = new Date(b.closedAt).getTime() - new Date(b.openedAt).getTime()
          va = da
          vb = db
          break
        }
        case "closedAt":
          va = a.closedAt
          vb = b.closedAt
          break
        case "tags":
          va = a.tags.length
          vb = b.tags.length
          break
        default:
          va = a.closedAt
          vb = b.closedAt
      }
      return compareValues(va, vb, sort.direction)
    })
  }, [trades, sort])

  if (!isLoading && sorted.length === 0) {
    return <div className="text-muted-foreground py-12 text-center text-sm">No trade history</div>
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
          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
          )}
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
              <TableHead className="w-10">
                <Checkbox
                  checked={
                    bulk.isAllSelected(sorted)
                      ? true
                      : bulk.isSomeSelected(sorted)
                        ? "indeterminate"
                        : false
                  }
                  onCheckedChange={() => bulk.toggleAll(sorted)}
                  aria-label="Select all trades"
                />
              </TableHead>
              <SortableHead
                label="Pair"
                sortKey="instrument"
                currentSort={sort}
                onSort={handleSort}
              />
              <SortableHead
                label="Dir"
                sortKey="direction"
                currentSort={sort}
                onSort={handleSort}
                title="Direction (Long or Short)"
              />
              <SortableHead
                label="Source"
                sortKey="source"
                currentSort={sort}
                onSort={handleSort}
              />
              <SortableHead
                label="TF"
                sortKey="timeframe"
                currentSort={sort}
                onSort={handleSort}
                title="Timeframe"
              />
              <SortableHead
                label="Entry"
                sortKey="entryPrice"
                currentSort={sort}
                onSort={handleSort}
                className="text-right"
                title="Entry Price"
              />
              <SortableHead
                label="Exit"
                sortKey="exitPrice"
                currentSort={sort}
                onSort={handleSort}
                className="text-right"
                title="Exit Price"
              />
              <SortableHead
                label="SL"
                sortKey="stopLoss"
                currentSort={sort}
                onSort={handleSort}
                className="text-right"
                title="Stop Loss"
              />
              <SortableHead
                label="TP"
                sortKey="takeProfit"
                currentSort={sort}
                onSort={handleSort}
                className="text-right"
                title="Take Profit"
              />
              <SortableHead
                label="Units"
                sortKey="units"
                currentSort={sort}
                onSort={handleSort}
                className="text-right"
              />
              <SortableHead
                label="P/L"
                sortKey="realizedPL"
                currentSort={sort}
                onSort={handleSort}
                className="text-right"
                title="Realized Profit / Loss"
              />
              <SortableHead
                label="R:R"
                sortKey="rr"
                currentSort={sort}
                onSort={handleSort}
                className="text-right"
                title="Risk / Reward Ratio"
              />
              <SortableHead
                label="Outcome"
                sortKey="outcome"
                currentSort={sort}
                onSort={handleSort}
              />
              <SortableHead
                label="MFE"
                sortKey="mfe"
                currentSort={sort}
                onSort={handleSort}
                className="text-right"
                title="Best Pip Run (Maximum Favorable Excursion)"
              />
              <SortableHead
                label="MAE"
                sortKey="mae"
                currentSort={sort}
                onSort={handleSort}
                className="text-right"
                title="Worst Drawdown (Maximum Adverse Excursion)"
              />
              <SortableHead
                label="Duration"
                sortKey="duration"
                currentSort={sort}
                onSort={handleSort}
              />
              <SortableHead
                label="Closed"
                sortKey="closedAt"
                currentSort={sort}
                onSort={handleSort}
              />
              <SortableHead label="Tags" sortKey="tags" currentSort={sort} onSort={handleSort} />
              <TableHead className="w-10">AI</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((trade) => (
              <TradeHistoryRow
                key={trade.id}
                trade={trade}
                currency={currency}
                isSelected={bulk.isSelected(trade.id)}
                latestAnalysis={latestAnalysisByTradeId?.[trade.id]}
                analysisCount={countByTradeId?.[trade.id]}
                activeProgress={activeAiByTradeId?.[trade.id]}
                onToggleSelect={() => bulk.toggle(trade.id)}
                onViewDetails={() => setDrawerTrade(trade)}
                onAiAnalysis={() => setAiAnalysisTrade(trade)}
                onTimeframeChange={async (tf) => {
                  await fetch(`/api/trades/${trade.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ timeframe: tf }),
                  })
                }}
              />
            ))}
          </TableBody>
        </Table>
        {totalPages > 1 && (
          <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
        )}
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
      <BulkActionBar count={bulk.count} type="closed" onClear={bulk.clear} />
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
      <span className="text-muted-foreground text-xs">
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
