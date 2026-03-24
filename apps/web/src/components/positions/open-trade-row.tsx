"use client"

import { memo } from "react"
import type { OpenTradeData, PositionPriceTick, TradeTagData, AiAnalysisData } from "@fxflow/types"
import type { ActiveAnalysisProgress } from "@/hooks/use-active-ai-analyses"
import { formatCurrency, formatPips } from "@fxflow/shared"
import { TableRow, TableCell } from "@/components/ui/table"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { DirectionBadge } from "./direction-badge"
import { SourceBadge } from "./source-badge"
import { TimeframeSelect } from "./timeframe-select"
import { TagBadges } from "./tag-badges"
import { RiskRewardDisplay } from "./risk-reward-display"
import { OpenProgressBar } from "./progress-bar-open"
import { DurationDisplay } from "./duration-display"
import { AiAnalysisCell } from "./ai-analysis-cell"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { MoreHorizontal, Eye, XCircle, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { SpreadDisplay } from "@/components/ui/spread-display"

export interface OpenTradeRowProps {
  trade: OpenTradeData
  tick: PositionPriceTick | undefined
  tags: TradeTagData[]
  currency: string
  isSelected: boolean
  latestAnalysis: AiAnalysisData | undefined
  analysisCount: number | undefined
  activeProgress: ActiveAnalysisProgress | undefined
  onToggleSelect: () => void
  onViewDetails: () => void
  onCloseTrade: () => void
  onAiAnalysis: () => void
  onTimeframeChange: (tf: string | null) => Promise<void>
}

export const OpenTradeRow = memo(
  function OpenTradeRow({
    trade,
    tick,
    tags,
    currency,
    isSelected,
    latestAnalysis,
    analysisCount,
    activeProgress,
    onToggleSelect,
    onViewDetails,
    onCloseTrade,
    onAiAnalysis,
    onTimeframeChange,
  }: OpenTradeRowProps) {
    const plColor = trade.unrealizedPL >= 0 ? "text-status-connected" : "text-status-disconnected"

    return (
      <TableRow
        className="cursor-pointer select-none"
        onMouseDown={(e) => {
          if (e.button === 0) onViewDetails()
        }}
      >
        <TableCell onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            aria-label={`Select ${trade.instrument.replace("_", "/")} trade`}
          />
        </TableCell>
        <TableCell className="text-xs font-medium">{trade.instrument.replace("_", "/")}</TableCell>
        <TableCell>
          <DirectionBadge direction={trade.direction} />
        </TableCell>
        <TableCell>
          <SourceBadge source={trade.source} />
        </TableCell>
        <TableCell onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          <TimeframeSelect value={trade.timeframe} onChange={onTimeframeChange} />
        </TableCell>
        <TableCell className="text-right font-mono text-xs tabular-nums">
          {trade.entryPrice}
        </TableCell>
        <TableCell className="text-right font-mono text-xs tabular-nums">
          {trade.currentPrice ? (
            <AnimatedNumber value={trade.currentPrice.toString()} className={plColor} />
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="text-right">
          {tick ? (
            <SpreadDisplay bid={tick.bid} ask={tick.ask} instrument={trade.instrument} />
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </TableCell>
        <TableCell className="text-muted-foreground text-right font-mono text-xs tabular-nums">
          {trade.stopLoss ?? "—"}
        </TableCell>
        <TableCell className="text-muted-foreground text-right font-mono text-xs tabular-nums">
          {trade.takeProfit ?? "—"}
        </TableCell>
        <TableCell>
          <OpenProgressBar
            instrument={trade.instrument}
            direction={trade.direction}
            entryPrice={trade.entryPrice}
            currentPrice={trade.currentPrice}
            stopLoss={trade.stopLoss}
            takeProfit={trade.takeProfit}
          />
        </TableCell>
        <TableCell className="text-right font-mono text-xs tabular-nums">
          {trade.currentUnits !== trade.initialUnits
            ? `${trade.currentUnits}/${trade.initialUnits}`
            : trade.currentUnits}
        </TableCell>
        <TableCell className="text-right font-mono text-xs tabular-nums">
          <AnimatedNumber
            value={`${trade.unrealizedPL >= 0 ? "+" : ""}${formatCurrency(trade.unrealizedPL, currency)}`}
            className={cn("font-semibold", plColor)}
          />
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
        <TableCell className="text-right font-mono text-xs tabular-nums">
          {trade.mfe !== null ? (
            <span className="text-status-connected">{formatPips(trade.mfe)}</span>
          ) : (
            "—"
          )}
        </TableCell>
        <TableCell className="text-right font-mono text-xs tabular-nums">
          {trade.mae !== null ? (
            <span className="text-status-disconnected">{formatPips(Math.abs(trade.mae))}</span>
          ) : (
            "—"
          )}
        </TableCell>
        <TableCell className="text-xs">
          <DurationDisplay openedAt={trade.openedAt} className="font-mono tabular-nums" />
        </TableCell>
        <TableCell>
          <TagBadges tags={tags} />
        </TableCell>
        <TableCell onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          <AiAnalysisCell
            latestAnalysis={latestAnalysis}
            analysisCount={analysisCount}
            activeProgress={activeProgress}
            onClick={onAiAnalysis}
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
              <DropdownMenuItem onClick={onViewDetails}>
                <Eye className="size-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onAiAnalysis}>
                <Sparkles className="size-4" />
                AI Analysis
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onCloseTrade}>
                <XCircle className="size-4" />
                Close Trade
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
    )
  },
  function areEqual(prev: OpenTradeRowProps, next: OpenTradeRowProps) {
    return (
      prev.trade.id === next.trade.id &&
      prev.trade.unrealizedPL === next.trade.unrealizedPL &&
      prev.trade.currentUnits === next.trade.currentUnits &&
      prev.trade.currentPrice === next.trade.currentPrice &&
      prev.trade.stopLoss === next.trade.stopLoss &&
      prev.trade.takeProfit === next.trade.takeProfit &&
      prev.trade.mfe === next.trade.mfe &&
      prev.trade.mae === next.trade.mae &&
      prev.trade.timeframe === next.trade.timeframe &&
      prev.trade.source === next.trade.source &&
      prev.isSelected === next.isSelected &&
      prev.currency === next.currency &&
      prev.tick?.bid === next.tick?.bid &&
      prev.tick?.ask === next.tick?.ask &&
      prev.tags === next.tags &&
      prev.latestAnalysis === next.latestAnalysis &&
      prev.analysisCount === next.analysisCount &&
      prev.activeProgress === next.activeProgress
    )
  },
)
