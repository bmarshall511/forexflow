"use client"

import { useEffect } from "react"

interface KeyboardShortcutOptions {
  ctrlOrMeta?: boolean
}

export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options?: KeyboardShortcutOptions,
) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (options?.ctrlOrMeta && !(e.ctrlKey || e.metaKey)) return
      if (e.key.toLowerCase() !== key.toLowerCase()) return

      e.preventDefault()
      callback()
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [key, callback, options?.ctrlOrMeta])
}
