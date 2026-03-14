"use client"

import { MobileSidebarToggle } from "./sidebar-toggle-button"
import { HeaderSystemHealth } from "./header-system-health"
import { HeaderAccountInfo } from "./header-account-info"
import { HeaderPositions } from "./header-positions"
import { TradingModeToggle } from "./trading-mode-toggle"
import { MarketStatus } from "./market-status"

import { AutomationControls } from "./automation-controls"
import { NotificationBell } from "./notification-bell"
import { ThemeToggle } from "./theme-toggle"

export function Header() {
  return (
    <header
      className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 flex h-[var(--header-height)] shrink-0 items-center border-b px-3 backdrop-blur"
      role="banner"
    >
      {/* Container query wrapper — children respond to available header width, not viewport */}
      <div className="@container/header flex min-w-0 flex-1 items-center">
        {/* Mobile: hamburger (hidden when container >= 512px) */}
        <div className="@lg/header:hidden flex items-center gap-2">
          <MobileSidebarToggle />
        </div>

        {/* Left cluster: account info, positions, system health */}
        <div className="@xl/header:gap-1.5 flex items-center gap-1">
          <HeaderAccountInfo />
          <div className="@xl/header:flex hidden">
            <HeaderPositions />
          </div>
          <HeaderSystemHealth />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right cluster: mode toggle → market status → automation → bell → theme */}
        <div className="@xl/header:gap-2 flex items-center gap-1">
          <TradingModeToggle />
          <MarketStatus />
          <AutomationControls />
          <NotificationBell />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
