"use client"

import { useEffect, useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Toggles a global blur on every element marked `data-private="true"` —
 * wired via the `html[data-privacy-mode="true"] [data-private]` CSS rule
 * in `globals.css`. Lets the user demo the dashboard in public without
 * revealing live balances.
 *
 * Persists state in localStorage so a refresh keeps the user's choice.
 * Applies the attribute on `<html>` so it survives layout remounts.
 */
const STORAGE_KEY = "fxflow:privacy-mode"

function readStored(): boolean {
  if (typeof window === "undefined") return false
  return window.localStorage.getItem(STORAGE_KEY) === "true"
}

export function PrivacyToggle({ className }: { className?: string }) {
  const [on, setOn] = useState(false)

  useEffect(() => {
    const initial = readStored()
    setOn(initial)
    document.documentElement.dataset.privacyMode = initial ? "true" : "false"
  }, [])

  const toggle = () => {
    const next = !on
    setOn(next)
    window.localStorage.setItem(STORAGE_KEY, next ? "true" : "false")
    document.documentElement.dataset.privacyMode = next ? "true" : "false"
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? "Show monetary values" : "Hide monetary values"}
      title={on ? "Show values" : "Hide values"}
      className={cn("size-8", className)}
    >
      {on ? (
        <EyeOff className="size-4" aria-hidden="true" />
      ) : (
        <Eye className="size-4" aria-hidden="true" />
      )}
    </Button>
  )
}
