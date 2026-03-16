"use client"

import type { AiTraderScanLogEntry } from "@fxflow/types"

interface ScanLogEntryDetailProps {
  entry: AiTraderScanLogEntry
}

export function ScanLogEntryDetail({ entry }: ScanLogEntryDetailProps) {
  const m = entry.metadata

  // Scan summary entries
  if (entry.type === "scan_complete" || entry.type === "pair_scanned") {
    return (
      <div className="space-y-2 text-xs">
        <div className="grid grid-cols-3 gap-3">
          {m?.pairsScanned != null && <Stat label="Pairs scanned" value={String(m.pairsScanned)} />}
          {m?.candidatesFound != null && (
            <Stat label="Signals found" value={String(m.candidatesFound)} />
          )}
          {m?.candidatesAnalyzed != null && (
            <Stat label="AI analyzed" value={String(m.candidatesAnalyzed)} />
          )}
          {m?.elapsedMs != null && (
            <Stat label="Duration" value={`${(m.elapsedMs / 1000).toFixed(1)}s`} />
          )}
        </div>
        {entry.type === "scan_complete" &&
          m?.candidatesAnalyzed != null &&
          m.candidatesAnalyzed > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {m?.tier2Passed != null && (
                <Stat
                  label="Quick AI check passed"
                  value={String(m.tier2Passed)}
                  className={
                    m.tier2Passed > 0 ? "font-medium text-blue-500" : "text-muted-foreground"
                  }
                />
              )}
              {m?.tier3Passed != null && (
                <Stat
                  label="Deep AI analysis passed"
                  value={String(m.tier3Passed)}
                  className={
                    m.tier3Passed > 0 ? "font-medium text-emerald-500" : "text-muted-foreground"
                  }
                />
              )}
              {m?.tradesPlaced != null && (
                <Stat
                  label="Trades placed"
                  value={String(m.tradesPlaced)}
                  className={
                    m.tradesPlaced > 0 ? "font-medium text-emerald-500" : "text-muted-foreground"
                  }
                />
              )}
            </div>
          )}
      </div>
    )
  }

  // Candidate / tier entries with instrument info
  if (m?.instrument) {
    return (
      <div className="space-y-2 text-xs">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <Stat label="Pair" value={m.instrument.replace("_", "/")} />
          {m.direction && (
            <Stat
              label="Direction"
              value={m.direction.toUpperCase()}
              className={m.direction === "long" ? "text-green-500" : "text-red-500"}
            />
          )}
          {m.profile && <Stat label="Profile" value={m.profile} className="capitalize" />}
          {m.confidence != null && <Stat label="Confidence" value={`${m.confidence}%`} />}
          {m.tier != null && <Stat label="Tier" value={String(m.tier)} />}
        </div>
        {(m.entryPrice != null || m.stopLoss != null || m.takeProfit != null) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {m.entryPrice != null && (
              <Stat label="Entry" value={String(m.entryPrice)} className="font-mono" />
            )}
            {m.stopLoss != null && (
              <Stat label="SL" value={String(m.stopLoss)} className="font-mono text-red-500" />
            )}
            {m.takeProfit != null && (
              <Stat label="TP" value={String(m.takeProfit)} className="font-mono text-green-500" />
            )}
            {m.riskRewardRatio != null && (
              <Stat label="R:R" value={`1:${m.riskRewardRatio.toFixed(1)}`} />
            )}
          </div>
        )}
        {m.primaryTechnique && (
          <div className="flex flex-wrap gap-1.5">
            <span className="bg-primary/15 text-primary rounded px-1.5 py-0.5 font-medium">
              {formatTechnique(m.primaryTechnique)}
            </span>
            {m.techniques
              ?.filter((t) => t !== m.primaryTechnique)
              .map((t) => (
                <span key={t} className="bg-muted text-muted-foreground rounded px-1.5 py-0.5">
                  {formatTechnique(t)}
                </span>
              ))}
          </div>
        )}
        {m.reasons && m.reasons.length > 0 && (
          <ul className="text-muted-foreground list-disc space-y-0.5 pl-4 leading-relaxed">
            {m.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        )}
        {m.reason && <p className="text-muted-foreground leading-relaxed">{m.reason}</p>}
        {m.error && <p className="leading-relaxed text-red-400">{m.error}</p>}
      </div>
    )
  }

  // Fallback: just show detail text if present
  if (entry.detail) {
    return <p className="text-muted-foreground text-xs leading-relaxed">{entry.detail}</p>
  }

  return null
}

const TECHNIQUE_LABELS: Record<string, string> = {
  smc_structure: "SMC Structure",
  fair_value_gap: "FVG",
  order_block: "Order Block",
  liquidity_sweep: "Liquidity Sweep",
  supply_demand_zone: "S/D Zone",
  fibonacci_ote: "Fib OTE",
  rsi: "RSI",
  macd: "MACD",
  ema_alignment: "EMA Alignment",
  bollinger_bands: "Bollinger Bands",
  williams_r: "Williams %R",
  adx_regime: "ADX Regime",
  divergence: "Divergence",
  trend_detection: "Trend",
}

function formatTechnique(t: string): string {
  return TECHNIQUE_LABELS[t] ?? t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className={className ?? "text-foreground font-medium"}>{value}</span>
    </div>
  )
}
