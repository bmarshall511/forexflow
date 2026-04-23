"use client"

import { useMemo } from "react"
import type { EquityCurvePoint } from "@fxflow/types"
import { formatCurrency } from "@fxflow/shared"
import { cn } from "@/lib/utils"

/**
 * GitHub-style contribution grid colored by daily P&L — a fast visual scan
 * of "which days made money, which lost" across a selected period.
 *
 * The input is the period-scoped equity curve (daily cumulativePL). We
 * convert to daily deltas inside. Saturday/Sunday cells render with a
 * muted background because forex doesn't trade weekends — they'd always
 * be empty and we want that to read as "closed", not "missing data".
 */
interface CalendarHeatmapProps {
  /** Daily cumulative-P&L points from getEquityCurve. Order doesn't matter; sorted internally. */
  equity: EquityCurvePoint[]
  /** Number of weeks to render, right-anchored on the most recent equity point. */
  weeks?: number
  currency?: string
  className?: string
}

interface Cell {
  date: Date
  iso: string // YYYY-MM-DD
  delta: number | null
  isWeekend: boolean
  isFuture: boolean
}

function startOfDay(d: Date): Date {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  return c
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d)
  c.setDate(c.getDate() + n)
  return c
}

function iso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function dailyDeltas(equity: EquityCurvePoint[]): Map<string, number> {
  const sorted = [...equity].sort((a, b) => a.date.localeCompare(b.date))
  const byDate = new Map<string, number>()
  let prev = 0
  for (const p of sorted) {
    byDate.set(p.date, p.cumulativePL - prev)
    prev = p.cumulativePL
  }
  return byDate
}

function buildCells(equity: EquityCurvePoint[], weeks: number): Cell[][] {
  const deltas = dailyDeltas(equity)
  const today = startOfDay(new Date())
  // End grid on the Saturday of the current week so each column is a Mon-Sun.
  const endDow = (today.getDay() + 6) % 7 // 0 = Mon .. 6 = Sun
  const gridEnd = addDays(today, 6 - endDow) // Sunday of this week
  const totalDays = weeks * 7
  const gridStart = addDays(gridEnd, -(totalDays - 1))

  // Columns of 7 (Mon → Sun).
  const cols: Cell[][] = []
  for (let w = 0; w < weeks; w++) {
    const col: Cell[] = []
    for (let d = 0; d < 7; d++) {
      const date = addDays(gridStart, w * 7 + d)
      const dow = date.getDay() // 0 = Sun, 6 = Sat
      const isWeekend = dow === 0 || dow === 6
      const key = iso(date)
      const delta = deltas.get(key) ?? null
      col.push({
        date,
        iso: key,
        delta,
        isWeekend,
        isFuture: date.getTime() > today.getTime(),
      })
    }
    cols.push(col)
  }
  return cols
}

function colorFor(delta: number | null, maxAbs: number, isWeekend: boolean, isFuture: boolean) {
  if (isFuture) return "bg-muted/20"
  if (delta === null) return isWeekend ? "bg-muted/20" : "bg-muted/40"
  if (delta === 0) return "bg-muted/60"
  const ratio = maxAbs > 0 ? Math.min(Math.abs(delta) / maxAbs, 1) : 0
  // Five intensity buckets so the scale is readable without being fussy.
  const bucket = ratio < 0.2 ? 0 : ratio < 0.4 ? 1 : ratio < 0.6 ? 2 : ratio < 0.8 ? 3 : 4
  if (delta > 0) {
    return [
      "bg-status-connected/15",
      "bg-status-connected/30",
      "bg-status-connected/50",
      "bg-status-connected/70",
      "bg-status-connected",
    ][bucket]
  }
  return [
    "bg-status-disconnected/15",
    "bg-status-disconnected/30",
    "bg-status-disconnected/50",
    "bg-status-disconnected/70",
    "bg-status-disconnected",
  ][bucket]
}

const DOW_LABELS = ["Mon", "", "Wed", "", "Fri", "", "Sun"]

export function CalendarHeatmap({
  equity,
  weeks = 26,
  currency = "USD",
  className,
}: CalendarHeatmapProps) {
  const cols = useMemo(() => buildCells(equity, weeks), [equity, weeks])
  const maxAbs = useMemo(() => {
    let m = 0
    for (const c of cols)
      for (const cell of c) if (cell.delta) m = Math.max(m, Math.abs(cell.delta))
    return m
  }, [cols])

  if (equity.length === 0) {
    return (
      <div
        className={cn(
          "text-muted-foreground flex items-center justify-center rounded-lg border border-dashed p-4 text-xs",
          className,
        )}
      >
        No closed trades in this period
      </div>
    )
  }

  return (
    <div className={cn("overflow-x-auto", className)} role="img" aria-label="Daily P&L heatmap">
      <div className="flex gap-[3px]">
        <div className="flex flex-col gap-[3px] pr-1">
          {DOW_LABELS.map((d, i) => (
            <div key={i} className="text-muted-foreground h-3 text-[9px] leading-3">
              {d}
            </div>
          ))}
        </div>
        {cols.map((col, i) => (
          <div key={i} className="flex flex-col gap-[3px]">
            {col.map((cell) => {
              const label =
                cell.delta != null
                  ? `${cell.iso}: ${formatCurrency(cell.delta, currency)}`
                  : cell.isWeekend
                    ? `${cell.iso}: market closed`
                    : `${cell.iso}: no trades`
              return (
                <div
                  key={cell.iso}
                  className={cn(
                    "size-3 rounded-[2px]",
                    colorFor(cell.delta, maxAbs, cell.isWeekend, cell.isFuture),
                  )}
                  title={label}
                  aria-label={label}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
