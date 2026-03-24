"use client"

import { useMemo } from "react"
import { NAV_GROUPS } from "@/lib/constants"
import type { NavItem } from "@/lib/constants"
import { useSidebar } from "@/hooks/use-sidebar"
import { useSidebarBadges } from "@/hooks/use-sidebar-badges"
import { useSidebarStatus } from "@/hooks/use-sidebar-status"
import { useSourcePriority } from "@/hooks/use-source-priority"
import { SidebarNavItem } from "./sidebar-nav-item"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

/**
 * Sort automation nav items by the user's configured source priority order.
 * Items without a priorityKey (e.g. AI Analysis, Alerts) keep their
 * relative position after the prioritized items.
 */
function sortByPriority(items: NavItem[], priorityOrder: string[]): NavItem[] {
  if (priorityOrder.length === 0) return items

  const prioritized: NavItem[] = []
  const unprioritized: NavItem[] = []

  for (const item of items) {
    if (item.priorityKey && priorityOrder.includes(item.priorityKey)) {
      prioritized.push(item)
    } else {
      unprioritized.push(item)
    }
  }

  // Sort prioritized items by their position in the priority order
  prioritized.sort((a, b) => {
    const ai = priorityOrder.indexOf(a.priorityKey!)
    const bi = priorityOrder.indexOf(b.priorityKey!)
    return ai - bi
  })

  return [...prioritized, ...unprioritized]
}

export function SidebarNav() {
  const { isOpen } = useSidebar()
  const badges = useSidebarBadges()
  const statuses = useSidebarStatus()
  const { config: priorityConfig } = useSourcePriority()

  const priorityOrder = priorityConfig?.priorityOrder ?? []

  // Reorder the Automation group by source priority
  const groups = useMemo(
    () =>
      NAV_GROUPS.map((group) => {
        if (group.label !== "Automation") return group
        return { ...group, items: sortByPriority(group.items, priorityOrder) }
      }),
    [priorityOrder],
  )

  return (
    <nav
      aria-label="Main navigation"
      className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-4"
    >
      {groups.map((group, index) => (
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
                status={item.statusKey ? statuses[item.statusKey] : undefined}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  )
}
