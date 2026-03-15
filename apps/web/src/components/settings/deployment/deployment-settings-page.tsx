"use client"

import { useState, useEffect, useCallback } from "react"
import { Cloud, Monitor, Loader2, CheckCircle2, XCircle, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SectionCard } from "@/components/ui/section-card"
import { cn } from "@/lib/utils"
import type { DeploymentMode } from "@fxflow/shared"

interface DeploymentSettings {
  mode: DeploymentMode
  cloudDaemonUrl: string | null
}

type TestStatus = "idle" | "testing" | "success" | "error"

export function DeploymentSettingsPage() {
  const [settings, setSettings] = useState<DeploymentSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [cloudUrl, setCloudUrl] = useState("")
  const [testStatus, setTestStatus] = useState<TestStatus>("idle")
  const [testError, setTestError] = useState("")

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/deployment")
      const json = (await res.json()) as { ok: boolean; data?: DeploymentSettings }
      if (json.ok && json.data) {
        setSettings(json.data)
        setCloudUrl(json.data.cloudDaemonUrl ?? "")
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchSettings()
  }, [fetchSettings])

  const handleModeChange = async (mode: DeploymentMode) => {
    setSaving(true)
    try {
      const res = await fetch("/api/settings/deployment", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      })
      const json = (await res.json()) as { ok: boolean; data?: DeploymentSettings }
      if (json.ok && json.data) {
        setSettings(json.data)
      }
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  const handleSaveCloudUrl = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/settings/deployment", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cloudDaemonUrl: cloudUrl.trim() || null }),
      })
      const json = (await res.json()) as { ok: boolean; data?: DeploymentSettings }
      if (json.ok && json.data) {
        setSettings(json.data)
      }
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    if (!cloudUrl.trim()) return
    setTestStatus("testing")
    setTestError("")

    try {
      const res = await fetch(`${cloudUrl.trim()}/health`)
      if (res.ok) {
        setTestStatus("success")
      } else {
        setTestStatus("error")
        setTestError(`Daemon returned status ${res.status}`)
      }
    } catch {
      setTestStatus("error")
      setTestError("Could not connect — check the URL and ensure the daemon is running")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    )
  }

  const isCloud = settings?.mode === "cloud"

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Deployment Mode</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Choose how your daemon runs. Local mode runs everything on this machine. Cloud mode
          connects to a remote daemon server.
        </p>
      </div>

      {/* Mode selector */}
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => handleModeChange("local")}
          disabled={saving}
          className={cn(
            "flex flex-col items-start gap-3 rounded-lg border p-4 text-left transition-colors",
            "focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2",
            !isCloud
              ? "border-primary bg-primary/5"
              : "border-border hover:border-muted-foreground/50",
          )}
        >
          <div className="flex items-center gap-2">
            <Monitor
              className={cn("size-5", !isCloud ? "text-primary" : "text-muted-foreground")}
            />
            <span className="font-medium">Local</span>
          </div>
          <span className="text-muted-foreground text-xs">
            Daemon runs on this machine. Data stored locally in SQLite. Best for single-device use.
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleModeChange("cloud")}
          disabled={saving}
          className={cn(
            "flex flex-col items-start gap-3 rounded-lg border p-4 text-left transition-colors",
            "focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2",
            isCloud
              ? "border-primary bg-primary/5"
              : "border-border hover:border-muted-foreground/50",
          )}
        >
          <div className="flex items-center gap-2">
            <Cloud className={cn("size-5", isCloud ? "text-primary" : "text-muted-foreground")} />
            <span className="font-medium">Cloud</span>
          </div>
          <span className="text-muted-foreground text-xs">
            Daemon runs on a remote server (Railway, Fly.io). Always-on, accessible from any device.
          </span>
        </button>
      </div>

      {/* Cloud configuration */}
      {isCloud && (
        <SectionCard
          icon={Cloud}
          title="Cloud Daemon"
          helper="Configure your remote daemon connection"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cloud-daemon-url">Daemon URL</Label>
              <Input
                id="cloud-daemon-url"
                type="url"
                placeholder="https://your-daemon.railway.app"
                value={cloudUrl}
                onChange={(e) => {
                  setCloudUrl(e.target.value)
                  setTestStatus("idle")
                }}
              />
              <p className="text-muted-foreground text-xs">
                The public URL of your deployed daemon. Must include the protocol (https://).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={handleSaveCloudUrl} disabled={saving} size="sm">
                {saving && <Loader2 className="size-4 animate-spin" />}
                Save URL
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={!cloudUrl.trim() || testStatus === "testing"}
              >
                {testStatus === "testing" && <Loader2 className="size-4 animate-spin" />}
                Test Connection
              </Button>
            </div>

            {testStatus === "success" && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 className="size-4" />
                <span>Daemon is reachable</span>
              </div>
            )}

            {testStatus === "error" && (
              <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
                <XCircle className="mt-0.5 size-4 shrink-0" />
                <span>{testError}</span>
              </div>
            )}

            <div className="border-border rounded-md border p-3">
              <h4 className="text-sm font-medium">Deploy your daemon</h4>
              <p className="text-muted-foreground mt-1 text-xs">
                Deploy the FXFlow daemon to Railway or Fly.io using the included Dockerfile. See the
                deployment guide for step-by-step instructions.
              </p>
              <a
                href="https://github.com/your-repo/fxflow#cloud-deployment"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary mt-2 inline-flex items-center gap-1 text-xs hover:underline"
              >
                Deployment Guide
                <ExternalLink className="size-3" />
              </a>
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  )
}
