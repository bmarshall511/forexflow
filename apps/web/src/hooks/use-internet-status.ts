"use client"

import { useCallback, useEffect, useRef, useState } from "react"

const PING_URL = "https://www.google.com/generate_204"
const PING_INTERVAL_MS = 30_000
const PING_RETRY_DELAY_MS = 5_000
const OFFLINE_DEBOUNCE_MS = 2_000

export interface InternetStatusState {
  isOnline: boolean
  isChecking: boolean
  lastChecked: Date | null
}

export function useInternetStatusInternal(): InternetStatusState {
  // Always initialize as true to match SSR (server has no navigator).
  // The first ping (fired via the visibility effect) will correct this after mount.
  const [isOnline, setIsOnline] = useState(true)
  const [isChecking, setIsChecking] = useState(false)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const mountedRef = useRef(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const ping = useCallback(async (): Promise<boolean> => {
    try {
      await fetch(PING_URL, { mode: "no-cors", cache: "no-store" })
      return true
    } catch {
      return false
    }
  }, [])

  const performCheck = useCallback(async () => {
    if (!mountedRef.current) return
    setIsChecking(true)

    const success = await ping()
    if (!mountedRef.current) return

    setLastChecked(new Date())
    setIsChecking(false)

    if (success) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      setIsOnline(true)
    } else {
      // First failure — retry once after delay before marking offline
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      retryTimerRef.current = setTimeout(async () => {
        if (!mountedRef.current) return
        const retrySuccess = await ping()
        if (!mountedRef.current) return

        setLastChecked(new Date())
        setIsOnline(retrySuccess)
      }, PING_RETRY_DELAY_MS)
    }
  }, [ping])

  // Browser online/offline events
  useEffect(() => {
    function handleOffline() {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(() => {
        if (mountedRef.current) setIsOnline(false)
      }, OFFLINE_DEBOUNCE_MS)
    }

    function handleOnline() {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      // Verify with a ping before trusting the browser event
      void performCheck()
    }

    window.addEventListener("offline", handleOffline)
    window.addEventListener("online", handleOnline)

    return () => {
      window.removeEventListener("offline", handleOffline)
      window.removeEventListener("online", handleOnline)
    }
  }, [performCheck])

  // Tab visibility–based polling
  useEffect(() => {
    function startPolling() {
      void performCheck()
      intervalRef.current = setInterval(() => {
        void performCheck()
      }, PING_INTERVAL_MS)
    }

    function stopPolling() {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        startPolling()
      } else {
        stopPolling()
      }
    }

    if (document.visibilityState === "visible") {
      startPolling()
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      stopPolling()
    }
  }, [performCheck])

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return { isOnline, isChecking, lastChecked }
}
