"use client"

import { useMemo } from "react"
import type { TVAlertsConfig } from "@fxflow/types"
import { FOREX_PAIR_GROUPS } from "@fxflow/shared"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ListFilter } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * TV Alerts pair whitelist — gates which instruments the daemon will accept
 * signals for. Empty list = all signals rejected. Auto-trading + the signal
 * processor both enforce this.
 *
 * Renders pairs grouped Majors / Minors / Crosses with "Allow all" / "Allow
 * none" shortcuts per group + globally.
 */
export interface TVASettingsWhitelistProps {
  config: TVAlertsConfig
  onUpdate: (partial: Partial<TVAlertsConfig>) => Promise<void>
  saving: boolean
}

export function TVASettingsWhitelist({ config, onUpdate, saving }: TVASettingsWhitelistProps) {
  const whitelist = useMemo(() => new Set(config.pairWhitelist ?? []), [config.pairWhitelist])

  const toggle = (value: string) => {
    const next = new Set(whitelist)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    void onUpdate({ pairWhitelist: [...next] })
  }

  const allowAll = () => {
    const all = FOREX_PAIR_GROUPS.flatMap((g) => g.pairs.map((p) => p.value))
    void onUpdate({ pairWhitelist: all })
  }

  const allowNone = () => {
    void onUpdate({ pairWhitelist: [] })
  }

  const totalAllowed = whitelist.size

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ListFilter className="size-5 text-violet-500" />
            <CardTitle>Allowed Pairs</CardTitle>
          </div>
          <span className="text-muted-foreground text-xs tabular-nums">{totalAllowed} allowed</span>
        </div>
        <CardDescription>
          Only signals for pairs in this list will be executed. Everything else is rejected with
          reason <code className="text-[10px]">pair_not_whitelisted</code>. An empty list blocks
          every signal.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={allowAll}
            disabled={saving}
            className="h-7 text-xs"
          >
            Allow all
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={allowNone}
            disabled={saving || totalAllowed === 0}
            className="h-7 text-xs"
          >
            Allow none
          </Button>
        </div>

        {FOREX_PAIR_GROUPS.map((group) => {
          const groupValues = group.pairs.map((p) => p.value)
          const allInGroup = groupValues.every((v) => whitelist.has(v))
          const anyInGroup = groupValues.some((v) => whitelist.has(v))
          const toggleGroup = () => {
            const next = new Set(whitelist)
            if (allInGroup) groupValues.forEach((v) => next.delete(v))
            else groupValues.forEach((v) => next.add(v))
            void onUpdate({ pairWhitelist: [...next] })
          }
          return (
            <div key={group.label} className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
                  {group.label}
                </h4>
                <button
                  type="button"
                  onClick={toggleGroup}
                  disabled={saving}
                  className="text-muted-foreground/60 hover:text-muted-foreground text-[10px] underline-offset-2 hover:underline disabled:opacity-50"
                >
                  {allInGroup ? "none" : anyInGroup ? "all" : "all"}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {group.pairs.map((pair) => {
                  const selected = whitelist.has(pair.value)
                  return (
                    <button
                      key={pair.value}
                      type="button"
                      role="checkbox"
                      aria-checked={selected}
                      onClick={() => toggle(pair.value)}
                      disabled={saving}
                      className={cn(
                        "rounded-md border px-2 py-1 font-mono text-xs transition-colors",
                        "focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2",
                        "disabled:pointer-events-none disabled:opacity-50",
                        selected
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {pair.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
