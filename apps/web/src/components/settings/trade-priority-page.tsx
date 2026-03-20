"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { ToggleSwitch } from "@/components/ui/toggle-switch"
import { ArrowUpDown, RefreshCw, GripVertical } from "lucide-react"
import { useSourcePriority } from "@/hooks/use-source-priority"
import { formatRelativeTime } from "@fxflow/shared"
import type { PlacementSource } from "@fxflow/types"

const SOURCE_LABELS: Record<PlacementSource, string> = {
  trade_finder: "Trade Finder",
  tv_alerts: "TradingView Alerts",
  ai_trader: "EdgeFinder",
  smart_flow: "SmartFlow",
}

const selectClass =
  "flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"

export function TradePriorityPage() {
  const { config, logs, isLoading, updateConfig, refreshLogs } = useSourcePriority()

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }
  if (!config) {
    return <p className="text-muted-foreground text-sm">Failed to load trade priority settings.</p>
  }

  const moveSource = (source: PlacementSource, direction: "up" | "down") => {
    const order = [...config.priorityOrder]
    const idx = order.indexOf(source)
    if (idx < 0) return
    const targetIdx = direction === "up" ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= order.length) return
    ;[order[idx], order[targetIdx]] = [order[targetIdx]!, order[idx]!]
    void updateConfig({ priorityOrder: order })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowUpDown className="text-primary size-4" />
            Source Priority Order
          </CardTitle>
          <CardDescription>
            When multiple sources target the same instrument, the higher-priority source wins.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm">Enabled</p>
              <p className="text-muted-foreground text-xs">
                Enforce priority rules on conflicting signals
              </p>
            </div>
            <ToggleSwitch
              checked={config.enabled}
              onChange={(v) => void updateConfig({ enabled: v })}
            />
          </div>
          <Separator />
          <div className="space-y-2">
            <p className="text-xs font-medium">Priority Mode</p>
            <select
              value={config.mode}
              onChange={(e) =>
                void updateConfig({ mode: e.target.value as "manual" | "auto_select" })
              }
              className={selectClass}
            >
              <option value="manual">Manual — you set the rank order</option>
              <option value="auto_select">Auto — ranked by recent win rate</option>
            </select>
          </div>
          <Separator />
          <div className="space-y-3">
            <p className="text-xs font-medium">
              Priority Ranking{" "}
              <span className="text-muted-foreground font-normal">(highest priority first)</span>
            </p>
            <ol className="space-y-1.5">
              {config.priorityOrder.map((source, i) => (
                <li
                  key={source}
                  className="bg-muted/50 flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <GripVertical className="text-muted-foreground/40 size-4" />
                    <span className="bg-muted text-muted-foreground flex size-5 items-center justify-center rounded-full font-mono text-[10px]">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium">{SOURCE_LABELS[source] ?? source}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      disabled={i === 0}
                      onClick={() => moveSource(source, "up")}
                      aria-label={`Move ${SOURCE_LABELS[source]} up`}
                    >
                      ↑
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      disabled={i === config.priorityOrder.length - 1}
                      onClick={() => moveSource(source, "down")}
                      aria-label={`Move ${SOURCE_LABELS[source]} down`}
                    >
                      ↓
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Recent Priority Log
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 gap-1 text-xs"
              onClick={refreshLogs}
            >
              <RefreshCw className="size-3" /> Refresh
            </Button>
          </CardTitle>
          <CardDescription>Recent conflict resolution decisions.</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-xs">
              No priority events yet.
            </p>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {logs.slice(0, 20).map((log) => (
                <div key={log.id} className="bg-muted/30 rounded-md border px-3 py-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{log.instrument.replace("_", "/")}</span>
                    <span className="text-muted-foreground">
                      {formatRelativeTime(log.createdAt)}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1">
                    <span className="text-foreground font-medium">
                      {SOURCE_LABELS[log.requestingSource as PlacementSource] ??
                        log.requestingSource}
                    </span>
                    {log.existingSource ? (
                      <>
                        {" vs "}
                        <span className="text-foreground font-medium">
                          {SOURCE_LABELS[log.existingSource as PlacementSource] ??
                            log.existingSource}
                        </span>
                      </>
                    ) : null}
                    {" — "}
                    {log.reason} ({log.action})
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
