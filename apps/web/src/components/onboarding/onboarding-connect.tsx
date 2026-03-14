"use client"

import { useState, useEffect } from "react"
import { Loader2, CheckCircle2, XCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import type { ApiResponse, SettingsResponse, OandaCredentials } from "@fxflow/types"

type ConnectionStatus = "idle" | "loading" | "testing" | "connected" | "error"

export function OnboardingConnect() {
  const [token, setToken] = useState("")
  const [accountId, setAccountId] = useState("")
  const [status, setStatus] = useState<ConnectionStatus>("loading")
  const [errorMsg, setErrorMsg] = useState("")
  const [existingHint, setExistingHint] = useState("")

  // Check if credentials already exist on mount
  useEffect(() => {
    async function check() {
      try {
        const res = await fetch("/api/settings")
        const data = (await res.json()) as ApiResponse<SettingsResponse>
        if (data.ok && data.data) {
          const oanda = data.data.oanda
          const creds: OandaCredentials | undefined = oanda.practice.hasToken
            ? oanda.practice
            : oanda.live.hasToken
              ? oanda.live
              : undefined
          if (creds?.accountId) {
            setExistingHint(
              `Account ${creds.accountId} (token ending ...${creds.tokenLastFour || "****"})`,
            )
            setStatus("connected")
            return
          }
        }
      } catch {
        // ignore — show form
      }
      setStatus("idle")
    }
    void check()
  }, [])

  const canTest = token.trim() !== "" && accountId.trim() !== ""

  const handleSaveAndTest = async () => {
    setStatus("testing")
    setErrorMsg("")

    try {
      const saveRes = await fetch("/api/settings/oanda/credentials", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "practice",
          accountId: accountId.trim(),
          token: token.trim(),
        }),
      })
      const saveData = (await saveRes.json()) as ApiResponse<unknown>
      if (!saveData.ok) {
        setStatus("error")
        setErrorMsg(saveData.error ?? "Failed to save credentials")
        return
      }

      const testRes = await fetch("/api/settings/oanda/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "practice" }),
      })
      const testData = (await testRes.json()) as ApiResponse<{ success: boolean; error?: string }>
      if (testData.ok && testData.data?.success) {
        setStatus("connected")
        setExistingHint("")
      } else {
        setStatus("error")
        setErrorMsg(testData.data?.error ?? testData.error ?? "Connection test failed")
      }
    } catch {
      setStatus("error")
      setErrorMsg("Network error — check that the daemon is running")
    }
  }

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center py-12">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center text-center">
      <h2 className="text-2xl font-bold tracking-tight">Connect OANDA</h2>
      <p className="text-muted-foreground mt-2 max-w-md text-sm">
        Enter your practice account credentials. You can add live credentials later in Settings.
      </p>

      {status === "connected" ? (
        <div className="mt-8 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="size-5" />
            <span className="font-medium">Already connected</span>
          </div>
          {existingHint && <p className="text-muted-foreground text-xs">{existingHint}</p>}
          <p className="text-muted-foreground mt-2 text-xs">
            You can update credentials anytime in Settings. Click Continue to proceed.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-8 w-full max-w-sm space-y-4 text-left">
            <div className="space-y-2">
              <Label htmlFor="onboard-token">API Token</Label>
              <Input
                id="onboard-token"
                type="password"
                autoComplete="off"
                placeholder="Your OANDA API token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={status === "testing"}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="onboard-account-id">Account ID</Label>
              <Input
                id="onboard-account-id"
                type="text"
                autoComplete="off"
                placeholder="e.g. 101-004-12345678-001"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                disabled={status === "testing"}
                className="font-mono text-sm"
              />
            </div>

            <Button
              onClick={handleSaveAndTest}
              disabled={!canTest || status === "testing"}
              className="w-full"
            >
              {status === "testing" && <Loader2 className="size-4 animate-spin" />}
              {status === "testing" ? "Connecting..." : "Save & Test Connection"}
            </Button>

            {status === "error" && (
              <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
                <XCircle className="mt-0.5 size-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          <p className="text-muted-foreground mt-6 text-xs">
            You can skip this step and connect later from Settings.
          </p>
        </>
      )}
    </div>
  )
}
