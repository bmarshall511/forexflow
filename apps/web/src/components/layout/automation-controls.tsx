"use client"

import { useEffect, useCallback, useState } from "react"
import { Radio, Zap, Bot, Loader2, ChevronDown, Workflow, Sparkles } from "lucide-react"
import type { PlacementSource } from "@fxflow/types"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useKillSwitch } from "@/hooks/use-kill-switch"
import { useTradeFinderConfig } from "@/hooks/use-trade-finder-config"
import { useAiTraderConfig } from "@/hooks/use-ai-trader-config"
import { useSmartFlow } from "@/hooks/use-smart-flow"
import { useAiSettings } from "@/hooks/use-ai-settings"
import { useSourcePriority } from "@/hooks/use-source-priority"
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

/** Default priority order when source priority config is unavailable */
const DEFAULT_PRIORITY: PlacementSource[] = ["trade_finder", "ai_trader", "smart_flow", "tv_alerts"]

// ─── Main component ─────────────────────────────────────────────────────────

export function AutomationControls() {
  const { enabled: tvEnabled, isToggling: tvToggling, toggle: tvToggle } = useKillSwitch()
  const { config: tfConfig, update: tfUpdate } = useTradeFinderConfig()
  const { config: aiConfig, save: aiSave } = useAiTraderConfig()
  const { settings: sfSettings, refetch: sfRefetch } = useSmartFlow()
  const {
    settings: aiAnalysisSettings,
    savePreferences: aiAnalysisSave,
    refetch: aiAnalysisRefetch,
  } = useAiSettings()
  const { config: priorityConfig } = useSourcePriority()
  const priorityOrder = priorityConfig?.priorityOrder ?? DEFAULT_PRIORITY

  const [tfToggling, setTfToggling] = useState(false)
  const [aiToggling, setAiToggling] = useState(false)
  const [sfToggling, setSfToggling] = useState(false)
  const [aaToggling, setAaToggling] = useState(false)

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
      toast.success(aiConfig.enabled ? "EdgeFinder disabled" : "EdgeFinder enabled")
    } catch {
      toast.error("Failed to toggle EdgeFinder")
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

  const handleAaToggle = async () => {
    if (!aiAnalysisSettings) return
    setAaToggling(true)
    try {
      const newEnabled = !aiAnalysisSettings.autoAnalysis.enabled
      await aiAnalysisSave({ enabled: newEnabled })
      toast.success(newEnabled ? "AI Analysis enabled" : "AI Analysis disabled")
      aiAnalysisRefetch()
    } catch {
      toast.error("Failed to toggle AI Analysis")
    } finally {
      setAaToggling(false)
    }
  }

  const tvActive = tvEnabled === true
  const tfActive = tfConfig?.autoTradeEnabled === true
  const aiActive = aiConfig?.enabled === true
  const sfActive = sfSettings?.enabled === true
  const aaActive = aiAnalysisSettings?.autoAnalysis.enabled === true
  const activeCount = [tvActive, tfActive, aiActive, sfActive, aaActive].filter(Boolean).length

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
          aria-label={`Automation controls: ${activeCount} of 5 active`}
        >
          {/* Status dots — ordered by trade priority */}
          <div className="flex items-center gap-1">
            {priorityOrder.map((source) => {
              const dotConfig: Record<PlacementSource, { active: boolean; color: string }> = {
                tv_alerts: { active: tvActive, color: "bg-green-500" },
                trade_finder: { active: tfActive, color: "bg-teal-500" },
                ai_trader: { active: aiActive, color: "bg-violet-500" },
                smart_flow: { active: sfActive, color: "bg-amber-500" },
              }
              const d = dotConfig[source]
              return d ? <StatusDot key={source} active={d.active} color={d.color} /> : null
            })}
            <StatusDot active={aaActive} color="bg-blue-500" />
          </div>
          <span className="@5xl/header:inline hidden whitespace-nowrap">Automation</span>
          <ChevronDown className="size-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <div className="mb-2 px-3 pt-1">
          <p className="text-foreground text-xs font-semibold">Automation Controls</p>
          <p className="text-muted-foreground text-[10px]">{activeCount} of 5 systems active</p>
        </div>

        {/* ── Trade Placement group ── */}
        <div className="space-y-0.5">
          <p className="text-muted-foreground/70 px-3 pb-0.5 text-[9px] font-semibold uppercase tracking-widest">
            Trade Placement (by priority)
          </p>
          {priorityOrder.map((source) => {
            switch (source) {
              case "tv_alerts":
                return tvEnabled !== null ? (
                  <ToggleRow
                    key="tv_alerts"
                    icon={<Radio className="size-4" />}
                    label="TV Alerts"
                    description="TradingView webhook signals"
                    enabled={tvActive}
                    toggling={tvToggling}
                    onToggle={handleTvToggle}
                    color="text-green-500"
                    dotColor="bg-green-500"
                  />
                ) : null
              case "trade_finder":
                return tfConfig ? (
                  <ToggleRow
                    key="trade_finder"
                    icon={<Zap className="size-4" />}
                    label="Trade Finder"
                    description="Automatically place trades when good setups are found"
                    enabled={tfActive}
                    toggling={tfToggling}
                    onToggle={handleTfToggle}
                    color="text-teal-500"
                    dotColor="bg-teal-500"
                  />
                ) : null
              case "ai_trader":
                return aiConfig ? (
                  <ToggleRow
                    key="ai_trader"
                    icon={<Bot className="size-4" />}
                    label="EdgeFinder"
                    description="Autonomous trade discovery"
                    enabled={aiActive}
                    toggling={aiToggling}
                    onToggle={handleAiToggle}
                    color="text-violet-500"
                    dotColor="bg-violet-500"
                  />
                ) : null
              case "smart_flow":
                return sfSettings ? (
                  <ToggleRow
                    key="smart_flow"
                    icon={<Workflow className="size-4" />}
                    label="SmartFlow"
                    description="Intelligent trade management"
                    enabled={sfActive}
                    toggling={sfToggling}
                    onToggle={handleSfToggle}
                    color="text-amber-500"
                    dotColor="bg-amber-500"
                  />
                ) : null
              default:
                return null
            }
          })}
        </div>

        {/* ── Analysis group ── */}
        <div className="mt-2 space-y-0.5">
          <p className="text-muted-foreground/70 px-3 pb-0.5 text-[9px] font-semibold uppercase tracking-widest">
            Analysis
          </p>
          {aiAnalysisSettings && (
            <ToggleRow
              icon={<Sparkles className="size-4" />}
              label="AI Analysis"
              description="Auto-analyze trades with Claude"
              enabled={aaActive}
              toggling={aaToggling}
              onToggle={handleAaToggle}
              color="text-blue-500"
              dotColor="bg-blue-500"
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
