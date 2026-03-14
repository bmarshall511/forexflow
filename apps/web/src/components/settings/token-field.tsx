"use client"

import { useState, useCallback } from "react"
import { Eye, EyeOff, Copy, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { TradingMode } from "@fxflow/types"

interface TokenFieldProps {
  mode: TradingMode
  hasToken: boolean
  tokenLastFour: string
  value: string
  onChange: (value: string) => void
  onDelete: () => void
  disabled?: boolean
}

export function TokenField({
  mode,
  hasToken,
  tokenLastFour,
  value,
  onChange,
  onDelete,
  disabled,
}: TokenFieldProps) {
  const [isRevealed, setIsRevealed] = useState(false)
  const [revealedToken, setRevealedToken] = useState<string | null>(null)
  const [isRevealing, setIsRevealing] = useState(false)

  const isEditing = value !== ""
  const hasStoredToken = hasToken && !isEditing
  const maskedDisplay = hasStoredToken ? `${"•".repeat(20)}${tokenLastFour}` : ""

  const fetchFullToken = useCallback(async (): Promise<string | null> => {
    if (revealedToken) return revealedToken

    setIsRevealing(true)
    try {
      const res = await fetch(`/api/settings/oanda/credentials/token?mode=${mode}`)
      const data = (await res.json()) as { ok: boolean; data?: { token: string }; error?: string }
      if (data.ok && data.data) {
        setRevealedToken(data.data.token)
        return data.data.token
      }
      toast.error("Failed to reveal token", { description: data.error })
      return null
    } catch {
      toast.error("Failed to reveal token")
      return null
    } finally {
      setIsRevealing(false)
    }
  }, [mode, revealedToken])

  const handleRevealToggle = async () => {
    if (isRevealed) {
      setIsRevealed(false)
      return
    }
    const token = await fetchFullToken()
    if (token) setIsRevealed(true)
  }

  const handleCopy = async () => {
    let tokenToCopy: string

    if (isEditing) {
      tokenToCopy = value
    } else {
      const token = revealedToken ?? (await fetchFullToken())
      if (!token) return
      tokenToCopy = token
    }

    try {
      await navigator.clipboard.writeText(tokenToCopy)
      toast.success("Token copied to clipboard")
    } catch {
      toast.error("Failed to copy", {
        description: "Clipboard access is not available in this browser",
      })
    }
  }

  const handleInputChange = (newValue: string) => {
    onChange(newValue)
    // Clear revealed state when editing
    setIsRevealed(false)
    setRevealedToken(null)
  }

  const fieldId = `${mode}-token`

  // Determine what to show in the input
  const displayValue = isEditing
    ? value
    : isRevealed && revealedToken
      ? revealedToken
      : maskedDisplay

  const isReadonly = hasStoredToken && !isRevealed

  return (
    <div className="space-y-2">
      <Label htmlFor={fieldId} className="text-sm font-medium">
        API Token
      </Label>
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <Input
            id={fieldId}
            type={isEditing || isRevealed ? "text" : "password"}
            value={displayValue}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder={hasStoredToken ? undefined : "Enter your OANDA API token"}
            readOnly={isReadonly}
            disabled={disabled}
            className={cn("pr-10 font-mono text-sm", isReadonly && "bg-muted/50 cursor-default")}
            aria-describedby={`${fieldId}-hint`}
          />
          {hasStoredToken && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="absolute right-1.5 top-1/2 -translate-y-1/2"
              onClick={handleRevealToggle}
              disabled={disabled || isRevealing}
              aria-label={isRevealed ? "Hide token" : "Show token"}
            >
              {isRevealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </Button>
          )}
        </div>

        {(hasStoredToken || isEditing) && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleCopy}
            disabled={disabled || isRevealing}
            aria-label="Copy token"
          >
            <Copy className="size-4" />
          </Button>
        )}

        {hasStoredToken && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onDelete}
            disabled={disabled}
            aria-label="Delete token"
            className="text-destructive hover:bg-destructive hover:text-white"
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
      <p id={`${fieldId}-hint`} className="text-muted-foreground text-xs">
        {hasStoredToken
          ? "Token is securely stored and encrypted."
          : "Your token will be encrypted before storage."}
      </p>
    </div>
  )
}
