"use client"

import { useEffect, useRef, useState } from "react"
import { WifiOff, Wifi } from "lucide-react"
import { useInternetStatus } from "@/hooks/use-internet-status-context"
import { cn } from "@/lib/utils"

type BannerState = "hidden" | "offline" | "restored"

const RESTORED_DISPLAY_MS = 3_000

export function OfflineBanner() {
  const { isOnline } = useInternetStatus()
  const [bannerState, setBannerState] = useState<BannerState>("hidden")
  const prevOnlineRef = useRef<boolean | null>(null)
  const restoredTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // On first render: show banner immediately if already offline, otherwise stay hidden
    if (prevOnlineRef.current === null) {
      prevOnlineRef.current = isOnline
      if (!isOnline) setBannerState("offline")
      return
    }

    // Went offline
    if (prevOnlineRef.current && !isOnline) {
      if (restoredTimerRef.current) {
        clearTimeout(restoredTimerRef.current)
        restoredTimerRef.current = null
      }
      setBannerState("offline")
    }

    // Came back online
    if (!prevOnlineRef.current && isOnline) {
      setBannerState("restored")
      restoredTimerRef.current = setTimeout(() => {
        setBannerState("hidden")
      }, RESTORED_DISPLAY_MS)
    }

    prevOnlineRef.current = isOnline

    return () => {
      if (restoredTimerRef.current) clearTimeout(restoredTimerRef.current)
    }
  }, [isOnline])

  if (bannerState === "hidden") return null

  const isOffline = bannerState === "offline"

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "flex shrink-0 items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white",
        isOffline ? "bg-destructive" : "bg-green-600",
      )}
    >
      {isOffline ? (
        <>
          <WifiOff className="size-4 shrink-0" aria-hidden="true" />
          <span>No internet connection</span>
          <span className="hidden sm:inline text-white/80">
            &mdash; Some features may be unavailable
          </span>
        </>
      ) : (
        <>
          <Wifi className="size-4 shrink-0" aria-hidden="true" />
          <span>Connection restored</span>
        </>
      )}
    </div>
  )
}
