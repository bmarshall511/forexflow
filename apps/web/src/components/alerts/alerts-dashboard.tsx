"use client"

import { useState, useMemo } from "react"
import { usePriceAlerts } from "@/hooks/use-price-alerts"
import type { PriceAlertData, PriceAlertStatus } from "@fxflow/types"
import { AlertList } from "./alert-list"
import { AlertForm } from "./alert-form"
import { Button } from "@/components/ui/button"
import { TabNav, TabNavButton } from "@/components/ui/tab-nav"
import { Bell, BellOff, BellRing, Plus, Loader2, List } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { toast } from "sonner"

type Tab = "active" | "triggered" | "all"

const TAB_FILTERS: Record<Tab, PriceAlertStatus[] | null> = {
  active: ["active"],
  triggered: ["triggered"],
  all: null,
}

export function AlertsDashboard() {
  const { alerts, isLoading, createAlert, updateAlert, deleteAlert, cancelAll } = usePriceAlerts()
  const [tab, setTab] = useState<Tab>("active")
  const [formOpen, setFormOpen] = useState(false)
  const [editingAlert, setEditingAlert] = useState<PriceAlertData | null>(null)

  const filteredAlerts = useMemo(() => {
    const filter = TAB_FILTERS[tab]
    if (!filter) return alerts
    return alerts.filter((a) => filter.includes(a.status))
  }, [alerts, tab])

  const activeCount = useMemo(() => alerts.filter((a) => a.status === "active").length, [alerts])
  const triggeredCount = useMemo(
    () => alerts.filter((a) => a.status === "triggered").length,
    [alerts],
  )

  const handleCreate = async (data: Parameters<typeof createAlert>[0]) => {
    try {
      await createAlert(data)
      toast.success("Price alert created")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create alert")
    }
  }

  const handleUpdate = async (id: string, data: Parameters<typeof updateAlert>[1]) => {
    try {
      await updateAlert(id, data)
      toast.success("Alert updated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update alert")
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteAlert(id)
      toast.success("Alert deleted")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete alert")
    }
  }

  const handleCancelAll = async () => {
    try {
      await cancelAll()
      toast.success("All active alerts cancelled")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel alerts")
    }
  }

  const handleEdit = (alert: PriceAlertData) => {
    setEditingAlert(alert)
    setFormOpen(true)
  }

  const handleFormClose = (open: boolean) => {
    setFormOpen(open)
    if (!open) setEditingAlert(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Price Alerts"
        subtitle="Get notified when price crosses your target levels."
        icon={Bell}
        actions={
          <>
            {activeCount > 0 && (
              <Button variant="outline" size="sm" onClick={() => void handleCancelAll()}>
                <BellOff className="mr-1.5 size-4" />
                Cancel All
              </Button>
            )}
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="mr-1.5 size-4" />
              Create Alert
            </Button>
          </>
        }
      />

      {/* Tabs */}
      <TabNav>
        <TabNavButton
          active={tab === "active"}
          onClick={() => setTab("active")}
          icon={<Bell className="size-4" />}
          label="Active"
          count={activeCount}
        />
        <TabNavButton
          active={tab === "triggered"}
          onClick={() => setTab("triggered")}
          icon={<BellRing className="size-4" />}
          label="Triggered"
          count={triggeredCount}
        />
        <TabNavButton
          active={tab === "all"}
          onClick={() => setTab("all")}
          icon={<List className="size-4" />}
          label="All"
          count={alerts.length}
        />
      </TabNav>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="text-muted-foreground size-6 animate-spin" />
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <Bell className="text-muted-foreground/40 size-12" />
          <p className="text-muted-foreground text-sm">
            {tab === "active"
              ? "No active alerts. Create one to get started."
              : tab === "triggered"
                ? "No triggered alerts yet."
                : "No alerts found."}
          </p>
          {tab === "active" && (
            <Button variant="outline" size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="mr-1.5 size-4" />
              Create Alert
            </Button>
          )}
        </div>
      ) : (
        <AlertList
          alerts={filteredAlerts}
          onEdit={handleEdit}
          onDelete={(id) => void handleDelete(id)}
        />
      )}

      {/* Form sheet */}
      <AlertForm
        open={formOpen}
        onOpenChange={handleFormClose}
        onSubmit={handleCreate}
        editingAlert={editingAlert}
        onUpdate={handleUpdate}
      />
    </div>
  )
}
