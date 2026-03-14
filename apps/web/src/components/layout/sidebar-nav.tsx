"use client"

import { NAV_GROUPS } from "@/lib/constants"
import { useSidebar } from "@/hooks/use-sidebar"
import { useSidebarBadges } from "@/hooks/use-sidebar-badges"
import { SidebarNavItem } from "./sidebar-nav-item"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

export function SidebarNav() {
  const { isOpen } = useSidebar()
  const badges = useSidebarBadges()

  return (
    <nav
      aria-label="Main navigation"
      className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-4"
    >
      {NAV_GROUPS.map((group, index) => (
        <div key={group.label}>
          {index > 0 && <Separator className="my-3" />}
          {isOpen ? (
            <span className="text-muted-foreground/60 mb-1 block px-3 text-[11px] font-semibold uppercase tracking-wider">
              {group.label}
            </span>
          ) : (
            index > 0 && <span className="sr-only">{group.label}</span>
          )}
          <div className={cn("flex flex-col gap-0.5", isOpen && "mt-1")}>
            {group.items.map((item) => (
              <SidebarNavItem
                key={item.href}
                item={item}
                badges={item.badgeKey ? badges[item.badgeKey] : undefined}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  )
}
