"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardHeader, CardTitle, CardAction, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { DataTile } from "@/components/ui/data-tile"
import { Bot, Settings2, ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface AiTraderStatus {
  enabled: boolean
  scanning: boolean
  openAiTradeCount: number
  todayBudgetUsed: number
  monthlyBudgetUsed: number
}

interface AiTraderOpportunity {
  id: string
  instrument: string
  direction: "long" | "short"
  confidence: number
}

function fmtCost(n: number): string {
  if (n < 0.01) return "$0.00"
  if (n < 1) return `$${n.toFixed(3)}`
  return `$${n.toFixed(2)}`
}

export function AiTraderCard() {
  const [status, setStatus] = useState<AiTraderStatus | null>(null)
  const [opportunities, setOpportunities] = useState<AiTraderOpportunity[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    Promise.all([
      fetch("/api/ai-trader/status")
        .then((r) => r.json())
        .catch(() => null),
      fetch("/api/ai-trader/opportunities?limit=3")
        .then((r) => r.json())
        .catch(() => null),
    ])
      .then(([statusRes, oppsRes]) => {
        if (statusRes?.ok) setStatus(statusRes.data as AiTraderStatus)
        if (oppsRes?.ok) setOpportunities(oppsRes.data as AiTraderOpportunity[])
      })
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="text-primary size-4" />
          AI Trader
        </CardTitle>
        <CardAction>
          <Link
            href="/ai-trader"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowUpRight className="size-4" />
            <span className="sr-only">Go to AI Trader</span>
          </Link>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-32" />
            <div className="grid grid-cols-3 gap-2">
              <Skeleton className="h-16" /> <Skeleton className="h-16" />{" "}
              <Skeleton className="h-16" />
            </div>
            <Skeleton className="h-20" />
          </div>
        ) : !status ? (
          <p className="text-muted-foreground text-sm">Unable to load AI Trader status.</p>
        ) : (
          <>
            {/* Status indicator */}
            <div className="flex items-center gap-2 text-xs">
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  !status.enabled
                    ? "bg-muted-foreground/40"
                    : status.scanning
                      ? "animate-pulse bg-emerald-500"
                      : "bg-amber-500",
                )}
              />
              <span className="text-muted-foreground">
                {!status.enabled ? "Disabled" : status.scanning ? "Scanning" : "Idle"}
              </span>
              <Link
                href="/settings/ai-trader"
                className="text-muted-foreground hover:text-foreground ml-auto transition-colors"
              >
                <Settings2 className="size-3.5" />
                <span className="sr-only">AI Trader Settings</span>
              </Link>
            </div>

            {/* Data tiles */}
            <div className="grid grid-cols-3 gap-2">
              <DataTile label="Open Trades" value={status.openAiTradeCount} variant="muted" />
              <DataTile
                label="Today Cost"
                value={fmtCost(status.todayBudgetUsed ?? 0)}
                variant="muted"
              />
              <DataTile
                label="Monthly Cost"
                value={fmtCost(status.monthlyBudgetUsed ?? 0)}
                variant="accent"
              />
            </div>

            {/* Recent opportunities */}
            {opportunities.length > 0 && (
              <>
                <Separator />
                <div className="space-y-1.5">
                  <p className="text-muted-foreground text-xs font-medium">Recent Opportunities</p>
                  {opportunities.map((opp) => (
                    <div
                      key={opp.id}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs"
                    >
                      <span className="shrink-0 font-medium">
                        {opp.instrument.replace("_", "/")}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-[10px]",
                          opp.direction === "long" ? "text-emerald-600" : "text-red-500",
                        )}
                      >
                        {opp.direction === "long" ? "LONG" : "SHORT"}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "ml-auto h-4 px-1.5 text-[10px]",
                          opp.confidence >= 80
                            ? "border-emerald-500/50 text-emerald-600"
                            : opp.confidence >= 60
                              ? "border-amber-500/50 text-amber-600"
                              : "border-muted-foreground/30 text-muted-foreground",
                        )}
                      >
                        {opp.confidence}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
