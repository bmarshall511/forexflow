"use client"

import { useState, useCallback, useEffect } from "react"
import { Loader2, Copy, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { TokenField } from "@/components/settings/token-field"
import { TestConnectionButton } from "@/components/settings/test-connection-button"
import type { TradingMode, OandaCredentials, ApiResponse } from "@fxflow/types"

interface CredentialFormProps {
  mode: TradingMode
  credentials: OandaCredentials
  onCredentialsChange: (credentials: OandaCredentials) => void
}

export function CredentialForm({ mode, credentials, onCredentialsChange }: CredentialFormProps) {
  const [token, setToken] = useState("")
  const [accountId, setAccountId] = useState(credentials.accountId)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Reset form when credentials change from parent (e.g., after save)
  useEffect(() => {
    setAccountId(credentials.accountId)
    setToken("")
  }, [credentials])

  const isDirty = token !== "" || accountId !== credentials.accountId

  const canSave =
    isDirty && accountId.trim() !== "" && (credentials.hasToken || token.trim() !== "")

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const body: Record<string, string> = {
        mode,
        accountId: accountId.trim(),
      }
      if (token.trim()) {
        body.token = token.trim()
      }

      const res = await fetch("/api/settings/oanda/credentials", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as ApiResponse<OandaCredentials>

      if (data.ok && data.data) {
        toast.success(`${mode === "live" ? "Live" : "Practice"} credentials saved`)
        onCredentialsChange(data.data)
        setToken("")
      } else {
        toast.error("Failed to save credentials", { description: data.error })
      }
    } catch {
      toast.error("Failed to save credentials")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch("/api/settings/oanda/credentials", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      })
      const data = (await res.json()) as ApiResponse<{ tradingMode: string }>

      if (data.ok) {
        toast.success(`${mode === "live" ? "Live" : "Practice"} credentials deleted`)
        onCredentialsChange({ accountId: "", hasToken: false, tokenLastFour: "" })
        setToken("")
        setAccountId("")
      } else {
        toast.error("Failed to delete credentials", { description: data.error })
      }
    } catch {
      toast.error("Failed to delete credentials")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCopyAccountId = useCallback(async () => {
    if (!accountId) return
    try {
      await navigator.clipboard.writeText(accountId)
      toast.success("Account ID copied to clipboard")
    } catch {
      toast.error("Failed to copy")
    }
  }, [accountId])

  const handleDeleteAccountId = () => {
    setAccountId("")
  }

  const isBusy = isSaving || isDeleting
  const accountIdFieldId = `${mode}-account-id`
  const hasCredentials = credentials.hasToken && credentials.accountId

  return (
    <div className="space-y-4">
      <TokenField
        mode={mode}
        hasToken={credentials.hasToken}
        tokenLastFour={credentials.tokenLastFour}
        value={token}
        onChange={setToken}
        onDelete={handleDelete}
        disabled={isBusy}
      />

      <div className="space-y-2">
        <Label htmlFor={accountIdFieldId} className="text-sm font-medium">
          Account ID
        </Label>
        <div className="flex gap-1.5">
          <Input
            id={accountIdFieldId}
            type="text"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            placeholder="Enter your OANDA Account ID"
            disabled={isBusy}
            className="flex-1 font-mono text-sm"
          />
          {accountId && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleCopyAccountId}
              disabled={isBusy}
              aria-label="Copy account ID"
            >
              <Copy className="size-4" />
            </Button>
          )}
          {credentials.accountId && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleDeleteAccountId}
              disabled={isBusy}
              aria-label="Clear account ID"
              className="text-destructive hover:bg-destructive hover:text-white"
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2">
        {isDirty && (
          <Button onClick={handleSave} disabled={!canSave || isBusy} size="sm">
            {isSaving && <Loader2 className="size-4 animate-spin" />}
            {isSaving ? "Saving..." : "Save Credentials"}
          </Button>
        )}

        {hasCredentials && <TestConnectionButton mode={mode} disabled={isBusy || isDirty} />}
      </div>
    </div>
  )
}
