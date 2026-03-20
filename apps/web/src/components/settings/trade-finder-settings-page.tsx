"use client"

import { useState, useCallback } from "react"
import { useTradeFinderConfig } from "@/hooks/use-trade-finder-config"
import { TabNav, TabNavButton } from "@/components/ui/tab-nav"
import { TFSettingsScanner } from "./tf-settings-scanner"
import { TFSettingsAutoTrade } from "./tf-settings-auto-trade"
import { TFSettingsEntry } from "./tf-settings-entry"
import { TFSettingsManagement } from "./tf-settings-management"
import { TFSettingsSafety } from "./tf-settings-safety"
import { TFSettingsPairs } from "./tf-settings-pairs"
import { toast } from "sonner"
import { Globe2, Search, Shield, Zap } from "lucide-react"

type Tab = "scanner" | "auto-trade" | "protection" | "pairs"

export function TradeFinderSettingsPage() {
  const { config, circuitBreaker, isLoading, update, resetCircuitBreaker } =
    useTradeFinderConfig()
  const [activeTab, setActiveTab] = useState<Tab>("scanner")
  const [saving, setSaving] = useState(false)
  const [cancellingAuto, setCancellingAuto] = useState(false)

  const handleUpdate = useCallback(
    async (partial: Parameters<typeof update>[0]) => {
      setSaving(true)
      try {
        await update(partial)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Update failed")
      } finally {
        setSaving(false)
      }
    },
    [update],
  )

  const handleCancelAllAuto = useCallback(async () => {
    setCancellingAuto(true)
    try {
      const res = await fetch("/api/trade-finder/cancel-auto", { method: "POST" })
      const json = await res.json()
      if (json.ok) {
        toast.success(`Cancelled ${json.data.cancelled} auto-placed order(s)`)
      } else {
        toast.error(json.error ?? "Failed to cancel")
      }
    } catch {
      toast.error("Failed to cancel auto-placed orders")
    } finally {
      setCancellingAuto(false)
    }
  }, [])

  if (isLoading || !config) {
    return (
      <div className="text-muted-foreground py-12 text-center text-sm">Loading...</div>
    )
  }

  const pairs = config.pairs
  const enabledCount = pairs.filter((p) => p.enabled).length
  const autoTradeEnabledPairCount = pairs.filter(
    (p) => p.enabled && p.autoTradeEnabled !== false,
  ).length

  return (
    <div className="space-y-4">
      <TabNav>
        <TabNavButton
          active={activeTab === "scanner"}
          onClick={() => setActiveTab("scanner")}
          icon={<Search className="size-3.5" />}
          label="Scanner"
          count={0}
        />
        <TabNavButton
          active={activeTab === "auto-trade"}
          onClick={() => setActiveTab("auto-trade")}
          icon={<Zap className="size-3.5" />}
          label="Auto-Trade"
          count={0}
        />
        <TabNavButton
          active={activeTab === "protection"}
          onClick={() => setActiveTab("protection")}
          icon={<Shield className="size-3.5" />}
          label="Protection"
          count={0}
        />
        <TabNavButton
          active={activeTab === "pairs"}
          onClick={() => setActiveTab("pairs")}
          icon={<Globe2 className="size-3.5" />}
          label="Pairs"
          count={enabledCount}
        />
      </TabNav>

      {activeTab === "scanner" && (
        <TFSettingsScanner config={config} onUpdate={handleUpdate} saving={saving} />
      )}

      {activeTab === "auto-trade" && (
        <TFSettingsAutoTrade
          config={config}
          onUpdate={handleUpdate}
          saving={saving}
          autoTradeEnabledPairCount={autoTradeEnabledPairCount}
          onCancelAll={handleCancelAllAuto}
          cancellingAuto={cancellingAuto}
        />
      )}

      {activeTab === "protection" && (
        <div className="space-y-6">
          <TFSettingsEntry config={config} onUpdate={handleUpdate} saving={saving} />
          <TFSettingsManagement config={config} onUpdate={handleUpdate} saving={saving} />
          <TFSettingsSafety
            circuitBreaker={circuitBreaker}
            onReset={resetCircuitBreaker}
          />
        </div>
      )}

      {activeTab === "pairs" && (
        <TFSettingsPairs
          config={config}
          onUpdate={handleUpdate}
          saving={saving}
          autoTradeEnabledPairCount={autoTradeEnabledPairCount}
        />
      )}
    </div>
  )
}
