"use client"

import { useState, useEffect, useCallback } from "react"
import type {
  SmartFlowConfigData,
  SmartFlowConfigRuntimeStatus,
  SmartFlowActivityEvent,
} from "@fxflow/types"
import { toast } from "sonner"
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
import { Layers } from "lucide-react"
import { logSmartFlowActivity } from "@/lib/smart-flow-activity"
import { ConfigCard } from "./config-card"

interface ConfigsTabProps {
  configs: SmartFlowConfigData[]
  onRefresh: () => void
}

export function ConfigsTab({ configs, onRefresh }: ConfigsTabProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const [runtimeMap, setRuntimeMap] = useState<Record<string, SmartFlowConfigRuntimeStatus>>({})
  const [activityMap, setActivityMap] = useState<Record<string, SmartFlowActivityEvent>>({})

  const fetchRuntime = useCallback(async () => {
    try {
      const res = await fetch("/api/daemon/smart-flow/config-runtime")
      if (!res.ok) return
      const json = (await res.json()) as {
        ok: boolean
        statuses?: SmartFlowConfigRuntimeStatus[]
      }
      if (json.ok && json.statuses) {
        const map: Record<string, SmartFlowConfigRuntimeStatus> = {}
        for (const s of json.statuses) map[s.configId] = s
        setRuntimeMap(map)
      }
    } catch {
      /* daemon may be down */
    }
  }, [])

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch("/api/daemon/smart-flow/activity")
      if (!res.ok) return
      const json = (await res.json()) as {
        ok: boolean
        events?: SmartFlowActivityEvent[]
        data?: SmartFlowActivityEvent[]
      }
      const events = json.events ?? json.data ?? []
      if (!json.ok || events.length === 0) return
      const map: Record<string, SmartFlowActivityEvent> = {}
      for (const e of events) {
        if (e.configId) map[e.configId] = e
      }
      setActivityMap(map)
    } catch {
      /* daemon may be down */
    }
  }, [])

  useEffect(() => {
    void fetchRuntime()
    void fetchActivity()
    const id = setInterval(fetchRuntime, 10_000)
    return () => clearInterval(id)
  }, [fetchRuntime, fetchActivity])

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
        const deleted = configs.find((c) => c.id === id)
        if (deleted) {
          logSmartFlowActivity("config_deleted", `Config deleted: ${deleted.name}`, {
            instrument: deleted.instrument,
            configId: deleted.id,
            severity: "warning",
          })
        }
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
        const activityType = config.isActive ? "config_deactivated" : "config_activated"
        const activityMsg = config.isActive
          ? `Config paused: ${config.name}`
          : `Config activated: ${config.name}`
        logSmartFlowActivity(activityType, activityMsg, {
          instrument: config.instrument,
          configId: config.id,
          severity: config.isActive ? "warning" : "success",
        })
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
                runtime={runtimeMap[config.id] ?? null}
                latestActivity={activityMap[config.id] ?? null}
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
