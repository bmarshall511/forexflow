"use client"

import { useContext } from "react"
import { DaemonStatusContext } from "@/state/daemon-status-context"

export function useDaemonStatus() {
  const context = useContext(DaemonStatusContext)
  if (!context) {
    throw new Error("useDaemonStatus must be used within a DaemonStatusProvider")
  }
  return context
}
