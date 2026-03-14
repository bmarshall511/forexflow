"use client"

import { useState } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ResetLevel } from "./reset-level-selector"

interface ResetConfirmationProps {
  level: ResetLevel
  onConfirm: () => void
  onBack: () => void
}

export function ResetConfirmation({ level, onConfirm, onBack }: ResetConfirmationProps) {
  const [value, setValue] = useState("")

  const confirmText = level === "fresh_install" ? "DELETE DATABASE" : "RESET"
  const isMatch = value === confirmText

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Confirm Reset</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          This action is permanent and cannot be undone.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-500" aria-hidden="true" />
        <p className="text-sm text-red-400">
          Type <strong className="font-mono">{confirmText}</strong> below to confirm.
        </p>
      </div>

      <div>
        <label htmlFor="reset-confirm-input" className="sr-only">
          Type {confirmText} to confirm
        </label>
        <Input
          id="reset-confirm-input"
          type="text"
          placeholder={confirmText}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="font-mono"
        />
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button variant="destructive" disabled={!isMatch} onClick={onConfirm}>
          Execute Reset
        </Button>
      </div>
    </div>
  )
}
