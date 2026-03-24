"use client"

import { memo } from "react"
import type { PendingOrderData, TradeTagData, AiAnalysisData } from "@fxflow/types"
import type { ActiveAnalysisProgress } from "@/hooks/use-active-ai-analyses"
import { formatRelativeTime, formatCurrency } from "@fxflow/shared"
import { TableRow, TableCell } from "@/components/ui/table"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { DirectionBadge } from "./direction-badge"
import { SourceBadge } from "./source-badge"
import { TimeframeSelect } from "./timeframe-select"
import { TagBadges } from "./tag-badges"
import { RiskRewardDisplay } from "./risk-reward-display"
import { PendingProgressBar } from "./progress-bar-pending"
import { AiAnalysisCell } from "./ai-analysis-cell"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { MoreHorizontal, Eye, XCircle, Sparkles } from "lucide-react"

function getGainLoss(order: PendingOrderData): { gain: number | null; loss: number | null } {
  const units = order.units
  let gain: number | null = null
  let loss: number | null = null

  if (order.takeProfit !== null) {
    const dist =
      order.direction === "long"
        ? order.takeProfit - order.entryPrice
        : order.entryPrice - order.takeProfit
    gain = dist * units
  }

  if (order.stopLoss !== null) {
    const dist =
      order.direction === "long"
        ? order.entryPrice - order.stopLoss
        : order.stopLoss - order.entryPrice
    loss = -(dist * units)
  }

  return { gain, loss }
}

export interface PendingOrderRowProps {
  order: PendingOrderData
  currentPrice: number | null
  tags: TradeTagData[]
  currency: string
  isSelected: boolean
  latestAnalysis: AiAnalysisData | undefined
  analysisCount: number | undefined
  activeProgress: ActiveAnalysisProgress | undefined
  onToggleSelect: () => void
  onViewDetails: () => void
  onCancelOrder: () => void
  onAiAnalysis: () => void
  onTimeframeChange: (tf: string | null) => Promise<void>
}

export const PendingOrderRow = memo(
  function PendingOrderRow({
    order,
    currentPrice,
    tags,
    currency,
    isSelected,
    latestAnalysis,
    analysisCount,
    activeProgress,
    onToggleSelect,
    onViewDetails,
    onCancelOrder,
    onAiAnalysis,
    onTimeframeChange,
  }: PendingOrderRowProps) {
    const { gain, loss } = getGainLoss(order)

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
            aria-label={`Select ${order.instrument.replace("_", "/")} order`}
          />
        </TableCell>
        <TableCell className="text-xs font-medium">{order.instrument.replace("_", "/")}</TableCell>
        <TableCell>
          <DirectionBadge direction={order.direction} />
        </TableCell>
        <TableCell>
          <SourceBadge source={order.source} />
        </TableCell>
        <TableCell onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          <TimeframeSelect value={order.timeframe} onChange={onTimeframeChange} />
        </TableCell>
        <TableCell className="text-muted-foreground text-xs">{order.orderType}</TableCell>
        <TableCell className="text-right font-mono text-xs tabular-nums">
          {order.entryPrice}
        </TableCell>
        <TableCell className="text-right font-mono text-xs tabular-nums">
          {currentPrice !== null ? (
            <AnimatedNumber value={currentPrice.toString()} />
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="min-w-[120px]">
          <PendingProgressBar
            instrument={order.instrument}
            entryPrice={order.entryPrice}
            currentPrice={currentPrice}
            stopLoss={order.stopLoss}
            direction={order.direction}
          />
        </TableCell>
        <TableCell className="text-muted-foreground text-right font-mono text-xs tabular-nums">
          {order.stopLoss ?? "—"}
        </TableCell>
        <TableCell className="text-muted-foreground text-right font-mono text-xs tabular-nums">
          {order.takeProfit ?? "—"}
        </TableCell>
        <TableCell className="text-right font-mono text-xs tabular-nums">{order.units}</TableCell>
        <TableCell className="text-right">
          <RiskRewardDisplay
            direction={order.direction}
            entryPrice={order.entryPrice}
            stopLoss={order.stopLoss}
            takeProfit={order.takeProfit}
            instrument={order.instrument}
            compact
          />
        </TableCell>
        <TableCell className="text-right font-mono text-xs tabular-nums">
          {gain !== null ? (
            <span className="text-status-connected">+{formatCurrency(gain, currency)}</span>
          ) : (
            "—"
          )}
        </TableCell>
        <TableCell className="text-right font-mono text-xs tabular-nums">
          {loss !== null ? (
            <span className="text-status-disconnected">{formatCurrency(loss, currency)}</span>
          ) : (
            "—"
          )}
        </TableCell>
        <TableCell className="text-muted-foreground text-xs">
          {formatRelativeTime(order.createdAt)}
        </TableCell>
        <TableCell className="text-xs">
          {order.timeInForce === "GTD" && order.gtdTime ? (
            <span className="text-muted-foreground">
              {new Date(order.gtdTime).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          ) : (
            <span className="text-muted-foreground">Never</span>
          )}
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
              <DropdownMenuItem variant="destructive" onClick={onCancelOrder}>
                <XCircle className="size-4" />
                Cancel Order
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
    )
  },
  function areEqual(prev: PendingOrderRowProps, next: PendingOrderRowProps) {
    return (
      prev.order.id === next.order.id &&
      prev.order.entryPrice === next.order.entryPrice &&
      prev.order.stopLoss === next.order.stopLoss &&
      prev.order.takeProfit === next.order.takeProfit &&
      prev.order.units === next.order.units &&
      prev.order.timeframe === next.order.timeframe &&
      prev.order.source === next.order.source &&
      prev.order.timeInForce === next.order.timeInForce &&
      prev.currentPrice === next.currentPrice &&
      prev.isSelected === next.isSelected &&
      prev.currency === next.currency &&
      prev.tags === next.tags &&
      prev.latestAnalysis === next.latestAnalysis &&
      prev.analysisCount === next.analysisCount &&
      prev.activeProgress === next.activeProgress
    )
  },
)
