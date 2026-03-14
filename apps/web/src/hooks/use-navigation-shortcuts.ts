"use client"

import { useCallback, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

/** Two-key chord shortcuts (e.g. G then D) for page navigation. */

const CHORD_TIMEOUT_MS = 1_000

const CHORD_MAP: Record<string, string> = {
  d: "/",
  p: "/positions",
  c: "/charts",
  a: "/ai-analysis",
  r: "/ai-trader",
  l: "/tv-alerts",
  s: "/settings",
}

function isInputTarget(e: KeyboardEvent): boolean {
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return false
  if ((e.target as HTMLElement)?.isContentEditable) return false
  return true
}

export function useNavigationShortcuts(onQuestionMark: () => void) {
  const router = useRouter()
  const chordPending = useRef(false)
  const chordTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearChord = useCallback(() => {
    chordPending.current = false
    if (chordTimer.current) {
      clearTimeout(chordTimer.current)
      chordTimer.current = null
    }
  }, [])

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Ignore when typing in form fields
      if (!isInputTarget(e)) return

      // Ignore when modifier keys are held (except shift for ?)
      if (e.ctrlKey || e.metaKey || e.altKey) return

      const key = e.key.toLowerCase()

      // "?" to open shortcuts help
      if (e.key === "?") {
        e.preventDefault()
        clearChord()
        onQuestionMark()
        return
      }

      // Second key of G-chord
      if (chordPending.current) {
        const dest = CHORD_MAP[key]
        clearChord()
        if (dest) {
          e.preventDefault()
          router.push(dest)
        }
        return
      }

      // Start G-chord
      if (key === "g") {
        chordPending.current = true
        chordTimer.current = setTimeout(clearChord, CHORD_TIMEOUT_MS)
        return
      }
    }

    window.addEventListener("keydown", handler)
    return () => {
      window.removeEventListener("keydown", handler)
      clearChord()
    }
  }, [router, onQuestionMark, clearChord])
}
