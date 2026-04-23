"use client"

import { type ReactNode } from "react"
import { cn } from "@/lib/utils"
import type { DashboardTone } from "./types"

/**
 * Standard dashboard metric tile — icon, label, value, delta, spark, drill.
 * Every KPI on the redesigned dashboard uses this primitive so the visual
 * rhythm stays consistent and a redesign of "what a tile looks like" is
 * a single-file change.
 *
 * Keyboard: when `onDrill` is set, renders as a `<button>` with focus ring;
 * otherwise a plain div. Children are composition slots — pass a
 * `<DeltaBadge>` or `<Sparkline>` inline.
 *
 * Privacy: set `private` to mark the value node with `data-private="true"`
 * so the global privacy toggle blurs it.
 */
const TONE_TEXT: Record<DashboardTone, string> = {
  positive: "text-status-connected",
  negative: "text-status-disconnected",
  neutral: "text-foreground",
  warning: "text-status-warning",
}

export interface MetricTileProps {
  icon?: ReactNode
  label: string
  /** Primary value — string or composed JSX (e.g. `<AnimatedNumber />`). */
  value: ReactNode
  /** Secondary subtitle below the value — context, e.g. "3 trades closed". */
  subtitle?: ReactNode
  /** Optional delta badge / sparkline / etc. rendered in the tile corner. */
  trailing?: ReactNode
  /** Renders below the value — typically a <Sparkline /> or <DeltaBadge />. */
  footer?: ReactNode
  tone?: DashboardTone
  /** Tap/click handler. Turns the tile into a keyboard-accessible button. */
  onDrill?: () => void
  /** Accessible label for the drill button. Required when `onDrill` is set. */
  drillAriaLabel?: string
  /** Mark the main value as privacy-sensitive (blurred by the global toggle). */
  private?: boolean
  className?: string
}

export function MetricTile({
  icon,
  label,
  value,
  subtitle,
  trailing,
  footer,
  tone = "neutral",
  onDrill,
  drillAriaLabel,
  private: isPrivate,
  className,
}: MetricTileProps) {
  const content = (
    <>
      <div className="text-muted-foreground flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider">
          {icon}
          {label}
        </span>
        {trailing && <span className="shrink-0">{trailing}</span>}
      </div>
      <div
        className={cn(
          "font-mono text-lg font-semibold tabular-nums leading-tight",
          TONE_TEXT[tone],
        )}
        data-private={isPrivate ? "true" : undefined}
      >
        {value}
      </div>
      {subtitle && <div className="text-muted-foreground text-[10px] tabular-nums">{subtitle}</div>}
      {footer && <div className="mt-1">{footer}</div>}
    </>
  )

  const baseClass = cn(
    "border-border/50 bg-card flex min-w-[140px] flex-1 flex-col gap-1 rounded-xl border p-3",
    "transition-all",
    onDrill && "hover:bg-muted/40 hover:shadow-sm cursor-pointer text-left",
    onDrill && "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    className,
  )

  if (onDrill) {
    return (
      <button type="button" onClick={onDrill} aria-label={drillAriaLabel} className={baseClass}>
        {content}
      </button>
    )
  }
  return <div className={baseClass}>{content}</div>
}
