"use client"

import { StatusIndicator } from "./status-indicator"

export function HeaderStatusIndicators() {
  return (
    <div className="bg-muted/50 hidden items-center gap-2 rounded-md px-3 py-1.5 lg:flex">
      <StatusIndicator label="OANDA" status="connected" />
      <StatusIndicator label="Internet" status="connected" />
      <StatusIndicator label="Daemons" status="connected" />
      <StatusIndicator label="CF" status="warning" />
    </div>
  )
}
