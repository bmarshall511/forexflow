"use client"

import { useCallback } from "react"
import type { SmartFlowTradeData } from "@fxflow/types"
import { toast } from "sonner"
import { Zap } from "lucide-react"
import { ActiveTradeCard } from "./active-trade-card"
import { getClientDaemonUrl } from "@/lib/daemon-url"

const DAEMON_URL = getClientDaemonUrl()

interface ActiveTradesTabProps {
  trades: SmartFlowTradeData[]
}

export function ActiveTradesTab({ trades }: ActiveTradesTabProps) {
  const handleCancel = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${DAEMON_URL}/smart-flow/cancel/${id}`, { method: "POST" })
      const json = (await res.json()) as { ok: boolean; error?: string }
      if (!json.ok) {
        toast.error(json.error ?? "Failed to cancel trade")
        return
      }
      toast.success("Trade cancelled")
    } catch {
      toast.error("Could not reach the daemon — is it running?")
    }
  }, [])

  if (trades.length === 0) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-12 text-center">
        <div className="bg-primary/10 mx-auto flex size-12 items-center justify-center rounded-full">
          <Zap className="text-primary size-6" />
        </div>
        <h3 className="text-foreground text-base font-semibold">No active trades</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Start a new trade from the Trade tab. SmartFlow will automatically manage it toward profit
          using your chosen strategy.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {trades.length} active {trades.length === 1 ? "trade" : "trades"}
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {trades.map((trade) => (
          <ActiveTradeCard key={trade.id} trade={trade} onCancel={handleCancel} />
        ))}
      </div>
    </div>
  )
}
