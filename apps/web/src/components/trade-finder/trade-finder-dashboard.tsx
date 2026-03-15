"use client"

import { useState } from "react"
import Link from "next/link"
import { useTradeFinder } from "@/hooks/use-trade-finder"
import { useTradeFinderConfig } from "@/hooks/use-trade-finder-config"
import { Button } from "@/components/ui/button"
import { TabNav, TabNavButton } from "@/components/ui/tab-nav"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Scan, Settings2, Zap, Trash2, Crosshair, History, Activity, Search } from "lucide-react"
import { SetupCard } from "./setup-card"
import { AutoTradeLog } from "./auto-trade-log"
import { toast } from "sonner"
import { formatRelativeTime } from "@fxflow/shared"
import { PageHeader } from "@/components/ui/page-header"
import { cn } from "@/lib/utils"

type Tab = "active" | "history" | "activity"

export function TradeFinderDashboard() {
  const {
    setups,
    history,
    scanStatus,
    autoTradeEvents,
    isLoading,
    triggerScan,
    placeOrder,
    clearActive,
    clearHistory,
    clearActivity,
  } = useTradeFinder()

  const { config, update: updateConfig } = useTradeFinderConfig()
  const [tab, setTab] = useState<Tab>("active")
  const [, setPlacingId] = useState<string | null>(null)
  const [togglingAutoTrade, setTogglingAutoTrade] = useState(false)

  const handlePlace = async (setupId: string, orderType: "MARKET" | "LIMIT") => {
    setPlacingId(setupId)
    try {
      await placeOrder(setupId, orderType)
      toast.success("Order placed successfully")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to place order")
    } finally {
      setPlacingId(null)
    }
  }

  const handleScan = async () => {
    try {
      await triggerScan()
      toast.info("Scan triggered")
    } catch {
      toast.error("Failed to trigger scan")
    }
  }

  const handleToggleAutoTrade = async () => {
    if (!config) return
    setTogglingAutoTrade(true)
    try {
      await updateConfig({ autoTradeEnabled: !config.autoTradeEnabled })
      toast.success(config.autoTradeEnabled ? "Auto-trade disabled" : "Auto-trade enabled")
    } catch {
      toast.error("Failed to toggle auto-trade")
    } finally {
      setTogglingAutoTrade(false)
    }
  }

  const activeCount = setups.filter((s) => s.status === "active").length
  const approachingCount = setups.filter((s) => s.status === "approaching").length
  const totalActiveSetups = activeCount + approachingCount

  const autoTradeConfig = config
    ? {
        autoTradeEnabled: config.autoTradeEnabled,
        autoTradeMinScore: config.autoTradeMinScore,
        autoTradeMinRR: config.autoTradeMinRR,
      }
    : undefined

  return (
    <div className="min-h-screen">
      {/* ─── Hero Header ─── */}
      <PageHeader
        title="Trade Finder"
        subtitle="Scans the market for high-probability trade setups across multiple timeframes"
        icon={Search}
        bordered
        actions={
          <>
            {config && (
              <Button
                variant={config.autoTradeEnabled ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-8 gap-1.5 text-xs",
                  config.autoTradeEnabled && "bg-teal-600 text-white hover:bg-teal-700",
                )}
                onClick={handleToggleAutoTrade}
                disabled={togglingAutoTrade}
              >
                <Zap className="size-3.5" />
                {config.autoTradeEnabled ? "Auto On" : "Auto Off"}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={handleScan}
              disabled={scanStatus?.isScanning}
            >
              <Scan className={cn("size-3.5", scanStatus?.isScanning && "animate-spin")} />
              {scanStatus?.isScanning ? "Scanning..." : "Scan Now"}
            </Button>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" asChild>
              <Link href="/settings/trade-finder">
                <Settings2 className="size-3.5" />
                <span className="hidden sm:inline">Settings</span>
              </Link>
            </Button>
          </>
        }
      >
        {/* Status tiles */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatusTile
            label="Scanner"
            value={config?.enabled ? "Active" : "Off"}
            variant={config?.enabled ? "positive" : "muted"}
          />
          <StatusTile
            label="Active Setups"
            value={String(totalActiveSetups)}
            subtitle={approachingCount > 0 ? `${approachingCount} approaching` : undefined}
            variant={approachingCount > 0 ? "warning" : "default"}
          />
          <StatusTile
            label="Auto-Trade"
            value={config?.autoTradeEnabled ? `On (≥${config.autoTradeMinScore})` : "Off"}
            variant={config?.autoTradeEnabled ? "accent" : "muted"}
          />
          <StatusTile
            label="Last Scan"
            value={scanStatus?.lastScanAt ? formatRelativeTime(scanStatus.lastScanAt) : "Never"}
            subtitle={
              scanStatus?.isScanning
                ? `${scanStatus.pairsScanned}/${scanStatus.totalPairs} pairs`
                : undefined
            }
            variant={scanStatus?.isScanning ? "warning" : "default"}
          />
        </div>
      </PageHeader>

      {/* ─── Tab Navigation ─── */}
      <TabNav label="Trade finder sections">
        <TabNavButton
          active={tab === "active"}
          onClick={() => setTab("active")}
          icon={<Crosshair className="size-3.5" />}
          label="Setups"
          count={totalActiveSetups}
          pulse={approachingCount > 0}
        />
        <TabNavButton
          active={tab === "history"}
          onClick={() => setTab("history")}
          icon={<History className="size-3.5" />}
          label="Past"
          count={history.length}
        />
        {config?.autoTradeEnabled && (
          <TabNavButton
            active={tab === "activity"}
            onClick={() => setTab("activity")}
            icon={<Activity className="size-3.5" />}
            label="Activity"
            count={autoTradeEvents.length}
          />
        )}
      </TabNav>

      {/* ─── Tab Content ─── */}
      <div className="space-y-4 px-4 py-6 md:px-6">
        {tab === "active" && (
          <>
            {isLoading ? (
              <div className="text-muted-foreground animate-pulse py-12 text-center text-sm">
                Loading setups...
              </div>
            ) : setups.length === 0 ? (
              <div className="text-muted-foreground py-12 text-center text-sm">
                {config?.enabled
                  ? "No setups found yet — the scanner will find them on the next cycle"
                  : "Enable the Trade Finder in settings to start scanning"}
                {!config?.enabled && (
                  <div className="mt-3">
                    <Button variant="outline" size="sm" className="text-xs" asChild>
                      <Link href="/settings/trade-finder">Open Settings</Link>
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Clear all button */}
                <div className="flex justify-end">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive shrink-0 gap-1.5"
                      >
                        <Trash2 className="size-3.5" />
                        <span className="hidden sm:inline">Clear All</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Clear all active setups?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove all currently active setups. New ones will appear on the
                          next scan.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={async () => {
                            try {
                              const count = await clearActive()
                              toast.success(`Cleared ${count} active setup(s)`)
                            } catch {
                              toast.error("Failed to clear setups")
                            }
                          }}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Clear All
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                {/* Approaching setups first */}
                {approachingCount > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="size-2 animate-pulse rounded-full bg-amber-500" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-amber-500">
                        Approaching ({approachingCount})
                      </span>
                    </div>
                    {setups
                      .filter((s) => s.status === "approaching")
                      .map((setup) => (
                        <SetupCard
                          key={setup.id}
                          setup={setup}
                          onPlace={handlePlace}
                          autoTradeConfig={autoTradeConfig}
                        />
                      ))}
                  </div>
                )}

                {/* Active setups */}
                {activeCount > 0 && (
                  <div className="space-y-3">
                    {approachingCount > 0 && (
                      <div className="flex items-center gap-2 pt-2">
                        <div className="size-2 rounded-full bg-blue-500" />
                        <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                          Watching ({activeCount})
                        </span>
                      </div>
                    )}
                    {setups
                      .filter((s) => s.status === "active")
                      .map((setup) => (
                        <SetupCard
                          key={setup.id}
                          setup={setup}
                          onPlace={handlePlace}
                          autoTradeConfig={autoTradeConfig}
                        />
                      ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === "history" && (
          <>
            {history.length === 0 ? (
              <div className="text-muted-foreground py-12 text-center text-sm">
                No past setups to show yet
              </div>
            ) : (
              <>
                <div className="flex justify-end">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive shrink-0 gap-1.5"
                      >
                        <Trash2 className="size-3.5" />
                        <span className="hidden sm:inline">Clear History</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Clear setup history?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete all past setups. This action cannot be
                          undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={async () => {
                            try {
                              const count = await clearHistory()
                              toast.success(`Cleared ${count} history item(s)`)
                            } catch {
                              toast.error("Failed to clear history")
                            }
                          }}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Clear All
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <div className="space-y-3">
                  {history.map((setup) => (
                    <SetupCard key={setup.id} setup={setup} autoTradeConfig={autoTradeConfig} />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {tab === "activity" && config?.autoTradeEnabled && (
          <>
            {autoTradeEvents.length > 0 && (
              <div className="flex justify-end">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive shrink-0 gap-1.5"
                    >
                      <Trash2 className="size-3.5" />
                      <span className="hidden sm:inline">Clear Activity</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear activity log?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will clear the auto-trade activity log. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={async () => {
                          try {
                            await clearActivity()
                            toast.success("Activity log cleared")
                          } catch {
                            toast.error("Failed to clear activity")
                          }
                        }}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Clear All
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
            <AutoTradeLog events={autoTradeEvents} />
          </>
        )}

        {/* Error banner */}
        {scanStatus?.error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-xs text-red-500">
            {scanStatus.error}
          </div>
        )}
      </div>
    </div>
  )
}

function StatusTile({
  label,
  value,
  subtitle,
  variant = "default",
}: {
  label: string
  value: string
  subtitle?: string
  variant?: "default" | "positive" | "warning" | "accent" | "muted"
}) {
  const borderColor = {
    default: "",
    positive: "border-l-2 border-l-green-500",
    warning: "border-l-2 border-l-amber-500",
    accent: "border-l-2 border-l-teal-500",
    muted: "opacity-70",
  }[variant]

  const valueColor = {
    default: "text-foreground",
    positive: "text-green-500",
    warning: "text-amber-500",
    accent: "text-teal-500",
    muted: "text-muted-foreground",
  }[variant]

  return (
    <div className={cn("border-border/50 bg-card space-y-1 rounded-lg border p-3", borderColor)}>
      <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
        {label}
      </span>
      <p className={cn("font-mono text-sm font-semibold tabular-nums", valueColor)}>{value}</p>
      {subtitle && <p className="text-muted-foreground truncate text-[10px]">{subtitle}</p>}
    </div>
  )
}
