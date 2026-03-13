"use client"

import { useMemo, useState } from "react"
import { Bell, ArrowUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { NotificationItem } from "./notification-item"
import { useNotificationContext } from "@/state/notification-context"
import type { NotificationSeverity } from "@fxflow/types"

type SeverityFilter = "all" | NotificationSeverity
type SortMode = "newest" | "severity"

const SEVERITY_ORDER: Record<NotificationSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
}

const FILTER_OPTIONS: { value: SeverityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "critical", label: "Critical" },
  { value: "warning", label: "Warning" },
  { value: "info", label: "Info" },
]

export function NotificationPanel() {
  const {
    notifications,
    undismissedCount,
    dismiss,
    dismissAll,
    deleteOne,
    deleteAllDismissed,
  } = useNotificationContext()

  const [filter, setFilter] = useState<SeverityFilter>("all")
  const [sort, setSort] = useState<SortMode>("newest")

  const filtered = useMemo(() => {
    let list = notifications
    if (filter !== "all") {
      list = list.filter((n) => n.severity === filter)
    }
    if (sort === "severity") {
      list = [...list].sort((a, b) => {
        const severityDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
        if (severityDiff !== 0) return severityDiff
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
    }
    // "newest" is default order from API
    return list
  }, [notifications, filter, sort])

  const hasDismissed = notifications.some((n) => n.dismissed)

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Notifications</h2>
          {undismissedCount > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {undismissedCount}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => void dismissAll()}
          disabled={undismissedCount === 0}
        >
          Dismiss All
        </Button>
      </div>

      <Separator />

      {/* Filter bar + sort toggle */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex gap-1">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilter(opt.value)}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                filter === opt.value
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setSort((s) => (s === "newest" ? "severity" : "newest"))}
          aria-label={`Sort by ${sort === "newest" ? "severity" : "date"}`}
          title={sort === "newest" ? "Sort by severity" : "Sort by newest"}
        >
          <ArrowUpDown className="size-3.5" />
        </Button>
      </div>

      <Separator />

      {/* List */}
      <ScrollArea className="flex-1">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
            <Bell className="size-8 opacity-40" />
            <p className="text-sm font-medium">No notifications</p>
            <p className="text-xs">
              {filter !== "all"
                ? `No ${filter} notifications`
                : "System alerts will appear here"}
            </p>
          </div>
        ) : (
          <div className="px-1 py-1" role="list">
            {filtered.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onDismiss={(id) => void dismiss(id)}
                onDelete={(id) => void deleteOne(id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      {hasDismissed && (
        <>
          <Separator />
          <div className="px-4 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              onClick={() => void deleteAllDismissed()}
            >
              Delete dismissed
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
