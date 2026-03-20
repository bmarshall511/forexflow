"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useSidebar } from "@/hooks/use-sidebar"
import { cn } from "@/lib/utils"
import type { NavItem } from "@/lib/constants"
import type { NavBadge } from "@/hooks/use-sidebar-badges"
import type { SidebarStatus } from "@/hooks/use-sidebar-status"

const STATUS_COLORS: Record<SidebarStatus["variant"], string> = {
  default: "text-sidebar-foreground/50",
  active: "text-blue-400",
  warning: "text-amber-400",
  error: "text-red-400",
}

interface SidebarNavItemProps {
  item: NavItem
  badges?: NavBadge[]
  status?: SidebarStatus
}

export function SidebarNavItem({ item, badges, status }: SidebarNavItemProps) {
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
        "focus-visible:ring-sidebar-ring focus-visible:outline-none focus-visible:ring-2",
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
            className="bg-primary text-primary-foreground ring-sidebar absolute -right-2.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold tabular-nums ring-2"
            aria-hidden="true"
          >
            {totalCount}
          </span>
        )}
      </span>

      {/* Expanded: label + status lines + badge indicators */}
      {isOpen && (
        <>
          <div className="min-w-0 flex-1">
            <span className="block truncate">{item.label}</span>
            {/* Dynamic status lines */}
            {status && (
              <div className={cn("mt-0.5 space-y-0", STATUS_COLORS[status.variant])}>
                <p className="truncate text-[10px] leading-tight">{status.line1}</p>
                {status.line2 && (
                  <p className="truncate text-[10px] leading-tight opacity-75">{status.line2}</p>
                )}
              </div>
            )}
          </div>
          {hasBadges && !status && (
            <span className="ml-auto flex shrink-0 items-center gap-1.5">
              {visibleBadges.map((badge) => {
                const BadgeIcon = badge.icon
                return (
                  <span
                    key={badge.label}
                    className={cn("flex items-center gap-0.5 tabular-nums", badge.color)}
                    title={`${badge.count} ${badge.label}`}
                  >
                    {BadgeIcon && <BadgeIcon className="size-3" />}
                    <span className="text-[11px] font-semibold leading-none">{badge.count}</span>
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
          {status && (
            <div className={cn("space-y-0.5 text-xs", STATUS_COLORS[status.variant])}>
              <p>{status.line1}</p>
              {status.line2 && <p className="opacity-75">{status.line2}</p>}
            </div>
          )}
          {hasBadges && (
            <div className="flex flex-col gap-0.5">
              {visibleBadges.map((badge) => {
                const BadgeIcon = badge.icon
                return (
                  <span
                    key={badge.label}
                    className={cn("flex items-center gap-1.5 text-xs", badge.color)}
                  >
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
