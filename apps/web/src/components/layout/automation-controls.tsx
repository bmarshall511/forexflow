"use client"

import { useEffect, useCallback, useState } from "react"
import { Radio, Zap, Bot, Loader2, ChevronDown, Workflow } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useKillSwitch } from "@/hooks/use-kill-switch"
import { useTradeFinderConfig } from "@/hooks/use-trade-finder-config"
import { useAiTraderConfig } from "@/hooks/use-ai-trader-config"
import { useSmartFlow } from "@/hooks/use-smart-flow"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ─── Individual toggle row ──────────────────────────────────────────────────

interface ToggleRowProps {
  icon: React.ReactNode
  label: string
  description: string
  enabled: boolean
  toggling: boolean
  onToggle: () => void
  color: string
  dotColor: string
}

function ToggleRow({
  icon,
  label,
  description,
  enabled,
  toggling,
  onToggle,
  color,
  dotColor,
}: ToggleRowProps) {
  return (
    <button
      onClick={onToggle}
      disabled={toggling}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
        "hover:bg-muted/60 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2",
        "disabled:pointer-events-none disabled:opacity-50",
      )}
      aria-label={`${label}: ${enabled ? "Active" : "Off"}. Click to ${enabled ? "disable" : "enable"}`}
    >
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md",
          enabled ? "bg-muted" : "bg-muted/40",
        )}
      >
        {toggling ? (
          <Loader2 className="text-muted-foreground size-4 animate-spin" />
        ) : (
          <span className={enabled ? color : "text-muted-foreground"}>{icon}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              enabled ? `${dotColor} text-white` : "bg-muted text-muted-foreground",
            )}
          >
            {enabled ? "On" : "Off"}
          </span>
        </div>
        <p className="text-muted-foreground text-[11px] leading-tight">{description}</p>
      </div>
    </button>
  )
}

// ─── Summary dots for trigger button ────────────────────────────────────────

function StatusDot({ active, color }: { active: boolean; color: string }) {
  return (
    <span
      className={cn(
        "size-1.5 rounded-full transition-colors",
        active ? color : "bg-muted-foreground/30",
      )}
    />
  )
}

// ─── Main component ─────────────────────────────────────────────────────────

export function AutomationControls() {
  const { enabled: tvEnabled, isToggling: tvToggling, toggle: tvToggle } = useKillSwitch()
  const { config: tfConfig, update: tfUpdate } = useTradeFinderConfig()
  const { config: aiConfig, save: aiSave } = useAiTraderConfig()
  const { settings: sfSettings, refetch: sfRefetch } = useSmartFlow()

  const [tfToggling, setTfToggling] = useState(false)
  const [aiToggling, setAiToggling] = useState(false)
  const [sfToggling, setSfToggling] = useState(false)

  const handleTvToggle = useCallback(async () => {
    try {
      await tvToggle()
    } catch {
      /* logged in hook */
    }
  }, [tvToggle])

  // Keyboard shortcut: Ctrl+Shift+K for TV Alerts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "K") {
        e.preventDefault()
        void handleTvToggle()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [handleTvToggle])

  const handleTfToggle = async () => {
    if (!tfConfig) return
    setTfToggling(true)
    try {
      await tfUpdate({ autoTradeEnabled: !tfConfig.autoTradeEnabled })
      toast.success(tfConfig.autoTradeEnabled ? "Auto-trade disabled" : "Auto-trade enabled")
    } catch {
      toast.error("Failed to toggle auto-trade")
    } finally {
      setTfToggling(false)
    }
  }

  const handleAiToggle = async () => {
    if (!aiConfig) return
    setAiToggling(true)
    try {
      await aiSave({ enabled: !aiConfig.enabled })
      toast.success(aiConfig.enabled ? "AI Trader disabled" : "AI Trader enabled")
    } catch {
      toast.error("Failed to toggle AI Trader")
    } finally {
      setAiToggling(false)
    }
  }

  const handleSfToggle = async () => {
    if (!sfSettings) return
    setSfToggling(true)
    try {
      const res = await fetch("/api/smart-flow/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !sfSettings.enabled }),
      })
      const json = (await res.json()) as { ok: boolean; error?: string }
      if (!json.ok) throw new Error(json.error ?? "Failed")
      toast.success(sfSettings.enabled ? "SmartFlow disabled" : "SmartFlow enabled")
      sfRefetch()
    } catch {
      toast.error("Failed to toggle SmartFlow")
    } finally {
      setSfToggling(false)
    }
  }

  const tvActive = tvEnabled === true
  const tfActive = tfConfig?.autoTradeEnabled === true
  const aiActive = aiConfig?.enabled === true
  const sfActive = sfSettings?.enabled === true
  const activeCount = [tvActive, tfActive, aiActive, sfActive].filter(Boolean).length

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "relative h-8 gap-1.5 px-2 text-xs font-medium",
            activeCount > 0 ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
          aria-label={`Automation controls: ${activeCount} of 4 active`}
        >
          {/* Status dots */}
          <div className="flex items-center gap-1">
            <StatusDot active={tvActive} color="bg-green-500" />
            <StatusDot active={tfActive} color="bg-teal-500" />
            <StatusDot active={aiActive} color="bg-violet-500" />
            <StatusDot active={sfActive} color="bg-amber-500" />
          </div>
          <span className="@5xl/header:inline hidden whitespace-nowrap">Automation</span>
          <ChevronDown className="size-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <div className="mb-2 px-3 pt-1">
          <p className="text-foreground text-xs font-semibold">Automation Controls</p>
          <p className="text-muted-foreground text-[10px]">{activeCount} of 4 systems active</p>
        </div>
        <div className="space-y-0.5">
          {tvEnabled !== null && (
            <ToggleRow
              icon={<Radio className="size-4" />}
              label="TV Alerts"
              description="TradingView webhook signals"
              enabled={tvActive}
              toggling={tvToggling}
              onToggle={handleTvToggle}
              color="text-green-500"
              dotColor="bg-green-500"
            />
          )}
          {tfConfig && (
            <ToggleRow
              icon={<Zap className="size-4" />}
              label="Auto-Trade"
              description="Trade Finder auto-placement"
              enabled={tfActive}
              toggling={tfToggling}
              onToggle={handleTfToggle}
              color="text-teal-500"
              dotColor="bg-teal-500"
            />
          )}
          {aiConfig && (
            <ToggleRow
              icon={<Bot className="size-4" />}
              label="AI Trader"
              description="Autonomous trade discovery"
              enabled={aiActive}
              toggling={aiToggling}
              onToggle={handleAiToggle}
              color="text-violet-500"
              dotColor="bg-violet-500"
            />
          )}
          {sfSettings && (
            <ToggleRow
              icon={<Workflow className="size-4" />}
              label="SmartFlow"
              description="Intelligent trade management"
              enabled={sfActive}
              toggling={sfToggling}
              onToggle={handleSfToggle}
              color="text-amber-500"
              dotColor="bg-amber-500"
            />
          )}
        </div>
        <div className="border-border mt-2 border-t px-3 pt-2">
          <p className="text-muted-foreground text-[10px]">
            <kbd className="bg-muted rounded px-1 py-0.5 font-mono text-[9px]">Ctrl+Shift+K</kbd>{" "}
            Toggle TV Alerts
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}
