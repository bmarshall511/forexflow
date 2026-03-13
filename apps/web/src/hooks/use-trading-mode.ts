"use client"

import { useContext } from "react"
import { TradingModeContext } from "@/state/trading-mode-context"

export function useTradingMode() {
  const context = useContext(TradingModeContext)
  if (!context) {
    throw new Error("useTradingMode must be used within a TradingModeProvider")
  }
  return context
}
