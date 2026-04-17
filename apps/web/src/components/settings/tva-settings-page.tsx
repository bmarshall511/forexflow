"use client"

import { useState, useCallback } from "react"
import { useTVAlertsConfig } from "@/hooks/use-tv-alerts-config"
import { useDaemonStatus } from "@/hooks/use-daemon-status"
import { TabNav, TabNavButton } from "@/components/ui/tab-nav"
import { TVASettingsConnection } from "./tva-settings-connection"
import { TVASettingsTrading } from "./tva-settings-trading"
import { TVASettingsQuality } from "./tva-settings-quality"
import { TVASettingsTest } from "./tva-settings-test"
import { TVASettingsManagement } from "./tva-settings-management"
import { toast } from "sonner"
import type { TVAlertsConfig } from "@fxflow/types"
import { TV_ALERTS_DEFAULT_CONFIG } from "@fxflow/types"
import { Plug, Zap, Shield, Settings2, Play } from "lucide-react"

type Tab = "connection" | "trading" | "quality" | "management" | "test"

export function TVAlertsSettingsPage() {
  const {
    config,
    isLoading,
    update,
    regenerateToken,
    reconnectCF,
    deployCFWorker,
    sendTestSignal,
    closeTestTrade,
  } = useTVAlertsConfig()
  const { tvAlertsStatus, isConnected, isReachable } = useDaemonStatus()
  const daemonUp = isConnected || isReachable

  const [activeTab, setActiveTab] = useState<Tab>("connection")
  const [saving, setSaving] = useState(false)

  const data = config ?? TV_ALERTS_DEFAULT_CONFIG

  const handleUpdate = useCallback(
    async (partial: Partial<TVAlertsConfig>) => {
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

  if (isLoading) {
    return <div className="text-muted-foreground py-12 text-center text-sm">Loading...</div>
  }

  const cfConnected = tvAlertsStatus?.cfWorkerConnected ?? false

  return (
    <div className="space-y-4">
      <TabNav>
        <TabNavButton
          active={activeTab === "connection"}
          onClick={() => setActiveTab("connection")}
          icon={<Plug className="size-3.5" />}
          label="Connection"
          count={0}
        />
        <TabNavButton
          active={activeTab === "trading"}
          onClick={() => setActiveTab("trading")}
          icon={<Zap className="size-3.5" />}
          label="Trading"
          count={0}
        />
        <TabNavButton
          active={activeTab === "quality"}
          onClick={() => setActiveTab("quality")}
          icon={<Shield className="size-3.5" />}
          label="Signal Quality"
          count={0}
        />
        <TabNavButton
          active={activeTab === "management"}
          onClick={() => setActiveTab("management")}
          icon={<Settings2 className="size-3.5" />}
          label="Management"
          count={0}
        />
        <TabNavButton
          active={activeTab === "test"}
          onClick={() => setActiveTab("test")}
          icon={<Play className="size-3.5" />}
          label="Test"
          count={0}
        />
      </TabNav>

      {activeTab === "connection" && (
        <TVASettingsConnection
          config={data}
          onUpdate={handleUpdate}
          saving={saving}
          daemonUp={daemonUp}
          cfConnected={cfConnected}
          regenerateToken={regenerateToken}
          reconnectCF={reconnectCF}
          deployCFWorker={deployCFWorker}
        />
      )}

      {activeTab === "trading" && (
        <TVASettingsTrading config={data} onUpdate={handleUpdate} saving={saving} />
      )}

      {activeTab === "quality" && <TVASettingsQuality />}

      {activeTab === "management" && <TVASettingsManagement />}

      {activeTab === "test" && (
        <TVASettingsTest
          cfWorkerConnected={cfConnected}
          moduleEnabled={data.enabled}
          isConnected={daemonUp}
          sendTestSignal={sendTestSignal}
          closeTestTrade={closeTestTrade}
        />
      )}
    </div>
  )
}
