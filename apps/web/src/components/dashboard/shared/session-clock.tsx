"use client"

import { useMemo } from "react"
import type { HourOfDayPerformance } from "@fxflow/types"
import { formatCurrency } from "@fxflow/shared"
import { cn } from "@/lib/utils"

/**
 * 24-hour radial dial showing P&L per hour-of-day. Each hour is a wedge
 * whose length scales with |totalPL| and whose color is tone-coded.
 *
 * Hours arrive from the server in UTC buckets. The component displays them
 * as local-hour labels so the user sees "my 3 PM", not UTC. A TZ-aware
 * re-bucket happens server-side in a later phase; for now we shift labels
 * by the browser's offset — good enough for the visual.
 */
interface SessionClockProps {
  data: HourOfDayPerformance[]
  currency?: string
  size?: number
  className?: string
}

const INNER_R = 30
const OUTER_R = 95

function polar(angle: number, r: number, cx: number, cy: number) {
  // angle in radians, 0 = 12 o'clock (top), clockwise
  const x = cx + Math.sin(angle) * r
  const y = cy - Math.cos(angle) * r
  return { x, y }
}

function wedgePath(hourUtc: number, lengthR: number, cx: number, cy: number) {
  const slice = (Math.PI * 2) / 24
  const startAngle = hourUtc * slice
  const endAngle = startAngle + slice
  const a = polar(startAngle, INNER_R, cx, cy)
  const b = polar(startAngle, INNER_R + lengthR, cx, cy)
  const c = polar(endAngle, INNER_R + lengthR, cx, cy)
  const d = polar(endAngle, INNER_R, cx, cy)
  return `M${a.x},${a.y} L${b.x},${b.y} A${INNER_R + lengthR},${INNER_R + lengthR} 0 0 1 ${c.x},${c.y} L${d.x},${d.y} A${INNER_R},${INNER_R} 0 0 0 ${a.x},${a.y} Z`
}

export function SessionClock({ data, currency = "USD", size = 220, className }: SessionClockProps) {
  const { buckets, maxAbs } = useMemo(() => {
    // Slot by UTC hour so server → client math stays honest.
    const map = new Map<number, HourOfDayPerformance>()
    for (const h of data) map.set(h.hour, h)
    let maxAbs = 0
    for (const h of data) if (Math.abs(h.totalPL) > maxAbs) maxAbs = Math.abs(h.totalPL)
    return { buckets: map, maxAbs }
  }, [data])

  const cx = 100
  const cy = 100
  const maxLen = OUTER_R - INNER_R
  const tzOffset = new Date().getTimezoneOffset() / 60 // minutes → hours; positive = west of UTC

  if (data.length === 0) {
    return (
      <div
        className={cn(
          "text-muted-foreground flex items-center justify-center rounded-lg border border-dashed text-xs",
          className,
        )}
        style={{ height: size }}
      >
        No hourly data yet
      </div>
    )
  }

  const nowUtcHour = new Date().getUTCHours()

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={cn("block", className)}
      role="img"
      aria-label="24-hour performance dial"
    >
      {/* Background ring */}
      <circle
        cx={cx}
        cy={cy}
        r={INNER_R + maxLen}
        fill="none"
        className="stroke-border/40"
        strokeWidth="0.5"
      />
      <circle
        cx={cx}
        cy={cy}
        r={INNER_R}
        fill="none"
        className="stroke-border/40"
        strokeWidth="0.5"
      />

      {/* Hour wedges */}
      {Array.from({ length: 24 }).map((_, utcHour) => {
        const bucket = buckets.get(utcHour)
        const lenRatio = maxAbs > 0 && bucket ? Math.min(Math.abs(bucket.totalPL) / maxAbs, 1) : 0
        const r = Math.max(2, lenRatio * maxLen)
        const tone =
          !bucket || bucket.totalPL === 0
            ? "fill-muted-foreground/20"
            : bucket.totalPL > 0
              ? "fill-status-connected/80"
              : "fill-status-disconnected/80"
        const localHour = (utcHour - tzOffset + 24) % 24
        const label = bucket
          ? `${localHour.toString().padStart(2, "0")}:00 — ${formatCurrency(bucket.totalPL, currency)} · ${bucket.trades} trade${bucket.trades !== 1 ? "s" : ""}`
          : `${localHour.toString().padStart(2, "0")}:00 — no trades`
        return (
          <path key={utcHour} d={wedgePath(utcHour, r, cx, cy)} className={tone} aria-label={label}>
            <title>{label}</title>
          </path>
        )
      })}

      {/* Cardinal hour labels (00, 06, 12, 18 in local time) */}
      {[0, 6, 12, 18].map((localH) => {
        const utcHour = (localH + tzOffset + 24) % 24
        const angle = utcHour * ((Math.PI * 2) / 24) + (Math.PI * 2) / 24 / 2
        const p = polar(angle, OUTER_R + 10, cx, cy)
        return (
          <text
            key={localH}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-muted-foreground text-[8px]"
          >
            {localH.toString().padStart(2, "0")}
          </text>
        )
      })}

      {/* "now" indicator — thin tick from center outward at the current hour */}
      {(() => {
        const slice = (Math.PI * 2) / 24
        const angle = nowUtcHour * slice + slice / 2
        const inner = polar(angle, INNER_R - 2, cx, cy)
        const outer = polar(angle, OUTER_R + 4, cx, cy)
        return (
          <line
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
            className="stroke-primary/70"
            strokeWidth="0.75"
            strokeLinecap="round"
          />
        )
      })()}
    </svg>
  )
}
