"use client"

import { useState } from "react"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { PreflightStatus } from "@fxflow/db"
import type { ResetLevel } from "./reset-level-selector"

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

  const hasOpenTrades = preflight.openTrades > 0
  const hasPendingOrders = preflight.pendingOrders > 0
  const hasRunningAnalyses = preflight.runningAnalyses > 0
  const allClear = !hasOpenTrades && !hasPendingOrders && !hasRunningAnalyses

  async function callDaemon(path: string, actionKey: string) {
    setActionLoading(actionKey)
    try {
      await fetch(`${DAEMON_URL}${path}`, { method: "POST" })
      await onRefresh()
    } catch {
      // Refresh anyway to show current state
      await onRefresh()
    } finally {
      setActionLoading(null)
    }
  }

  const checks = [
    {
      key: "trades",
      label: "Open Trades",
      count: preflight.openTrades,
      passed: !hasOpenTrades,
      action: hasOpenTrades
        ? () => callDaemon("/actions/close-all-positions", "trades")
        : undefined,
      actionLabel: "Close All",
    },
    {
      key: "orders",
      label: "Pending Orders",
      count: preflight.pendingOrders,
      passed: !hasPendingOrders,
      action: hasPendingOrders
        ? () => callDaemon("/actions/cancel-all-orders", "orders")
        : undefined,
      actionLabel: "Cancel All",
    },
    {
      key: "analyses",
      label: "Running Analyses",
      count: preflight.runningAnalyses,
      passed: !hasRunningAnalyses,
      action: hasRunningAnalyses
        ? () => callDaemon("/actions/ai/cancel-all", "analyses")
        : undefined,
      actionLabel: "Cancel All",
    },
    {
      key: "conditions",
      label: "Active Conditions",
      count: preflight.activeConditions,
      passed: true, // Informational only
      action: undefined,
      actionLabel: undefined,
    },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Pre-flight Checks</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Ensure there are no active positions before resetting.
        </p>
      </div>

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
