"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Landmark,
  Radio,
  Search,
  Sparkles,
  Bot,
  Activity,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface SettingsNavItem {
  label: string
  href: string
  icon: LucideIcon
  variant?: "destructive"
}

const SETTINGS_NAV: SettingsNavItem[] = [
  { label: "OANDA", href: "/settings/oanda", icon: Landmark },
  { label: "Trade Finder", href: "/settings/trade-finder", icon: Search },
  { label: "TradingView Alerts", href: "/settings/tv-alerts", icon: Radio },
  { label: "AI Analysis", href: "/settings/ai", icon: Sparkles },
  { label: "AI Trader", href: "/settings/ai-trader", icon: Bot },
  { label: "System", href: "/settings/system", icon: Activity },
  { label: "Reset", href: "/settings/reset", icon: AlertTriangle, variant: "destructive" },
]

export function SettingsNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Settings navigation">
      {/* Desktop: vertical sidebar */}
      <ul className="hidden md:flex md:flex-col md:gap-1">
        {SETTINGS_NAV.map((item) => {
          const isActive = pathname === item.href
          const isDestructive = item.variant === "destructive"
          return (
            <li key={item.href}>
              {isDestructive && <div className="border-border my-1 border-t" />}
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  "focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : isDestructive
                      ? "text-red-400"
                      : "text-muted-foreground",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <item.icon className="size-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>

      {/* Mobile: horizontal scrollable tabs */}
      <div className="flex gap-1 overflow-x-auto pb-2 md:hidden">
        {SETTINGS_NAV.map((item) => {
          const isActive = pathname === item.href
          const isDestructive = item.variant === "destructive"
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                "focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : isDestructive
                    ? "text-red-400"
                    : "text-muted-foreground",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <item.icon className="size-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
