"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { ToggleSwitch } from "@/components/ui/toggle-switch"
import { ArrowUpDown, RefreshCw } from "lucide-react"
import { useSourcePriority } from "@/hooks/use-source-priority"

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
            <Label className="text-xs">Conflict Resolution</Label>
            <select
              value={config.conflictResolution}
              onChange={(e) =>
                void updateConfig({
                  conflictResolution: e.target.value as typeof config.conflictResolution,
                })
              }
              className={selectClass}
            >
              <option value="highest_priority">Highest Priority -- use source rank order</option>
              <option value="most_recent">Most Recent -- latest signal wins</option>
              <option value="manual">Manual -- require user decision</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Cooldown (minutes)</Label>
            <p className="text-muted-foreground text-[11px]">
              Minimum wait after a conflict before re-entering the same instrument
            </p>
            <Input
              type="number"
              min={0}
              max={1440}
              className="h-8 text-xs"
              value={config.cooldownMinutes}
              onChange={(e) =>
                void updateConfig({ cooldownMinutes: parseInt(e.target.value) || 0 })
              }
            />
          </div>
          <Separator />
          <div className="space-y-3">
            <Label className="text-xs">Priority Ranking</Label>
            <ol className="space-y-2">
              {config.priorities
                .sort((a, b) => a.priority - b.priority)
                .map((entry) => (
                  <li
                    key={entry.source}
                    className="bg-muted/50 flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground w-5 text-center font-mono text-xs">
                        {entry.priority}
                      </span>
                      <span className="text-sm font-medium">{entry.label}</span>
                    </div>
                    <ToggleSwitch
                      checked={entry.enabled}
                      onChange={(v) => {
                        const updated = config.priorities.map((p) =>
                          p.source === entry.source ? { ...p, enabled: v } : p,
                        )
                        void updateConfig({ priorities: updated })
                      }}
                    />
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
                    <span className="font-medium">{log.instrument}</span>
                    <span className="text-muted-foreground">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1">
                    <span className="text-foreground font-medium">{log.winningSource}</span>
                    {" beat "}
                    <span className="text-foreground font-medium">{log.losingSource}</span>
                    {" -- "}
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
