import { cn } from "@/lib/utils"

export type StatusState = "connected" | "connecting" | "disconnected" | "warning" | "unconfigured"

interface StatusIndicatorProps {
  label: string
  status: StatusState
  className?: string
}

const dotStyles: Record<StatusState, string> = {
  connected: "bg-status-connected",
  connecting: "bg-status-connecting animate-pulse",
  disconnected: "bg-status-disconnected",
  warning: "bg-status-warning",
  unconfigured: "bg-status-unconfigured",
}

const ariaLabels: Record<StatusState, string> = {
  connected: "connected",
  connecting: "connecting",
  disconnected: "disconnected",
  warning: "warning",
  unconfigured: "not configured",
}

export function StatusIndicator({ label, status, className }: StatusIndicatorProps) {
  return (
    <div
      role="status"
      aria-label={`${label}: ${ariaLabels[status]}`}
      className={cn("flex items-center gap-1.5", className)}
    >
      <span
        className={cn("size-1.5 shrink-0 rounded-full", dotStyles[status])}
        aria-hidden="true"
      />
      <span className="text-muted-foreground text-[11px]">{label}</span>
    </div>
  )
}
