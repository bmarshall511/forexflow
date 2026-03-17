"use client"

import { useState } from "react"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { PreflightStatus } from "@fxflow/db"
import type { ResetLevel } from "./reset-level-selector"
import { useTradeActions } from "@/hooks/use-trade-actions"
import { useKillSwitch } from "@/hooks/use-kill-switch"
import { useTradeFinderConfig } from "@/hooks/use-trade-finder-config"
import { useAiTraderConfig } from "@/hooks/use-ai-trader-config"

const DAEMON_URL = process.env.NEXT_PUBLIC_DAEMON_REST_URL ?? "http://localhost:4100"

interface PreflightChecksProps {
  preflight: PreflightStatus
  level: ResetLevel
  onNext: () => void
  onBack: () => void
  onRefresh: () => Promise<void>
}

export function PreflightChecks({
  preflight,
  level,
  onNext,
  onBack,
  onRefresh,
}: PreflightChecksProps) {
  const [forceReset, setForceReset] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const { closeAllTrades, cancelAllOrders } = useTradeActions()

  // Automation hooks for disable actions
  const { enabled: tvEnabled, isToggling: tvToggling, toggle: tvToggle } = useKillSwitch()
  const { config: tfConfig, update: tfUpdate } = useTradeFinderConfig()
  const { config: aiConfig, save: aiSave } = useAiTraderConfig()

  // Local overrides for optimistic UI updates after successful actions.
  // The DB roundtrip via onRefresh is unreliable due to daemon reconcile races.
  const [overrides, setOverrides] = useState<Partial<PreflightStatus>>({})
  const merged = { ...preflight, ...overrides }
  const mergedAuto = { ...preflight.automation, ...overrides.automation }

  const hasOpenTrades = merged.openTrades > 0
  const hasPendingOrders = merged.pendingOrders > 0
  const hasRunningAnalyses = merged.runningAnalyses > 0
  const hasActiveConditions = merged.activeConditions > 0

  // Use live hook state (more current than preflight snapshot)
  const isTvEnabled = tvEnabled ?? mergedAuto.tvAlertsEnabled
  const isTfEnabled = tfConfig?.autoTradeEnabled ?? mergedAuto.autoTradeEnabled
  const isAiEnabled = aiConfig?.enabled ?? mergedAuto.aiTraderEnabled
  const hasAutomationEnabled = isTvEnabled || isTfEnabled || isAiEnabled

  const allClear =
    !hasOpenTrades &&
    !hasPendingOrders &&
    !hasRunningAnalyses &&
    !hasActiveConditions &&
    !hasAutomationEnabled

  async function handleCloseAllTrades() {
    setActionLoading("trades")
    try {
      const result = await closeAllTrades(undefined)
      if (result.succeeded > 0) {
        setOverrides((prev) => ({ ...prev, openTrades: 0 }))
      }
      void onRefresh()
    } finally {
      setActionLoading(null)
    }
  }

  async function handleCancelAllOrders() {
    setActionLoading("orders")
    try {
      const result = await cancelAllOrders(undefined)
      if (result.succeeded > 0) {
        setOverrides((prev) => ({ ...prev, pendingOrders: 0 }))
      }
      void onRefresh()
    } finally {
      setActionLoading(null)
    }
  }

  async function handleCancelAllAnalyses() {
    setActionLoading("analyses")
    try {
      const res = await fetch(`${DAEMON_URL}/actions/ai/cancel-all-running`, { method: "POST" })
      if (!res.ok) {
        toast.error("Failed to cancel running analyses")
      } else {
        const json = await res.json()
        const count: number = json.data?.aborted ?? 0
        toast.success(`${count} ${count === 1 ? "analysis" : "analyses"} cancelled`)
        setOverrides((prev) => ({ ...prev, runningAnalyses: 0 }))
      }
      void onRefresh()
    } catch {
      toast.error("Failed to reach daemon")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDisableTvAlerts() {
    setActionLoading("tv_alerts")
    try {
      await tvToggle()
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDisableAutoTrade() {
    setActionLoading("auto_trade")
    try {
      await tfUpdate({ autoTradeEnabled: false })
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDisableAiTrader() {
    setActionLoading("ai_trader")
    try {
      await aiSave({ enabled: false })
    } finally {
      setActionLoading(null)
    }
  }

  async function handleCancelAllConditions() {
    setActionLoading("conditions")
    try {
      const res = await fetch(`${DAEMON_URL}/actions/ai/cancel-all-conditions`, { method: "POST" })
      if (!res.ok) {
        toast.error("Failed to cancel active conditions")
      } else {
        const json = await res.json()
        const count: number = json.data?.cancelled ?? 0
        toast.success(`${count} ${count === 1 ? "condition" : "conditions"} cancelled`)
        setOverrides((prev) => ({ ...prev, activeConditions: 0 }))
      }
      void onRefresh()
    } catch {
      toast.error("Failed to reach daemon")
    } finally {
      setActionLoading(null)
    }
  }

  const checks = [
    {
      key: "trades",
      label: "Open Trades",
      count: merged.openTrades,
      passed: !hasOpenTrades,
      action: hasOpenTrades ? handleCloseAllTrades : undefined,
      actionLabel: "Close All",
    },
    {
      key: "orders",
      label: "Pending Orders",
      count: merged.pendingOrders,
      passed: !hasPendingOrders,
      action: hasPendingOrders ? handleCancelAllOrders : undefined,
      actionLabel: "Cancel All",
    },
    {
      key: "analyses",
      label: "Running Analyses",
      count: merged.runningAnalyses,
      passed: !hasRunningAnalyses,
      action: hasRunningAnalyses ? handleCancelAllAnalyses : undefined,
      actionLabel: "Cancel All",
    },
    {
      key: "conditions",
      label: "Active Conditions",
      count: merged.activeConditions,
      passed: !hasActiveConditions,
      action: hasActiveConditions ? handleCancelAllConditions : undefined,
      actionLabel: "Cancel All",
    },
  ]

  const automationChecks = [
    {
      key: "tv_alerts",
      label: "TV Alerts",
      enabled: isTvEnabled,
      passed: !isTvEnabled,
      action: isTvEnabled ? handleDisableTvAlerts : undefined,
      loading: actionLoading === "tv_alerts" || tvToggling,
    },
    {
      key: "auto_trade",
      label: "Trade Finder Auto-Trade",
      enabled: isTfEnabled,
      passed: !isTfEnabled,
      action: isTfEnabled ? handleDisableAutoTrade : undefined,
      loading: actionLoading === "auto_trade",
    },
    {
      key: "ai_trader",
      label: "AI Trader",
      enabled: isAiEnabled,
      passed: !isAiEnabled,
      action: isAiEnabled ? handleDisableAiTrader : undefined,
      loading: actionLoading === "ai_trader",
    },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Pre-flight Checks</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Disable all automation and close active positions before resetting.
        </p>
      </div>

      {/* Automation checks */}
      <div className="space-y-1.5">
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          Automation
        </p>
        <div className="space-y-2">
          {automationChecks.map((check) => (
            <div
              key={check.key}
              className={cn(
                "flex items-center justify-between rounded-lg border p-3",
                check.passed ? "border-border" : "border-destructive/30 bg-destructive/5",
              )}
            >
              <div className="flex items-center gap-2">
                {check.passed ? (
                  <CheckCircle className="size-5 shrink-0 text-emerald-500" aria-hidden="true" />
                ) : (
                  <XCircle className="size-5 shrink-0 text-red-500" aria-hidden="true" />
                )}
                <span className="text-sm font-medium">{check.label}</span>
                <span className="text-muted-foreground text-sm">
                  ({check.enabled ? "On" : "Off"})
                </span>
              </div>
              {check.action && (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={actionLoading !== null || check.loading}
                  onClick={check.action}
                >
                  {check.loading && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
                  Disable
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Position checks */}
      <div className="space-y-1.5">
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          Positions
        </p>
        <div className="space-y-2">
          {checks.map((check) => (
            <div
              key={check.key}
              className={cn(
                "flex items-center justify-between rounded-lg border p-3",
                check.passed ? "border-border" : "border-destructive/30 bg-destructive/5",
              )}
            >
              <div className="flex items-center gap-2">
                {check.passed ? (
                  <CheckCircle className="size-5 shrink-0 text-emerald-500" aria-hidden="true" />
                ) : (
                  <XCircle className="size-5 shrink-0 text-red-500" aria-hidden="true" />
                )}
                <span className="text-sm font-medium">{check.label}</span>
                <span className="text-muted-foreground text-sm">({check.count})</span>
              </div>
              {check.action && (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={actionLoading !== null}
                  onClick={check.action}
                >
                  {actionLoading === check.key && (
                    <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                  )}
                  {check.actionLabel}
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {!allClear && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <button
            type="button"
            role="checkbox"
            aria-checked={forceReset}
            className="focus-visible:ring-ring flex w-full items-center gap-3 rounded text-left focus-visible:outline-none focus-visible:ring-2"
            onClick={() => setForceReset((v) => !v)}
          >
            <div
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded border",
                forceReset ? "border-amber-500 bg-amber-500 text-white" : "border-amber-500/50",
              )}
              aria-hidden="true"
            >
              {forceReset && (
                <svg className="size-3" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M2 6l3 3 5-5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
            <div>
              <span className="text-sm font-medium text-amber-400">Force Reset</span>
              <p className="text-muted-foreground text-xs">
                Skip trade/order checks. OANDA positions will NOT be closed automatically.
              </p>
            </div>
          </button>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button variant="destructive" disabled={!allClear && !forceReset} onClick={onNext}>
          {level === "fresh_install" ? "Review" : "Next"}
        </Button>
      </div>
    </div>
  )
}
