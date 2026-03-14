"use client"

import type { DayOfWeekPerformance, HourOfDayPerformance } from "@fxflow/types"
import { cn } from "@/lib/utils"

interface Props {
  byDayOfWeek: DayOfWeekPerformance[]
  byHourOfDay: HourOfDayPerformance[]
}

function cellBg(pl: number, maxAbs: number): string {
  if (maxAbs === 0 || pl === 0) return "bg-muted/30"
  const ratio = Math.abs(pl) / maxAbs
  if (pl > 0) {
    if (ratio > 0.66) return "bg-green-500/40"
    if (ratio > 0.33) return "bg-green-500/25"
    return "bg-green-500/10"
  }
  if (ratio > 0.66) return "bg-red-500/40"
  if (ratio > 0.33) return "bg-red-500/25"
  return "bg-red-500/10"
}

function plTextColor(v: number): string {
  if (v > 0) return "text-green-700 dark:text-green-300"
  if (v < 0) return "text-red-700 dark:text-red-300"
  return "text-muted-foreground"
}

function fmtPL(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(0)}`
}

function fmtHour(h: number): string {
  if (h === 0) return "12am"
  if (h < 12) return `${h}am`
  if (h === 12) return "12pm"
  return `${h - 12}pm`
}

const DAY_LABELS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "", ""]

export function TimeHeatmap({ byDayOfWeek, byHourOfDay }: Props) {
  const dayMax = Math.max(...byDayOfWeek.map((d) => Math.abs(d.totalPL)), 1)
  const hourMax = Math.max(...byHourOfDay.map((h) => Math.abs(h.totalPL)), 1)

  return (
    <div className="space-y-8" role="region" aria-label="Performance by time of day and week">
      <p className="text-muted-foreground text-sm">
        Green means profitable, red means losing. Brighter colors mean bigger amounts.
      </p>

      {/* Day of week */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">Day of the Week</h3>
        {byDayOfWeek.length === 0 ? (
          <p className="text-muted-foreground text-sm">No data</p>
        ) : (
          <div className="grid grid-cols-5 gap-3">
            {byDayOfWeek
              .filter((d) => d.day >= 1 && d.day <= 5)
              .map((d) => (
                <div
                  key={d.day}
                  className={cn(
                    "rounded-xl p-4 text-center transition-colors",
                    cellBg(d.totalPL, dayMax),
                  )}
                >
                  <p className="text-xs font-semibold">
                    {DAY_LABELS[d.day] ?? d.dayName.slice(0, 3)}
                  </p>
                  <p className={cn("mt-1 text-lg font-bold tabular-nums", plTextColor(d.totalPL))}>
                    {fmtPL(d.totalPL)}
                  </p>
                  <p className="text-muted-foreground mt-1 text-[11px]">
                    {d.trades} trades / {(d.winRate * 100).toFixed(0)}% wins
                  </p>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Hour of day */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">Hour of the Day (UTC)</h3>
        {byHourOfDay.length === 0 ? (
          <p className="text-muted-foreground text-sm">No data</p>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12">
            {byHourOfDay.map((h) => (
              <div
                key={h.hour}
                className={cn(
                  "rounded-lg px-2 py-3 text-center transition-colors",
                  h.trades === 0 ? "bg-muted/20" : cellBg(h.totalPL, hourMax),
                )}
                title={`${fmtHour(h.hour)} — ${h.trades} trades, ${(h.winRate * 100).toFixed(0)}% wins`}
              >
                <p className="text-muted-foreground text-[10px] font-medium">{fmtHour(h.hour)}</p>
                <p className={cn("mt-0.5 text-xs font-bold tabular-nums", plTextColor(h.totalPL))}>
                  {h.trades > 0 ? fmtPL(h.totalPL) : "--"}
                </p>
                <p className="text-muted-foreground mt-0.5 text-[9px]">
                  {h.trades > 0 ? `${h.trades}t` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
