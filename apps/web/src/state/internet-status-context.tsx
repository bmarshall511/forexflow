"use client"

import { createContext, type ReactNode } from "react"
import { useInternetStatusInternal, type InternetStatusState } from "@/hooks/use-internet-status"

export const InternetStatusContext = createContext<InternetStatusState | null>(null)

export function InternetStatusProvider({ children }: { children: ReactNode }) {
  const internetStatus = useInternetStatusInternal()

  return (
    <InternetStatusContext.Provider value={internetStatus}>
      {children}
    </InternetStatusContext.Provider>
  )
}
