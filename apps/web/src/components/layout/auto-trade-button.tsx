"use client"

import { Zap, Loader2 } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useTradeFinderConfig } from "@/hooks/use-trade-finder-config"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export function AutoTradeButton() {
  const { config, update } = useTradeFinderConfig()
  const [toggling, setToggling] = useState(false)

  if (!config) return null

  const handleToggle = async () => {
    setToggling(true)
    try {
      await update({ autoTradeEnabled: !config.autoTradeEnabled })
      toast.success(config.autoTradeEnabled ? "Auto-trade disabled" : "Auto-trade enabled")
    } catch {
      toast.error("Failed to toggle auto-trade")
    } finally {
      setToggling(false)
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "relative h-8 gap-1.5 px-2 text-xs font-medium",
            config.autoTradeEnabled
              ? "text-teal-500 hover:text-teal-600"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={handleToggle}
          disabled={toggling}
          aria-label={
            config.autoTradeEnabled
              ? "Auto-Trade Active — Click to disable"
              : "Auto-Trade Disabled — Click to enable"
          }
        >
          {toggling ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <>
              <Zap className="size-3.5" />
              {config.autoTradeEnabled && (
                <span className="absolute -right-0.5 -top-0.5 size-2 animate-pulse rounded-full bg-teal-500" />
              )}
            </>
          )}
          <span className="@5xl/header:inline hidden whitespace-nowrap">Auto-Trade</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{config.autoTradeEnabled ? "Auto-Trade: Active" : "Auto-Trade: Disabled"}</p>
        <p className="text-muted-foreground text-xs">Trade Finder auto-placement</p>
      </TooltipContent>
    </Tooltip>
  )
}
