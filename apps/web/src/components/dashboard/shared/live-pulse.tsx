"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Wraps a live-updating number and briefly tints its background when the
 * content changes. Lets the user spot deltas at a glance on WS-driven
 * tiles (balance, open P&L) without a motion-heavy animation.
 *
 * Respects `prefers-reduced-motion` — the tint is skipped entirely.
 * Pass an explicit `valueKey` for content where `children` is a React node
 * rather than a string (e.g. `formatPnL(...)` JSX); the component can't
 * diff arbitrary trees reliably.
 */
interface LivePulseProps {
  children: ReactNode
  /** Value to diff against. Defaults to `children` when `children` is primitive. */
  valueKey?: string | number
  /** Tint duration in ms. Default 700. */
  durationMs?: number
  className?: string
}

export function LivePulse({ children, valueKey, durationMs = 700, className }: LivePulseProps) {
  const key =
    valueKey ??
    (typeof children === "string" || typeof children === "number" ? String(children) : "")
  const [pulsing, setPulsing] = useState(false)
  const lastKey = useRef(key)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (key === lastKey.current) return
    lastKey.current = key
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReduced) return
    setPulsing(true)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setPulsing(false), durationMs)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [key, durationMs])

  return (
    <span
      className={cn(
        "inline-block rounded transition-colors duration-700",
        pulsing && "bg-primary/15",
        className,
      )}
    >
      {children}
    </span>
  )
}
