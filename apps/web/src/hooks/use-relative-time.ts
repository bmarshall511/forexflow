"use client"

import { useState, useEffect } from "react"
import { formatRelativeTime } from "@fxflow/shared"

/**
 * Hook that returns a live-ticking relative time string.
 * Re-renders every `intervalMs` (default 5s) so the displayed
 * time stays current instead of frozen at mount time.
 */
export function useRelativeTime(
  isoString: string | null,
  intervalMs: number = 1000,
): string {
  const [text, setText] = useState(() => formatRelativeTime(isoString))

  useEffect(() => {
    setText(formatRelativeTime(isoString))
    if (!isoString) return

    const id = setInterval(() => {
      setText(formatRelativeTime(isoString))
    }, intervalMs)
    return () => clearInterval(id)
  }, [isoString, intervalMs])

  return text
}
