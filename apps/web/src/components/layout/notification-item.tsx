"use client"

import Link from "next/link"
import { X, Sparkles, Target } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { NotificationData } from "@fxflow/types"

const severityDotColors: Record<string, string> = {
  critical: "bg-status-disconnected",
  warning: "bg-status-warning",
  info: "bg-status-connecting",
}

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

interface NotificationItemProps {
  notification: NotificationData
  onDismiss: (id: string) => void
  onDelete: (id: string) => void
}

function SourceIcon({ source }: { source: string }) {
  if (source === "ai_analysis") return <Sparkles className="size-3 text-primary shrink-0 mt-0.5" />
  if (source === "trade_condition") return <Target className="size-3 text-cyan-500 shrink-0 mt-0.5" />
  return null
}

function DeepLink({ notification }: { notification: NotificationData }) {
  if (!notification.metadata) return null

  let meta: Record<string, string> = {}
  try { meta = JSON.parse(notification.metadata) as Record<string, string> } catch { return null }

  if (notification.source === "ai_analysis" && meta.tradeId) {
    return (
      <Link href="/positions" className="mt-1 inline-flex text-[10px] text-primary hover:underline">
        View trade on Positions →
      </Link>
    )
  }

  if (notification.source === "trade_condition" && meta.tradeId) {
    return (
      <Link href="/positions" className="mt-1 inline-flex text-[10px] text-primary hover:underline">
        View trade on Positions →
      </Link>
    )
  }

  return null
}

export function NotificationItem({ notification, onDismiss, onDelete }: NotificationItemProps) {
  const { id, severity, title, message, dismissed, createdAt, source } = notification

  return (
    <div
      className={cn(
        "group relative flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors",
        "hover:bg-muted/50 focus-within:bg-muted/50",
        dismissed && "opacity-50",
      )}
      role="listitem"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault()
          dismissed ? onDelete(id) : onDismiss(id)
        }
      }}
    >
      {/* Severity dot or source icon */}
      {source === "ai_analysis" || source === "trade_condition" ? (
        <SourceIcon source={source} />
      ) : (
        <span
          className={cn(
            "mt-1.5 size-2 shrink-0 rounded-full",
            severityDotColors[severity] ?? "bg-muted-foreground",
          )}
          aria-hidden="true"
        />
      )}

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-foreground truncate">{title}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {formatRelativeTime(createdAt)}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{message}</p>
        <DeepLink notification={notification} />
        {dismissed && (
          <span className="mt-1 inline-block text-[10px] uppercase tracking-wider text-muted-foreground/60">
            Dismissed
          </span>
        )}
      </div>

      {/* Action button */}
      <Button
        variant="ghost"
        size="icon-sm"
        className={cn(
          "shrink-0 opacity-0 transition-opacity",
          "group-hover:opacity-100 group-focus-within:opacity-100",
        )}
        onClick={(e) => {
          e.stopPropagation()
          dismissed ? onDelete(id) : onDismiss(id)
        }}
        aria-label={dismissed ? `Delete notification: ${title}` : `Dismiss notification: ${title}`}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  )
}
