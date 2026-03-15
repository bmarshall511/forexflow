"use client"

import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetTrigger, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { useNotificationContext } from "@/state/notification-context"
import { NotificationPanel } from "./notification-panel"

export function NotificationBell() {
  const { undismissedCount } = useNotificationContext()

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative"
          aria-label={`Notifications${undismissedCount > 0 ? `, ${undismissedCount} unread` : ""}`}
        >
          <Bell className="size-4" />
          {undismissedCount > 0 && (
            <span
              className={cn(
                "absolute -right-1.5 -top-1.5 flex min-w-[18px] items-center justify-center rounded-full px-1 py-0.5",
                "ring-background bg-red-500 text-[10px] font-semibold leading-none text-white ring-2",
              )}
              aria-hidden="true"
            >
              {undismissedCount > 99 ? "99+" : undismissedCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" showCloseButton={false} className="gap-0 p-0">
        <SheetTitle className="sr-only">Notifications</SheetTitle>
        <NotificationPanel />
      </SheetContent>
    </Sheet>
  )
}
