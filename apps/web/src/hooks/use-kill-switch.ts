"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useDaemonStatus } from "./use-daemon-status"

export function useKillSwitch() {
  const { tvAlertsStatus } = useDaemonStatus()
  const [isToggling, setIsToggling] = useState(false)
  const [optimistic, setOptimistic] = useState<boolean | null>(null)

  const daemonEnabled = tvAlertsStatus?.enabled ?? null

  // Clear optimistic override once daemon state catches up
  useEffect(() => {
    if (optimistic !== null && daemonEnabled === optimistic) {
      setOptimistic(null)
    }
  }, [daemonEnabled, optimistic])

  // Displayed value: optimistic takes priority while active, then daemon, then null
  const enabled = optimistic ?? daemonEnabled

  // Use a ref for enabled so toggle always reads the latest value
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  const toggle = useCallback(async () => {
    const current = enabledRef.current
    if (current === null) return

    const newValue = !current
    setIsToggling(true)
    setOptimistic(newValue)

    try {
      const res = await fetch("/api/tv-alerts/kill-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: newValue }),
      })
      const json = await res.json()
      if (!json.ok) {
        setOptimistic(null)
        throw new Error(json.error)
      }
    } catch (err) {
      setOptimistic(null)
      console.error("[useKillSwitch] toggle error:", err)
      throw err
    } finally {
      setIsToggling(false)
    }
  }, [])

  return { enabled, isToggling, toggle }
}
