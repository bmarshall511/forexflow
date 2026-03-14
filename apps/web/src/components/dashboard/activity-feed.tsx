"use client"

import { useActivityFeed } from "@/hooks/use-activity-feed"
import { ActivityItem } from "./activity-item"
import { Skeleton } from "@/components/ui/skeleton"
import { Activity } from "lucide-react"

const MAX_DISPLAY = 8
const MAX_DISPLAY_MOBILE = 3

export function ActivityFeed() {
  const { events, isLoading } = useActivityFeed()

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Skeleton className="size-4" />
          <Skeleton className="h-4 w-24" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="size-5 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-3 w-8" />
          </div>
        ))}
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-8 text-center">
        <Activity className="text-muted-foreground size-8" />
        <p className="text-sm font-medium">No recent activity</p>
        <p className="text-muted-foreground text-xs">Trade events and signals will appear here</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {/* Section label */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-muted-foreground flex items-center gap-2 text-xs font-medium uppercase tracking-wider">
          <Activity className="size-3.5" />
          Activity
        </h2>
        <span className="text-muted-foreground/60 text-[10px] tabular-nums">
          {events.length} event{events.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Event list — desktop shows MAX_DISPLAY, mobile shows MAX_DISPLAY_MOBILE */}
      <div className="divide-border/50 divide-y">
        {events.slice(0, MAX_DISPLAY).map((event, i) => (
          <ActivityItem
            key={event.id}
            type={event.type}
            title={event.title}
            detail={event.detail}
            timestamp={event.timestamp}
            intent={event.intent}
            className={i >= MAX_DISPLAY_MOBILE ? "hidden md:flex" : undefined}
          />
        ))}
      </div>

      {/* More indicator (mobile) */}
      {events.length > MAX_DISPLAY_MOBILE && (
        <p className="text-muted-foreground/60 px-1 text-center text-[10px] md:hidden">
          +{events.length - MAX_DISPLAY_MOBILE} more events
        </p>
      )}
    </div>
  )
}
