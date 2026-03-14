"use client"

import Link from "next/link"
import { X, Sparkles, Target, Bot } from "lucide-react"
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
  if (source === "ai_analysis") return <Sparkles className="text-primary mt-0.5 size-3 shrink-0" />
  if (source === "trade_condition")
    return <Target className="mt-0.5 size-3 shrink-0 text-cyan-500" />
  if (source === "ai_trader") return <Bot className="mt-0.5 size-3 shrink-0 text-violet-500" />
  return null
}

function DeepLink({ notification }: { notification: NotificationData }) {
  if (!notification.metadata) return null

  let meta: Record<string, string> = {}
  try {
    meta = JSON.parse(notification.metadata) as Record<string, string>
  } catch {
    return null
  }

  if (notification.source === "ai_analysis" && meta.tradeId) {
    return (
      <Link href="/positions" className="text-primary mt-1 inline-flex text-[10px] hover:underline">
        View trade on Positions →
      </Link>
    )
  }

  if (notification.source === "trade_condition" && meta.tradeId) {
    return (
      <Link href="/positions" className="text-primary mt-1 inline-flex text-[10px] hover:underline">
        View trade on Positions →
      </Link>
    )
  }

  if (notification.source === "ai_trader") {
    return (
      <Link
        href="/ai-trader"
        className="mt-1 inline-flex text-[10px] text-violet-500 hover:underline"
      >
        View AI Trader →
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
          if (dismissed) {
            onDelete(id)
          } else {
            onDismiss(id)
          }
        }
      }}
    >
      {/* Severity dot or source icon */}
      {source === "ai_analysis" || source === "trade_condition" || source === "ai_trader" ? (
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
          <span className="text-foreground truncate text-sm font-semibold">{title}</span>
          <span className="text-muted-foreground shrink-0 text-[11px]">
            {formatRelativeTime(createdAt)}
          </span>
        </div>
        <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{message}</p>
        <DeepLink notification={notification} />
        {dismissed && (
          <span className="text-muted-foreground/60 mt-1 inline-block text-[10px] uppercase tracking-wider">
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
          "group-focus-within:opacity-100 group-hover:opacity-100",
        )}
        onClick={(e) => {
          e.stopPropagation()
          if (dismissed) {
            onDelete(id)
          } else {
            onDismiss(id)
          }
        }}
        aria-label={dismissed ? `Delete notification: ${title}` : `Dismiss notification: ${title}`}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  )
}
