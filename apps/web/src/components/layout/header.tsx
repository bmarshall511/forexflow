"use client"

import { MobileSidebarToggle } from "./sidebar-toggle-button"
import { HeaderSystemHealth } from "./header-system-health"
import { HeaderAccountInfo } from "./header-account-info"
import { HeaderPositions } from "./header-positions"
import { TradingModeToggle } from "./trading-mode-toggle"
import { MarketStatus } from "./market-status"

import { KillSwitchButton } from "./kill-switch-button"
import { AutoTradeButton } from "./auto-trade-button"
import { NotificationBell } from "./notification-bell"
import { ThemeToggle } from "./theme-toggle"

export function Header() {
  return (
    <header
      className="sticky top-0 z-40 flex h-[var(--header-height)] shrink-0 items-center border-b border-border bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      role="banner"
    >
      {/* Container query wrapper — children respond to available header width, not viewport */}
      <div className="@container/header flex flex-1 items-center min-w-0">
        {/* Mobile: hamburger (hidden when container >= 512px) */}
        <div className="flex items-center gap-2 @lg/header:hidden">
          <MobileSidebarToggle />
        </div>

        {/* Left cluster: account info, positions, system health */}
        <div className="flex items-center gap-1 @xl/header:gap-1.5">
          <HeaderAccountInfo />
          <div className="hidden @xl/header:flex">
            <HeaderPositions />
          </div>
          <HeaderSystemHealth />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right cluster: mode toggle → market status → TV alerts → bell → theme */}
        <div className="flex items-center gap-1 @xl/header:gap-2">
          <TradingModeToggle />
          <MarketStatus />
          <KillSwitchButton />
          <AutoTradeButton />
          <NotificationBell />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
