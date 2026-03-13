"use client"

import { useState, useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import type { TradeDirection } from "@fxflow/types"
import { formatCurrency } from "@fxflow/shared"
import { usePositions } from "@/hooks/use-positions"
import { usePositionsHistory } from "@/hooks/use-positions-history"
import { useDaemonStatus } from "@/hooks/use-daemon-status"
import { useTags } from "@/hooks/use-tags"
import { useTradeTagsBatch } from "@/hooks/use-trade-tags-batch"
import { useTradeAnalysesBatch } from "@/hooks/use-trade-analyses-batch"
import { useActiveAiAnalyses } from "@/hooks/use-active-ai-analyses"
import { Button } from "@/components/ui/button"
import { TabNav, TabNavButton } from "@/components/ui/tab-nav"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Trash2, Clock, TrendingUp, CircleDot } from "lucide-react"
import { toast } from "sonner"
import { OverviewCards } from "@/components/positions/overview-cards"
import { TradeCardList } from "@/components/positions/trade-card-list"
import { PositionsFilterBar } from "@/components/positions/positions-filter-bar"
import { cn } from "@/lib/utils"

type Tab = "pending" | "open" | "history"

export default function PositionsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tab = (searchParams.get("tab") ?? "open") as Tab
  const { accountOverview, positions: rawPositions, setPositions } = useDaemonStatus()
  const { positions, summary, pricesByInstrument, openWithPrices } = usePositions()
  const history = usePositionsHistory()
  const { tags } = useTags()

  const currency = accountOverview?.summary.currency ?? "USD"
  const totalUnrealizedPL = openWithPrices.reduce((s, t) => s + t.unrealizedPL, 0)

  // Batch tags for pending + open trades
  const liveTradeIds = useMemo(() => {
    if (!positions) return []
    return [
      ...positions.pending.map((o) => o.id),
      ...positions.open.map((t) => t.id),
    ]
  }, [positions])
  const { tagsByTradeId, refetch: refetchTags } = useTradeTagsBatch(liveTradeIds)

  // Batch latest analysis + counts for live trades
  const { latestByTradeId: liveAnalyses, countByTradeId: liveCounts } = useTradeAnalysesBatch(liveTradeIds)

  // Batch latest analysis + counts for history trades (current page)
  const historyTradeIds = useMemo(() => history.trades.map((t) => t.id), [history.trades])
  const { latestByTradeId: historyAnalyses, countByTradeId: historyCounts } = useTradeAnalysesBatch(historyTradeIds)

  // Track in-progress AI analyses via WebSocket events
  const activeAiByTradeId = useActiveAiAnalyses()

  // Deep-link: open AI sheet for a specific trade when ?openAnalysis=tradeId is set
  const openAnalysisId = searchParams.get("openAnalysis")
  const triggerOpenAiTrade = useMemo(() => {
    if (!openAnalysisId || !positions) return null
    return openWithPrices.find((t) => t.id === openAnalysisId) ?? null
  }, [openAnalysisId, openWithPrices, positions])
  const triggerPendingAiTrade = useMemo(() => {
    if (!openAnalysisId || !positions) return null
    return positions.pending.find((o) => o.id === openAnalysisId) ?? null
  }, [openAnalysisId, positions])

  // Local filters for pending/open tabs
  const [pendingInstrument, setPendingInstrument] = useState("")
  const [pendingDirection, setPendingDirection] = useState<TradeDirection | "">("")
  const [pendingTagIds, setPendingTagIds] = useState<string[]>([])
  const [openInstrument, setOpenInstrument] = useState("")
  const [openDirection, setOpenDirection] = useState<TradeDirection | "">("")
  const [openTagIds, setOpenTagIds] = useState<string[]>([])

  // Filter pending orders by selected tags (client-side)
  const filteredPending = useMemo(() => {
    if (!positions || pendingTagIds.length === 0) return positions?.pending ?? []
    return positions.pending.filter((o) => {
      const tags = tagsByTradeId[o.id] ?? o.tags
      return pendingTagIds.every((tid) => tags.some((t) => t.tagId === tid))
    })
  }, [positions, pendingTagIds, tagsByTradeId])

  // Filter open trades by selected tags (client-side)
  const filteredOpen = useMemo(() => {
    if (openTagIds.length === 0) return openWithPrices
    return openWithPrices.filter((t) => {
      const tags = tagsByTradeId[t.id] ?? t.tags
      return openTagIds.every((tid) => tags.some((tt) => tt.tagId === tid))
    })
  }, [openWithPrices, openTagIds, tagsByTradeId])

  // Derive active instruments for filter dropdowns
  const instruments = useMemo(() => {
    if (!positions) return []
    const set = new Set<string>()
    positions.pending.forEach((o) => set.add(o.instrument))
    positions.open.forEach((t) => set.add(t.instrument))
    positions.closed.forEach((t) => set.add(t.instrument))
    return Array.from(set).sort()
  }, [positions])

  const [clearingHistory, setClearingHistory] = useState(false)

  const handleClearHistory = async () => {
    setClearingHistory(true)
    try {
      const res = await fetch("/api/trades", { method: "DELETE" })
      const json = await res.json()
      if (json.ok) {
        const count: number = json.data?.count ?? 0
        toast.success(`Cleared ${count} closed trade${count !== 1 ? "s" : ""}`)
        if (rawPositions) setPositions({ ...rawPositions, closed: [] })
        history.refetch()
        fetch(`${process.env.NEXT_PUBLIC_DAEMON_REST_URL ?? "http://localhost:4100"}/actions/refresh-positions`, {
          method: "POST",
        }).catch(() => {})
      } else {
        toast.error("Failed to clear trade history")
      }
    } catch {
      toast.error("Failed to clear trade history")
    } finally {
      setClearingHistory(false)
    }
  }

  const setTab = (value: Tab) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", value)
    router.replace(`/positions?${params.toString()}`, { scroll: false })
  }

  const isPositivePL = totalUnrealizedPL >= 0.005
  const isNegativePL = totalUnrealizedPL <= -0.005

  return (
    <div className="min-h-screen">
      {/* ─── Hero Header ─── */}
      <div className={cn(
        "px-4 md:px-6 pt-6 pb-8 border-b",
        isPositivePL ? "bg-green-500/[0.02]" : isNegativePL ? "bg-red-500/[0.02]" : "",
      )}>
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My Trades</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track your orders, see how open trades are doing, and review past results
            </p>
          </div>
          {/* Live P/L hero number */}
          {summary.openCount > 0 && (
            <div className="text-right shrink-0">
              <div className={cn(
                "text-3xl font-bold font-mono tabular-nums tracking-tight",
                isPositivePL ? "text-green-500" : isNegativePL ? "text-red-500" : "text-muted-foreground",
              )}>
                {isPositivePL ? "+" : ""}{formatCurrency(totalUnrealizedPL, currency)}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                open P/L across {summary.openCount} trade{summary.openCount !== 1 ? "s" : ""}
              </div>
            </div>
          )}
        </div>

        <OverviewCards
          positions={positions}
          openWithPrices={openWithPrices}
          currency={currency}
        />
      </div>

      {/* ─── Tab Navigation ─── */}
      <TabNav label="Trade sections">
        <TabNavButton
          active={tab === "pending"}
          onClick={() => setTab("pending")}
          icon={<Clock className="size-3.5" />}
          label="Waiting"
          count={summary.pendingCount}
        />
        <TabNavButton
          active={tab === "open"}
          onClick={() => setTab("open")}
          icon={<CircleDot className="size-3.5" />}
          label="Live"
          count={summary.openCount}
          pulse={summary.openCount > 0}
        />
        <TabNavButton
          active={tab === "history"}
          onClick={() => setTab("history")}
          icon={<TrendingUp className="size-3.5" />}
          label="Closed"
          count={summary.closedTodayCount}
        />
      </TabNav>

      {/* ─── Tab Content ─── */}
      <div className="px-4 md:px-6 py-6 space-y-4">
        {/* Filter bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            {tab === "pending" && (
              <PositionsFilterBar
                tab="pending"
                instruments={instruments}
                instrumentFilter={pendingInstrument}
                directionFilter={pendingDirection}
                onInstrumentChange={setPendingInstrument}
                onDirectionChange={setPendingDirection}
                tags={tags}
                tagIds={pendingTagIds}
                onTagIdsChange={setPendingTagIds}
              />
            )}
            {tab === "open" && (
              <PositionsFilterBar
                tab="open"
                instruments={instruments}
                instrumentFilter={openInstrument}
                directionFilter={openDirection}
                onInstrumentChange={setOpenInstrument}
                onDirectionChange={setOpenDirection}
                tags={tags}
                tagIds={openTagIds}
                onTagIdsChange={setOpenTagIds}
              />
            )}
            {tab === "history" && (
              <PositionsFilterBar
                tab="history"
                instruments={instruments}
                filters={history.filters}
                onFiltersChange={history.setFilters}
                tags={tags}
              />
            )}
          </div>
          {tab === "history" && history.totalCount > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive shrink-0">
                  <Trash2 className="size-3.5" />
                  <span className="hidden sm:inline">Clear History</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear trade history?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all closed trades from the database.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClearHistory}
                    disabled={clearingHistory}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {clearingHistory ? "Clearing..." : "Clear All"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {/* Trade lists */}
        {tab === "pending" && (
          <TradeCardList
            variant="pending"
            trades={filteredPending}
            pricesByInstrument={pricesByInstrument}
            tagsByTradeId={tagsByTradeId}
            instrumentFilter={pendingInstrument}
            directionFilter={pendingDirection}
            currency={currency}
            latestAnalysisByTradeId={liveAnalyses}
            countByTradeId={liveCounts}
            activeAiByTradeId={activeAiByTradeId}
            triggerAiFor={triggerPendingAiTrade}
            onTagMutated={refetchTags}
          />
        )}
        {tab === "open" && (
          <TradeCardList
            variant="open"
            trades={filteredOpen}
            pricesByInstrument={pricesByInstrument}
            tagsByTradeId={tagsByTradeId}
            currency={currency}
            instrumentFilter={openInstrument}
            directionFilter={openDirection}
            latestAnalysisByTradeId={liveAnalyses}
            countByTradeId={liveCounts}
            activeAiByTradeId={activeAiByTradeId}
            triggerAiFor={triggerOpenAiTrade}
            onTagMutated={refetchTags}
          />
        )}
        {tab === "history" && (
          <TradeCardList
            variant="closed"
            trades={history.trades}
            currency={currency}
            isLoading={history.isLoading}
            totalCount={history.totalCount}
            page={history.page}
            pageSize={history.pageSize}
            onPageChange={history.setPage}
            latestAnalysisByTradeId={historyAnalyses}
            countByTradeId={historyCounts}
            activeAiByTradeId={activeAiByTradeId}
            onTagMutated={history.refetch}
          />
        )}
      </div>
    </div>
  )
}

