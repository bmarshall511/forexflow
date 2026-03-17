"use client"

import { useState, useCallback } from "react"
import type { SmartFlowConfigData, SmartFlowPreset } from "@fxflow/types"
import { toast } from "sonner"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DirectionBadge } from "@/components/positions/direction-badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Layers, Trash2, ShieldCheck, TrendingUp, Target, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

const PRESET_LABELS: Record<SmartFlowPreset, string> = {
  momentum_catch: "Momentum Catch",
  steady_growth: "Steady Growth",
  swing_capture: "Swing Capture",
  trend_rider: "Trend Rider",
  recovery: "Recovery",
  custom: "Custom",
}

interface ConfigsTabProps {
  configs: SmartFlowConfigData[]
  onRefresh: () => void
}

export function ConfigsTab({ configs, onRefresh }: ConfigsTabProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/smart-flow/configs/${id}`, { method: "DELETE" })
        const json = (await res.json()) as { ok: boolean; error?: string }
        if (!json.ok) {
          toast.error(json.error ?? "Failed to delete configuration")
          return
        }
        toast.success("Configuration deleted")
        onRefresh()
      } catch {
        toast.error("Something went wrong")
      } finally {
        setDeleteId(null)
      }
    },
    [onRefresh],
  )

  const handleToggle = useCallback(
    async (config: SmartFlowConfigData) => {
      setToggling(config.id)
      const action = config.isActive ? "deactivate" : "activate"
      try {
        const res = await fetch(`/api/smart-flow/configs/${config.id}/${action}`, {
          method: "POST",
        })
        const json = (await res.json()) as { ok: boolean; error?: string }
        if (!json.ok) {
          toast.error(json.error ?? `Failed to ${action}`)
          return
        }
        toast.success(config.isActive ? "Configuration paused" : "Configuration activated")
        onRefresh()
      } catch {
        toast.error("Something went wrong")
      } finally {
        setToggling(null)
      }
    },
    [onRefresh],
  )

  if (configs.length === 0) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-12 text-center">
        <div className="bg-primary/10 mx-auto flex size-12 items-center justify-center rounded-full">
          <Layers className="text-primary size-6" />
        </div>
        <h3 className="text-foreground text-base font-semibold">No configurations yet</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Create one from the Trade tab. Configurations save your strategy settings for a currency
          pair so you can reuse them.
        </p>
      </div>
    )
  }

  const grouped = configs.reduce<Record<string, SmartFlowConfigData[]>>((acc, c) => {
    ;(acc[c.instrument] ??= []).push(c)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        {configs.length} {configs.length === 1 ? "configuration" : "configurations"}
      </p>

      {Object.entries(grouped).map(([instrument, items]) => (
        <div key={instrument} className="space-y-3">
          <h3 className="text-foreground text-sm font-semibold">{instrument.replace("_", "/")}</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {items.map((config) => (
              <ConfigCard
                key={config.id}
                config={config}
                toggling={toggling === config.id}
                onToggle={() => handleToggle(config)}
                onDelete={() => setDeleteId(config.id)}
              />
            ))}
          </div>
        </div>
      ))}

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete configuration?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this configuration. Any active trades using it will
              continue but won&apos;t be managed after they close.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function ConfigCard({
  config,
  toggling,
  onToggle,
  onDelete,
}: {
  config: SmartFlowConfigData
  toggling: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  const fmtAtr = (v: number | null) => (v != null ? `${v.toFixed(1)}x ATR` : "--")

  return (
    <Card className={cn("transition-opacity", !config.isActive && "opacity-60")}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold">{config.name}</span>
          <DirectionBadge direction={config.direction} />
        </div>
        <Badge variant="outline" className="shrink-0 text-[10px]">
          {PRESET_LABELS[config.preset] ?? config.preset}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 pb-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          <span className="text-muted-foreground flex items-center gap-1">
            <Target className="size-3" /> SL: {fmtAtr(config.stopLossAtrMultiple)}
          </span>
          <span className="text-muted-foreground flex items-center gap-1">
            <TrendingUp className="size-3" /> TP: {fmtAtr(config.takeProfitAtrMultiple)}
          </span>
          <span className="text-muted-foreground flex items-center gap-1">
            <ShieldCheck className="size-3" /> BE: {config.breakevenEnabled ? "On" : "Off"}
          </span>
          <span className="text-muted-foreground flex items-center gap-1">
            <Clock className="size-3" /> Trail: {config.trailingEnabled ? "On" : "Off"}
          </span>
        </div>

        <div className="flex items-center justify-between border-t pt-2">
          <span className="text-muted-foreground text-[10px]">
            Created {new Date(config.createdAt).toLocaleDateString()}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              disabled={toggling}
              onClick={onToggle}
            >
              {config.isActive ? "Pause" : "Activate"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive h-7 px-2"
              onClick={onDelete}
              aria-label={`Delete ${config.name}`}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
