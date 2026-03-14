"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import type { EquityCurvePoint } from "@fxflow/types"
import { TrendingUp } from "lucide-react"
import { Card, CardHeader, CardTitle, CardAction, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EquityCurveChart } from "@/components/analytics/equity-curve-chart"
import { cn } from "@/lib/utils"

export function EquityCurveCard() {
  const [data, setData] = useState<EquityCurvePoint[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        // Last 30 days
        const from = new Date()
        from.setDate(from.getDate() - 30)
        const params = new URLSearchParams({ dateFrom: from.toISOString() })
        const res = await fetch(`/api/analytics/equity-curve?${params}`)
        const json = await res.json()
        if (json.ok) setData(json.data)
      } catch (err) {
        console.error("[EquityCurveCard] fetch error:", err)
      } finally {
        setIsLoading(false)
      }
    }
    void load()
  }, [])

  const lastPL = data.length > 0 ? data[data.length - 1]!.cumulativePL : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="size-4" />
          Equity Curve
        </CardTitle>
        <CardAction>
          <Link
            href="/analytics"
            className="text-muted-foreground hover:text-foreground text-xs underline transition-colors"
          >
            View Analytics
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[120px] w-full rounded-lg" />
        ) : data.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            No closed trades in the last 30 days
          </p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground text-xs">Last 30 days</span>
              <span
                className={cn(
                  "text-lg font-semibold tabular-nums",
                  lastPL > 0
                    ? "text-green-600 dark:text-green-400"
                    : lastPL < 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-muted-foreground",
                )}
              >
                {lastPL >= 0 ? "+" : ""}
                {lastPL.toFixed(2)}
              </span>
            </div>
            <EquityCurveChart data={data} height={120} compact />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
