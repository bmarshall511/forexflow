"use client"

import Link from "next/link"
import { AlertTriangle, AlertCircle, Info, X, ArrowRight } from "lucide-react"
import type { SetupCheckItem, SetupCheckSeverity } from "@fxflow/types"
import { useSetupStatus } from "@/hooks/use-setup-status"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Dashboard "Setup Needed" panel.
 *
 * Renders the items returned by `useSetupStatus`, sorted by severity. Per-
 * device dismissals are owned by the hook, so each row just calls
 * `dismiss(id)` and the list reconciles.
 *
 * Auto-hides when everything is configured — parents can render this
 * unconditionally.
 */
const SEVERITY_ICON: Record<SetupCheckSeverity, typeof AlertTriangle> = {
  error: AlertTriangle,
  warning: AlertCircle,
  info: Info,
}

const SEVERITY_TONE: Record<
  SetupCheckSeverity,
  { bg: string; border: string; icon: string; title: string }
> = {
  error: {
    bg: "bg-status-disconnected/5",
    border: "border-status-disconnected/30",
    icon: "text-status-disconnected",
    title: "text-status-disconnected",
  },
  warning: {
    bg: "bg-status-warning/5",
    border: "border-status-warning/30",
    icon: "text-status-warning",
    title: "text-status-warning",
  },
  info: {
    bg: "bg-primary/5",
    border: "border-primary/20",
    icon: "text-primary",
    title: "text-foreground",
  },
}

function SetupRow({ item, onDismiss }: { item: SetupCheckItem; onDismiss: (() => void) | null }) {
  const Icon = SEVERITY_ICON[item.severity]
  const tone = SEVERITY_TONE[item.severity]
  return (
    <div
      className={cn("flex items-start gap-3 rounded-lg border p-3", tone.bg, tone.border)}
      role="listitem"
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", tone.icon)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium", tone.title)}>{item.title}</p>
        <p className="text-muted-foreground mt-0.5 text-xs">{item.detail}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Link
          href={item.fixHref}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors",
            "hover:bg-background focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2",
            tone.border,
            tone.title,
          )}
        >
          Fix
          <ArrowRight className="size-3" aria-hidden="true" />
        </Link>
        {onDismiss && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onDismiss}
            aria-label={`Dismiss: ${item.title}`}
            className="text-muted-foreground/60 hover:text-muted-foreground size-7"
          >
            <X className="size-3.5" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  )
}

interface SetupPanelProps {
  className?: string
}

export function SetupPanel({ className }: SetupPanelProps) {
  const { items, totalIncludingDismissed, isLoading, dismiss, resetDismissed } = useSetupStatus()

  if (isLoading) return null
  if (items.length === 0) {
    // Auto-hide when nothing is pending. If the user dismissed some items and
    // now nothing visible remains, offer a one-click "show hidden" only when
    // there actually are hidden items.
    if (totalIncludingDismissed > items.length) {
      return (
        <div className={cn("flex justify-end px-1", className)}>
          <button
            type="button"
            onClick={resetDismissed}
            className="text-muted-foreground/60 hover:text-muted-foreground text-[10px] underline-offset-2 hover:underline"
          >
            Show {totalIncludingDismissed - items.length} hidden setup item
            {totalIncludingDismissed - items.length !== 1 ? "s" : ""}
          </button>
        </div>
      )
    }
    return null
  }

  return (
    <section
      className={cn("space-y-2", className)}
      aria-label={`Setup needed (${items.length} item${items.length !== 1 ? "s" : ""})`}
    >
      <div className="flex items-center justify-between px-1">
        <h2 className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
          Setup needed
        </h2>
        <span className="text-muted-foreground/60 text-[10px] tabular-nums">
          {items.length} item{items.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="space-y-1.5" role="list">
        {items.map((item) => (
          <SetupRow
            key={item.id}
            item={item}
            onDismiss={item.dismissible ? () => dismiss(item.id) : null}
          />
        ))}
      </div>
    </section>
  )
}
