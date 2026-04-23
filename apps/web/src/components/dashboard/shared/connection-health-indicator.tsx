"use client"

import { useDaemonStatus } from "@/hooks/use-daemon-status"
import { cn } from "@/lib/utils"

/**
 * Compact dot + label summarising the daemon connection.
 * - green  = WS connected
 * - amber  = REST reachable but WS down (degraded)
 * - red    = completely unreachable
 *
 * Label is hidden at narrow widths; screen readers always get the full
 * status via aria-label.
 */
interface ConnectionHealthIndicatorProps {
  className?: string
}

type State = { tone: "ok" | "degraded" | "down"; label: string; aria: string }

function resolve(isConnected: boolean, isReachable: boolean): State {
  if (isConnected) return { tone: "ok", label: "Live", aria: "Connected to trading daemon" }
  if (isReachable)
    return {
      tone: "degraded",
      label: "Reconnecting…",
      aria: "Daemon reachable but realtime stream disconnected — reconnecting",
    }
  return { tone: "down", label: "Offline", aria: "Trading daemon unreachable" }
}

const TONE_DOT = {
  ok: "bg-status-connected",
  degraded: "bg-status-warning animate-pulse",
  down: "bg-status-disconnected",
} as const

const TONE_TEXT = {
  ok: "text-status-connected",
  degraded: "text-status-warning",
  down: "text-status-disconnected",
} as const

export function ConnectionHealthIndicator({ className }: ConnectionHealthIndicatorProps) {
  const { isConnected, isReachable } = useDaemonStatus()
  const { tone, label, aria } = resolve(isConnected, isReachable)
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={aria}
    >
      <span className={cn("size-1.5 rounded-full", TONE_DOT[tone])} aria-hidden="true" />
      <span className={cn("hidden sm:inline", TONE_TEXT[tone])}>{label}</span>
    </span>
  )
}
