"use client"

import { createContext, type ReactNode } from "react"
import {
  useDaemonConnection,
  type DaemonConnectionState,
} from "@/hooks/use-daemon-connection"

export const DaemonStatusContext = createContext<DaemonConnectionState | null>(null)

export function DaemonStatusProvider({ children }: { children: ReactNode }) {
  const connectionState = useDaemonConnection()

  return (
    <DaemonStatusContext.Provider value={connectionState}>{children}</DaemonStatusContext.Provider>
  )
}
