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
                "absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center",
                "rounded-full bg-status-disconnected text-[10px] font-medium text-white",
              )}
              aria-hidden="true"
            >
              {undismissedCount > 9 ? "9+" : undismissedCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" showCloseButton={false} className="p-0 gap-0">
        <SheetTitle className="sr-only">Notifications</SheetTitle>
        <NotificationPanel />
      </SheetContent>
    </Sheet>
  )
}
