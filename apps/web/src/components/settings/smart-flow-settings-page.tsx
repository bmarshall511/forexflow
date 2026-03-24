"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { TabNav, TabNavButton } from "@/components/ui/tab-nav"
import { Radar, Zap, Shield, Settings, HelpCircle } from "lucide-react"
import type { SmartFlowSettingsData } from "@fxflow/types"
import { SfSettingsScanner } from "./sf-settings-scanner"
import { SfSettingsAutoTrade } from "./sf-settings-auto-trade"
import { SfSettingsSafety } from "./sf-settings-safety-limits"
import { SfSettingsGeneral } from "./sf-settings-general"
import { SfSettingsHowItWorks } from "./sf-settings-how-it-works"

type Tab = "scanner" | "auto-trade" | "safety" | "general" | "how-it-works"

export function SmartFlowSettingsPage() {
  const [settings, setSettings] = useState<SmartFlowSettingsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>("scanner")
  const hasFetchedOnce = useRef(false)

  const fetchSettings = useCallback(async () => {
    if (!hasFetchedOnce.current) setIsLoading(true)
    try {
      const res = await fetch("/api/smart-flow/settings")
      const json = (await res.json()) as { ok: boolean; data?: SmartFlowSettingsData }
      if (json.ok && json.data) setSettings(json.data)
    } catch {
      toast.error("Failed to load SmartFlow settings")
    } finally {
      setIsLoading(false)
      hasFetchedOnce.current = true
    }
  }, [])

  useEffect(() => {
    void fetchSettings()
  }, [fetchSettings])

  const save = useCallback(
    async (updates: Partial<SmartFlowSettingsData>) => {
      if (!settings) return
      setSettings({ ...settings, ...updates })
      try {
        const res = await fetch("/api/smart-flow/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        })
        const json = (await res.json()) as { ok: boolean }
        if (!json.ok) throw new Error("Save failed")
        toast.success("Settings saved")
      } catch {
        toast.error("Failed to save settings")
        void fetchSettings()
      }
    },
    [settings, fetchSettings],
  )

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!settings) {
    return <p className="text-muted-foreground text-sm">Failed to load SmartFlow settings.</p>
  }

  return (
    <div className="space-y-4">
      <TabNav>
        <TabNavButton
          active={activeTab === "scanner"}
          onClick={() => setActiveTab("scanner")}
          icon={<Radar className="size-3.5" />}
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
          active={activeTab === "safety"}
          onClick={() => setActiveTab("safety")}
          icon={<Shield className="size-3.5" />}
          label="Safety"
          count={0}
        />
        <TabNavButton
          active={activeTab === "general"}
          onClick={() => setActiveTab("general")}
          icon={<Settings className="size-3.5" />}
          label="General"
          count={0}
        />
        <TabNavButton
          active={activeTab === "how-it-works"}
          onClick={() => setActiveTab("how-it-works")}
          icon={<HelpCircle className="size-3.5" />}
          label="How It Works"
          count={0}
        />
      </TabNav>

      {activeTab === "scanner" && <SfSettingsScanner settings={settings} onUpdate={save} />}
      {activeTab === "auto-trade" && <SfSettingsAutoTrade settings={settings} onUpdate={save} />}
      {activeTab === "safety" && <SfSettingsSafety settings={settings} onUpdate={save} />}
      {activeTab === "general" && <SfSettingsGeneral settings={settings} onUpdate={save} />}
      {activeTab === "how-it-works" && <SfSettingsHowItWorks />}
    </div>
  )
}
