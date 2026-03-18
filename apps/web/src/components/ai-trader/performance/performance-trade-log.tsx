"use client"

import { useState } from "react"
import type { AiTraderClosedTrade } from "@fxflow/db"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

interface Props {
  trades: AiTraderClosedTrade[]
}

export function PerformanceTradeLog({ trades }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (trades.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center text-sm">No closed trades yet.</div>
    )
  }

  return (
    <section aria-label="Closed AI trade log">
      <h3 className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
        Trade Log
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" role="table">
          <thead>
            <tr className="text-muted-foreground border-b text-left">
              <th className="px-2 py-1.5 font-medium">Date</th>
              <th className="px-2 py-1.5 font-medium">Pair</th>
              <th className="px-2 py-1.5 font-medium">Dir</th>
              <th className="px-2 py-1.5 font-medium">Profile</th>
              <th className="px-2 py-1.5 text-right font-medium">Conf</th>
              <th className="px-2 py-1.5 text-right font-medium">R:R</th>
              <th className="px-2 py-1.5 text-right font-medium">P&L</th>
              <th className="px-2 py-1.5 font-medium">Result</th>
              <th className="px-2 py-1.5 font-medium">Regime</th>
              <th className="w-6" />
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => (
              <TradeRow
                key={t.id}
                trade={t}
                expanded={expandedId === t.id}
                onToggle={() => setExpandedId(expandedId === t.id ? null : t.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function TradeRow({
  trade: t,
  expanded,
  onToggle,
}: {
  trade: AiTraderClosedTrade
  expanded: boolean
  onToggle: () => void
}) {
  const closedDate = t.closedAt ? new Date(t.closedAt).toLocaleDateString() : "—"
  const holdMinutes =
    t.filledAt && t.closedAt
      ? Math.round((new Date(t.closedAt).getTime() - new Date(t.filledAt).getTime()) / 60_000)
      : null

  return (
    <>
      <tr
        className="hover:bg-muted/50 cursor-pointer border-b transition-colors"
        onClick={onToggle}
        role="row"
      >
        <td className="text-muted-foreground px-2 py-1.5 tabular-nums">{closedDate}</td>
        <td className="px-2 py-1.5 font-medium">{t.instrument.replace("_", "/")}</td>
        <td className="px-2 py-1.5">
          <span className={t.direction === "long" ? "text-emerald-500" : "text-red-500"}>
            {t.direction === "long" ? "BUY" : "SELL"}
          </span>
        </td>
        <td className="text-muted-foreground px-2 py-1.5 capitalize">{t.profile}</td>
        <td className="px-2 py-1.5 text-right tabular-nums">{t.confidence}%</td>
        <td className="px-2 py-1.5 text-right tabular-nums">{t.riskRewardRatio.toFixed(1)}</td>
        <td
          className={cn(
            "px-2 py-1.5 text-right font-medium tabular-nums",
            t.realizedPL >= 0 ? "text-emerald-500" : "text-red-500",
          )}
        >
          {t.realizedPL >= 0 ? "+" : ""}${t.realizedPL.toFixed(2)}
        </td>
        <td className="px-2 py-1.5">
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-xs font-medium",
              t.outcome === "win"
                ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                : t.outcome === "loss"
                  ? "bg-red-500/20 text-red-600 dark:text-red-400"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {t.outcome.toUpperCase()}
          </span>
        </td>
        <td className="text-muted-foreground px-2 py-1.5 capitalize">{t.regime ?? "—"}</td>
        <td className="px-2 py-1.5">
          <ChevronDown
            className={cn(
              "text-muted-foreground h-3.5 w-3.5 transition-transform",
              expanded && "rotate-180",
            )}
          />
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={10} className="bg-muted/30 px-4 py-3">
            <div className="space-y-2 text-xs">
              {holdMinutes !== null && (
                <div>
                  <strong>Hold time:</strong>{" "}
                  {holdMinutes < 60 ? `${holdMinutes}m` : `${(holdMinutes / 60).toFixed(1)}h`}
                </div>
              )}
              <div>
                <strong>MFE/MAE:</strong>{" "}
                <span className="text-emerald-500">+{t.mfe.toFixed(1)} pips</span> /{" "}
                <span className="text-red-500">{t.mae.toFixed(1)} pips</span>
              </div>
              {t.session && (
                <div>
                  <strong>Session:</strong> {t.session}
                </div>
              )}
              {t.entryRationale && (
                <div>
                  <strong>Entry rationale:</strong>
                  <p className="text-muted-foreground mt-1 leading-relaxed">{t.entryRationale}</p>
                </div>
              )}
              <ScoreBreakdown scoresJson={t.scoresJson} />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function ScoreBreakdown({ scoresJson }: { scoresJson: string }) {
  try {
    const scores = JSON.parse(scoresJson) as Record<string, number>
    const labels: Record<string, string> = {
      technical: "Technical",
      fundamental: "Fundamental",
      sentiment: "Sentiment",
      session: "Session",
      historical: "Historical",
      confluence: "Confluence",
    }
    return (
      <div>
        <strong>Scores:</strong>
        <div className="mt-1 flex flex-wrap gap-2">
          {Object.entries(scores).map(([k, v]) => (
            <span key={k} className="bg-muted rounded px-1.5 py-0.5 tabular-nums">
              {labels[k] ?? k}: {v}
            </span>
          ))}
        </div>
      </div>
    )
  } catch {
    return null
  }
}
