"use client"

import { useContext } from "react"
import { InternetStatusContext } from "@/state/internet-status-context"
import type { InternetStatusState } from "@/hooks/use-internet-status"

export function useInternetStatus(): InternetStatusState {
  const context = useContext(InternetStatusContext)
  if (!context) {
    throw new Error("useInternetStatus must be used within an InternetStatusProvider")
  }
  return context
}
