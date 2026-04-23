"use client"

import { ArrowDown, ArrowUp, Minus } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DashboardTone } from "./types"

/**
 * "+8% vs last month" pill. Tone auto-resolves from the sign of `value` when
 * not provided. `value` is a raw delta (e.g. +0.12 for +12%) — the component
 * does the formatting so spacing / sign conventions stay consistent.
 */
interface DeltaBadgeProps {
  /** Decimal delta for percent variant (0.08 = +8%), raw number for absolute variant. */
  value: number
  /** `"percent"` renders as ±X% ; `"absolute"` keeps the raw number with a sign. */
  variant?: "percent" | "absolute"
  label?: string
  tone?: DashboardTone
  className?: string
}

const TONE_CLASSES: Record<DashboardTone, string> = {
  positive: "border-status-connected/30 bg-status-connected/10 text-status-connected",
  negative: "border-status-disconnected/30 bg-status-disconnected/10 text-status-disconnected",
  neutral: "border-muted-foreground/20 bg-muted text-muted-foreground",
  warning: "border-status-warning/30 bg-status-warning/10 text-status-warning",
}

function autoTone(v: number): DashboardTone {
  if (v > 0) return "positive"
  if (v < 0) return "negative"
  return "neutral"
}

function formatValue(v: number, variant: "percent" | "absolute"): string {
  const sign = v > 0 ? "+" : ""
  if (variant === "percent") {
    const pct = Math.abs(v * 100) >= 100 ? (v * 100).toFixed(0) : (v * 100).toFixed(1)
    return `${sign}${pct}%`
  }
  const abs = Math.abs(v)
  const formatted = abs >= 1000 ? abs.toFixed(0) : abs.toFixed(2)
  return `${sign}${v < 0 ? "-" : ""}${formatted}`
}

export function DeltaBadge({
  value,
  variant = "percent",
  label,
  tone,
  className,
}: DeltaBadgeProps) {
  const resolvedTone = tone ?? autoTone(value)
  const Icon = value > 0 ? ArrowUp : value < 0 ? ArrowDown : Minus
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium tabular-nums",
        TONE_CLASSES[resolvedTone],
        className,
      )}
    >
      <Icon className="size-3" aria-hidden="true" />
      {formatValue(value, variant)}
      {label && <span className="text-muted-foreground ml-0.5 font-normal">{label}</span>}
    </span>
  )
}
