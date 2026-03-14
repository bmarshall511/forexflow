"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useTradingMode } from "@/hooks/use-trading-mode"
import { LiveModeConfirmDialog } from "@/components/settings/live-mode-confirm-dialog"
import { OandaCredentialCard } from "@/components/settings/oanda-credential-card"
import type { OandaCredentials, SettingsResponse } from "@fxflow/types"

interface OandaSettingsPageProps {
  initialSettings: SettingsResponse
}

export function OandaSettingsPage({ initialSettings }: OandaSettingsPageProps) {
  const {
    mode,
    setMode,
    isLoading,
    hasLiveCredentials,
    setHasLiveCredentials,
    setHasPracticeCredentials,
  } = useTradingMode()

  const [practiceCredentials, setPracticeCredentials] = useState<OandaCredentials>(
    initialSettings.oanda.practice,
  )
  const [liveCredentials, setLiveCredentials] = useState<OandaCredentials>(
    initialSettings.oanda.live,
  )
  const [showConfirm, setShowConfirm] = useState(false)

  // Sync credential state with context
  useEffect(() => {
    setHasLiveCredentials(liveCredentials.hasToken && liveCredentials.accountId !== "")
  }, [liveCredentials, setHasLiveCredentials])

  useEffect(() => {
    setHasPracticeCredentials(practiceCredentials.hasToken && practiceCredentials.accountId !== "")
  }, [practiceCredentials, setHasPracticeCredentials])

  const handleModeSwitch = async (newMode: "live" | "practice") => {
    if (newMode === mode) return

    if (newMode === "live") {
      if (!hasLiveCredentials) {
        toast.warning("Configure Live credentials first", {
          description: "Add your Live API token and Account ID below before switching.",
        })
        return
      }
      setShowConfirm(true)
      return
    }

    // Switch to practice — no confirmation needed
    const result = await setMode("practice")
    if (result.ok) {
      toast.success("Switched to Practice mode")
    } else {
      toast.error("Failed to switch mode", { description: result.error })
    }
  }

  const handleConfirmLive = async () => {
    const result = await setMode("live")
    setShowConfirm(false)
    if (result.ok) {
      toast.success("Switched to Live mode")
    } else {
      toast.error("Failed to switch mode", { description: result.error })
    }
  }

  const handlePracticeCredentialsChange = useCallback((creds: OandaCredentials) => {
    setPracticeCredentials(creds)
  }, [])

  const handleLiveCredentialsChange = useCallback((creds: OandaCredentials) => {
    setLiveCredentials(creds)
  }, [])

  return (
    <div className="space-y-6">
      {/* Account Mode Section */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Account Mode</CardTitle>
          <CardDescription>
            Select which OANDA account to use for trading. Switching to Live will require
            confirmation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div role="radiogroup" aria-label="Account mode" className="flex gap-3">
            <button
              role="radio"
              aria-checked={mode === "practice"}
              onClick={() => handleModeSwitch("practice")}
              disabled={isLoading}
              className={cn(
                "flex-1 rounded-lg border-2 px-4 py-3 text-left transition-all",
                "focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2",
                "disabled:pointer-events-none disabled:opacity-50",
                mode === "practice"
                  ? "border-status-warning bg-status-warning/5"
                  : "bg-muted/30 hover:bg-muted/50 border-transparent",
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "size-2.5 rounded-full",
                    mode === "practice" ? "bg-status-warning" : "bg-muted-foreground/40",
                  )}
                  aria-hidden="true"
                />
                <span className="text-sm font-semibold">Practice</span>
              </div>
              <p className="text-muted-foreground mt-1 text-xs">Paper trading with virtual funds</p>
            </button>

            <button
              role="radio"
              aria-checked={mode === "live"}
              onClick={() => handleModeSwitch("live")}
              disabled={isLoading}
              className={cn(
                "flex-1 rounded-lg border-2 px-4 py-3 text-left transition-all",
                "focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2",
                "disabled:pointer-events-none disabled:opacity-50",
                mode === "live"
                  ? "border-status-connected bg-status-connected/5"
                  : "bg-muted/30 hover:bg-muted/50 border-transparent",
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "size-2.5 rounded-full",
                    mode === "live" ? "bg-status-connected" : "bg-muted-foreground/40",
                  )}
                  aria-hidden="true"
                />
                <span className="text-sm font-semibold">Live</span>
              </div>
              <p className="text-muted-foreground mt-1 text-xs">Real trading with actual funds</p>
            </button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Credential Cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        <OandaCredentialCard
          mode="practice"
          credentials={practiceCredentials}
          onCredentialsChange={handlePracticeCredentialsChange}
        />
        <OandaCredentialCard
          mode="live"
          credentials={liveCredentials}
          onCredentialsChange={handleLiveCredentialsChange}
        />
      </div>

      <LiveModeConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        onConfirm={handleConfirmLive}
        isLoading={isLoading}
      />
    </div>
  )
}
