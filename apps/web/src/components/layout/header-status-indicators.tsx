"use client"

import { StatusIndicator } from "./status-indicator"

export function HeaderStatusIndicators() {
  return (
    <div className="hidden lg:flex items-center gap-2 rounded-md bg-muted/50 px-3 py-1.5">
      <StatusIndicator label="OANDA" status="connected" />
      <StatusIndicator label="Internet" status="connected" />
      <StatusIndicator label="Daemons" status="connected" />
      <StatusIndicator label="CF" status="warning" />
    </div>
  )
}
