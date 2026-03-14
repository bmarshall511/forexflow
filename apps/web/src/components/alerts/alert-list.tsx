"use client"

import type { PriceAlertData } from "@fxflow/types"
import { AlertStatusBadge } from "./alert-status-badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ArrowUp, ArrowDown, Pencil, Trash2, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

interface AlertListProps {
  alerts: PriceAlertData[]
  onEdit: (alert: PriceAlertData) => void
  onDelete: (id: string) => void
}

function formatPair(instrument: string): string {
  return instrument.replace("_", "/")
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** Desktop table view */
function AlertTable({ alerts, onEdit, onDelete }: AlertListProps) {
  return (
    <div className="hidden md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Instrument</TableHead>
            <TableHead>Direction</TableHead>
            <TableHead className="text-right">Target Price</TableHead>
            <TableHead>Label</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-[80px]">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {alerts.map((alert) => (
            <TableRow key={alert.id}>
              <TableCell className="font-medium">{formatPair(alert.instrument)}</TableCell>
              <TableCell>
                <DirectionIndicator direction={alert.direction} />
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {alert.targetPrice.toFixed(5)}
              </TableCell>
              <TableCell className="text-muted-foreground max-w-[200px] truncate text-sm">
                {alert.label ?? "--"}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <AlertStatusBadge status={alert.status} />
                  {alert.repeating && (
                    <RefreshCw className="text-muted-foreground size-3" aria-label="Repeating" />
                  )}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {formatDate(alert.createdAt)}
              </TableCell>
              <TableCell>
                {alert.status === "active" && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => onEdit(alert)}
                      aria-label={`Edit alert for ${formatPair(alert.instrument)}`}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive size-8"
                      onClick={() => onDelete(alert.id)}
                      aria-label={`Delete alert for ${formatPair(alert.instrument)}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** Mobile card view */
function AlertCards({ alerts, onEdit, onDelete }: AlertListProps) {
  return (
    <div className="flex flex-col gap-3 md:hidden">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="bg-card flex items-center justify-between rounded-lg border p-4"
        >
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="font-medium">{formatPair(alert.instrument)}</span>
              <DirectionIndicator direction={alert.direction} />
              <AlertStatusBadge status={alert.status} />
              {alert.repeating && (
                <RefreshCw className="text-muted-foreground size-3" aria-label="Repeating" />
              )}
            </div>
            <span className="font-mono text-sm">{alert.targetPrice.toFixed(5)}</span>
            {alert.label && <span className="text-muted-foreground text-xs">{alert.label}</span>}
          </div>
          {alert.status === "active" && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-9"
                onClick={() => onEdit(alert)}
                aria-label={`Edit alert for ${formatPair(alert.instrument)}`}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive size-9"
                onClick={() => onDelete(alert.id)}
                aria-label={`Delete alert for ${formatPair(alert.instrument)}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function DirectionIndicator({ direction }: { direction: "above" | "below" }) {
  const isAbove = direction === "above"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        isAbove ? "text-emerald-500" : "text-red-500",
      )}
    >
      {isAbove ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {isAbove ? "Above" : "Below"}
    </span>
  )
}

export function AlertList({ alerts, onEdit, onDelete }: AlertListProps) {
  return (
    <>
      <AlertTable alerts={alerts} onEdit={onEdit} onDelete={onDelete} />
      <AlertCards alerts={alerts} onEdit={onEdit} onDelete={onDelete} />
    </>
  )
}
