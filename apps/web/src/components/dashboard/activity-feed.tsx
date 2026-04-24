"use client"

import Link from "next/link"
import { Activity } from "lucide-react"
import { useActivityFeed } from "@/hooks/use-activity-feed"
import { ActivityItem } from "./activity-item"
import { Skeleton } from "@/components/ui/skeleton"
import { SectionCard } from "@/components/dashboard/shared"

/**
 * Live activity rail — the running log of everything the daemon did since
 * the tab opened. Hydrates from `/api/notifications` once on mount and
 * accretes real-time events from the WS stream thereafter. The hook itself
 * caps at 30 entries; this view renders 8 on desktop, 3 on mobile, with a
 * "+N more" footer link pointing at the full notifications page.
 *
 * Wrapped in SectionCard to match Depth Sections and Live Trades visually.
 */
const MAX_DISPLAY = 8
const MAX_DISPLAY_MOBILE = 3

export function ActivityFeed() {
  const { events, isLoading } = useActivityFeed()

  const hidden = Math.max(events.length - MAX_DISPLAY_MOBILE, 0)

  const action =
    events.length > MAX_DISPLAY ? (
      <Link
        href="/notifications"
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring text-[11px] transition-colors focus-visible:rounded focus-visible:outline-none focus-visible:ring-2"
      >
        View all →
      </Link>
    ) : undefined

  return (
    <SectionCard
      icon={<Activity className="size-4" />}
      title="Activity"
      meta={
        !isLoading && events.length > 0
          ? `${events.length} event${events.length !== 1 ? "s" : ""}`
          : undefined
      }
      action={action}
    >
      {isLoading ? (
        <div className="space-y-2" role="status" aria-label="Loading activity">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="size-5 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-3 w-8" />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 py-6 text-center">
          <Activity className="text-muted-foreground size-7" aria-hidden="true" />
          <p className="text-sm font-medium">No recent activity</p>
          <p className="text-muted-foreground text-xs">Trade events and signals will appear here</p>
        </div>
      ) : (
        <>
          <ol
            role="feed"
            aria-busy={isLoading}
            className="divide-border/50 divide-y"
            aria-label="Recent events"
          >
            {events.slice(0, MAX_DISPLAY).map((event, i) => (
              <li
                key={event.id}
                className={i >= MAX_DISPLAY_MOBILE ? "hidden md:block" : undefined}
              >
                <ActivityItem
                  type={event.type}
                  title={event.title}
                  detail={event.detail}
                  timestamp={event.timestamp}
                  intent={event.intent}
                />
              </li>
            ))}
          </ol>
          {hidden > 0 && (
            <Link
              href="/notifications"
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring block rounded px-1 pt-2 text-center text-[10px] focus-visible:outline-none focus-visible:ring-2 md:hidden"
            >
              +{hidden} more events
            </Link>
          )}
        </>
      )}
    </SectionCard>
  )
}
