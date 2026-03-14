"use client"

import { useEffect, useCallback } from "react"
import { Radio, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useKillSwitch } from "@/hooks/use-kill-switch"
import { cn } from "@/lib/utils"

export function KillSwitchButton() {
  const { enabled, isToggling, toggle } = useKillSwitch()

  const handleToggle = useCallback(async () => {
    try {
      await toggle()
    } catch {
      // Error already logged in hook
    }
  }, [toggle])

  // Keyboard shortcut: Ctrl+Shift+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "K") {
        e.preventDefault()
        void handleToggle()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [handleToggle])

  // Don't render if TV Alerts module isn't configured
  if (enabled === null) return null

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "relative h-8 gap-1.5 px-2 text-xs font-medium",
            enabled
              ? "text-green-500 hover:text-green-600"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={handleToggle}
          disabled={isToggling}
          aria-label={
            enabled
              ? "TradingView Alerts Active — Click to disable"
              : "TradingView Alerts Disabled — Click to enable"
          }
        >
          {isToggling ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <>
              <Radio className="size-3.5" />
              {enabled && (
                <span className="absolute -right-0.5 -top-0.5 size-2 animate-pulse rounded-full bg-green-500" />
              )}
            </>
          )}
          <span className="@5xl/header:inline @7xl/header:hidden hidden whitespace-nowrap">
            TV Alerts
          </span>
          <span className="@7xl/header:inline hidden whitespace-nowrap">TradingView Alerts</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{enabled ? "TradingView Alerts: Active" : "TradingView Alerts: Disabled"}</p>
        <p className="text-muted-foreground text-xs">Ctrl+Shift+K</p>
      </TooltipContent>
    </Tooltip>
  )
}
