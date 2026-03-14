"use client"

import { useState } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useTradingMode } from "@/hooks/use-trading-mode"
import { LiveModeConfirmDialog } from "@/components/settings/live-mode-confirm-dialog"

export function TradingModeToggle() {
  const { mode, setMode, isLoading, hasLiveCredentials } = useTradingMode()
  const [showConfirm, setShowConfirm] = useState(false)

  const handleLiveClick = () => {
    if (mode === "live") return
    if (!hasLiveCredentials) {
      toast.warning("Configure Live credentials first", {
        description: "Go to Settings → OANDA to add your Live API token and Account ID.",
      })
      return
    }
    setShowConfirm(true)
  }

  const handlePracticeClick = async () => {
    if (mode === "practice") return
    const result = await setMode("practice")
    if (result.ok) {
      toast.success("Switched to Practice mode")
    } else {
      toast.error("Failed to switch mode", { description: result.error })
    }
  }

  const handleConfirmLive = async () => {
    const result = await setMode("live")
    setShowConfirm(false)
    if (result.ok) {
      toast.success("Switched to Live mode")
    } else {
      toast.error("Failed to switch mode", { description: result.error })
    }
  }

  return (
    <>
      <div
        role="radiogroup"
        aria-label="Trading mode"
        className="bg-muted/60 flex h-7 items-center rounded-full p-0.5"
      >
        <button
          role="radio"
          aria-checked={mode === "live"}
          onClick={handleLiveClick}
          disabled={isLoading}
          className={cn(
            "@5xl/header:px-3 relative rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wide transition-all duration-200",
            "focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2",
            "disabled:pointer-events-none disabled:opacity-50",
            mode === "live"
              ? "bg-status-connected text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <span className="@5xl/header:hidden">L</span>
          <span className="@5xl/header:inline hidden">Live</span>
        </button>
        <button
          role="radio"
          aria-checked={mode === "practice"}
          onClick={handlePracticeClick}
          disabled={isLoading}
          className={cn(
            "@5xl/header:px-3 relative rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wide transition-all duration-200",
            "focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2",
            "disabled:pointer-events-none disabled:opacity-50",
            mode === "practice"
              ? "bg-status-warning text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <span className="@5xl/header:hidden">P</span>
          <span className="@5xl/header:inline hidden">Practice</span>
        </button>
      </div>

      <LiveModeConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        onConfirm={handleConfirmLive}
        isLoading={isLoading}
      />
    </>
  )
}
