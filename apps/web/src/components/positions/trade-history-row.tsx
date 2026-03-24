"use client"

import { memo } from "react"
import type { ClosedTradeData, AiAnalysisData } from "@fxflow/types"
import type { ActiveAnalysisProgress } from "@/hooks/use-active-ai-analyses"
import { formatCurrency, formatPips } from "@fxflow/shared"
import { TableRow, TableCell } from "@/components/ui/table"
import { DirectionBadge } from "./direction-badge"
import { SourceBadge } from "./source-badge"
import { TimeframeSelect } from "./timeframe-select"
import { TagBadges } from "./tag-badges"
import { OutcomeBadge } from "./outcome-badge"
import { RiskRewardDisplay } from "./risk-reward-display"
import { DurationDisplay } from "./duration-display"
import { AiAnalysisCell } from "./ai-analysis-cell"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { MoreHorizontal, Eye, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

export interface TradeHistoryRowProps {
  trade: ClosedTradeData
  currency: string
  isSelected: boolean
  latestAnalysis: AiAnalysisData | undefined
  analysisCount: number | undefined
  activeProgress: ActiveAnalysisProgress | undefined
  onToggleSelect: () => void
  onViewDetails: () => void
  onAiAnalysis: () => void
  onTimeframeChange: (tf: string | null) => Promise<void>
}

export const TradeHistoryRow = memo(
  function TradeHistoryRow({
    trade,
    currency,
    isSelected,
    latestAnalysis,
    analysisCount,
    activeProgress,
    onToggleSelect,
    onViewDetails,
    onAiAnalysis,
    onTimeframeChange,
  }: TradeHistoryRowProps) {
    const plColor = trade.realizedPL >= 0 ? "text-status-connected" : "text-status-disconnected"

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
          {trade.exitPrice ?? "—"}
        </TableCell>
        <TableCell className="text-muted-foreground text-right font-mono text-xs tabular-nums">
          {trade.stopLoss ?? "—"}
        </TableCell>
        <TableCell className="text-muted-foreground text-right font-mono text-xs tabular-nums">
          {trade.takeProfit ?? "—"}
        </TableCell>
        <TableCell className="text-right font-mono text-xs tabular-nums">{trade.units}</TableCell>
        <TableCell
          className={cn("text-right font-mono text-xs font-semibold tabular-nums", plColor)}
        >
          {trade.realizedPL >= 0 ? "+" : ""}
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
          <OutcomeBadge
            outcome={trade.outcome}
            closeReason={trade.closeReason}
            closeContext={trade.closeContext}
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
          <DurationDisplay
            openedAt={trade.openedAt}
            closedAt={trade.closedAt}
            className="font-mono tabular-nums"
          />
        </TableCell>
        <TableCell className="text-muted-foreground text-xs">
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
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
    )
  },
  function areEqual(prev: TradeHistoryRowProps, next: TradeHistoryRowProps) {
    return (
      prev.trade.id === next.trade.id &&
      prev.trade.realizedPL === next.trade.realizedPL &&
      prev.trade.timeframe === next.trade.timeframe &&
      prev.trade.source === next.trade.source &&
      prev.trade.outcome === next.trade.outcome &&
      prev.trade.tags === next.trade.tags &&
      prev.isSelected === next.isSelected &&
      prev.currency === next.currency &&
      prev.latestAnalysis === next.latestAnalysis &&
      prev.analysisCount === next.analysisCount &&
      prev.activeProgress === next.activeProgress
    )
  },
)
