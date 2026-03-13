"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useSidebar } from "@/hooks/use-sidebar"
import { cn } from "@/lib/utils"
import type { NavItem } from "@/lib/constants"
import type { NavBadge } from "@/hooks/use-sidebar-badges"

interface SidebarNavItemProps {
  item: NavItem
  badges?: NavBadge[]
}

export function SidebarNavItem({ item, badges }: SidebarNavItemProps) {
  const pathname = usePathname()
  const { isOpen } = useSidebar()
  const isActive = pathname === item.href
  const Icon = item.icon

  const visibleBadges = badges?.filter((b) => b.count > 0) ?? []
  const hasBadges = visibleBadges.length > 0
  const totalCount = visibleBadges.reduce((sum, b) => sum + b.count, 0)

  const link = (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70",
        !isOpen && "justify-center px-0",
      )}
      aria-current={isActive ? "page" : undefined}
      aria-label={
        hasBadges
          ? `${item.label} — ${visibleBadges.map((b) => `${b.count} ${b.label}`).join(", ")}`
          : undefined
      }
    >
      {/* Icon with collapsed-state count badge */}
      <span className="relative shrink-0">
        <Icon className="size-5" />
        {!isOpen && hasBadges && (
          <span
            className="absolute -top-1.5 -right-2.5 flex items-center justify-center min-w-[16px] h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold tabular-nums px-1 ring-2 ring-sidebar"
            aria-hidden="true"
          >
            {totalCount}
          </span>
        )}
      </span>

      {/* Expanded: label + badge indicators */}
      {isOpen && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {hasBadges && (
            <span className="ml-auto flex items-center gap-1.5 shrink-0">
              {visibleBadges.map((badge) => {
                const BadgeIcon = badge.icon
                return (
                  <span
                    key={badge.label}
                    className={cn("flex items-center gap-0.5 tabular-nums", badge.color)}
                    title={`${badge.count} ${badge.label}`}
                  >
                    {BadgeIcon && <BadgeIcon className="size-3" />}
                    <span className="text-[11px] font-semibold leading-none">
                      {badge.count}
                    </span>
                  </span>
                )
              })}
            </span>
          )}
        </>
      )}
    </Link>
  )

  if (!isOpen) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8} className="space-y-1">
          <p className="font-medium">{item.label}</p>
          {hasBadges && (
            <div className="flex flex-col gap-0.5">
              {visibleBadges.map((badge) => {
                const BadgeIcon = badge.icon
                return (
                  <span key={badge.label} className={cn("flex items-center gap-1.5 text-xs", badge.color)}>
                    {BadgeIcon && <BadgeIcon className="size-3" />}
                    <span className="font-semibold tabular-nums">{badge.count}</span>
                    <span className="text-muted-foreground">{badge.label}</span>
                  </span>
                )
              })}
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    )
  }

  return link
}
