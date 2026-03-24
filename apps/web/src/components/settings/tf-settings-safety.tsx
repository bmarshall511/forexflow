"use client"

import type { TradeFinderCircuitBreakerState } from "@fxflow/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { AlertTriangle } from "lucide-react"

interface Props {
  circuitBreaker: TradeFinderCircuitBreakerState | null
  onReset: () => Promise<void>
}

export function TFSettingsSafety({ circuitBreaker, onReset }: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-5 text-amber-500" />
          <CardTitle>Safety Net</CardTitle>
        </div>
        <CardDescription>
          Automatic protection against losing streaks. Always active.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!circuitBreaker ? (
          <p className="text-muted-foreground text-sm">Connect to daemon to see safety status</p>
        ) : (
          <>
            {/* Status badge */}
            <div>
              {circuitBreaker.paused ? (
                <Badge variant="destructive">
                  Paused until{" "}
                  {circuitBreaker.pausedUntil
                    ? new Date(circuitBreaker.pausedUntil).toLocaleTimeString()
                    : "unknown"}
                </Badge>
              ) : (
                <Badge className="bg-emerald-600 text-white">Active</Badge>
              )}
              {circuitBreaker.reason && (
                <p className="text-muted-foreground mt-1 text-xs">{circuitBreaker.reason}</p>
              )}
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <StatCell label="Losses in a row" value={circuitBreaker.consecutiveLosses} />
              <StatCell label="Losses today" value={circuitBreaker.dailyLosses} />
              <StatCell
                label="Today's drawdown"
                value={`${circuitBreaker.dailyDrawdownPercent.toFixed(1)}%`}
              />
              <StatCell
                label="Position sizing"
                value={
                  circuitBreaker.reducedSizing ? (
                    <Badge variant="secondary" className="text-amber-600 dark:text-amber-400">
                      Reduced (50%)
                    </Badge>
                  ) : (
                    "Normal"
                  )
                }
              />
            </div>

            <Separator />

            {/* Rules */}
            <div>
              <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
                Rules
              </p>
              <ul className="text-muted-foreground space-y-1 text-xs">
                <li>3 losses in a row -- pause for 4 hours</li>
                <li>5 losses today -- pause for 24 hours</li>
                <li>3% daily loss -- trade with smaller positions</li>
                <li>5% daily loss -- stop trading for the day</li>
              </ul>
            </div>

            {/* Reset button */}
            {circuitBreaker.paused && (
              <>
                <Separator />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => void onReset()}
                >
                  Resume Trading
                </Button>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function StatCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-muted/50 rounded-md p-3">
      <p className="text-muted-foreground text-[10px] uppercase tracking-wider">{label}</p>
      <p className="mt-0.5 font-mono text-sm font-medium">{value}</p>
    </div>
  )
}
