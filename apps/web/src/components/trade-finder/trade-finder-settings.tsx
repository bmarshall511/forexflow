"use client"

import { useState } from "react"
import type { TradeFinderConfigData, TradeFinderPairConfig, TradeFinderTimeframeSet } from "@fxflow/types"
import { ALL_FOREX_PAIRS, FOREX_PAIR_GROUPS, formatInstrument } from "@fxflow/shared"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { X, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

interface TradeFinderSettingsProps {
  config: TradeFinderConfigData
  onUpdate: (partial: Partial<TradeFinderConfigData>) => Promise<void>
  onClose: () => void
}

const TF_SET_OPTIONS: { value: TradeFinderTimeframeSet; label: string; desc: string }[] = [
  { value: "hourly", label: "Hourly", desc: "H1 / M15 / M5" },
  { value: "daily", label: "Daily", desc: "D / H1 / M15" },
  { value: "weekly", label: "Weekly", desc: "W / D / H1" },
  { value: "monthly", label: "Monthly", desc: "M / W / D" },
]

export function TradeFinderSettings({ config, onUpdate, onClose }: TradeFinderSettingsProps) {
  const [saving, setSaving] = useState(false)
  const [localPairs, setLocalPairs] = useState<TradeFinderPairConfig[]>(config.pairs)
  const [addingPair, setAddingPair] = useState(false)

  const enabledCount = localPairs.filter((p) => p.enabled).length
  const availablePairs = ALL_FOREX_PAIRS.filter(
    (fp) => !localPairs.some((lp) => lp.instrument === fp.value),
  )

  const handleToggle = async () => {
    setSaving(true)
    try {
      await onUpdate({ enabled: !config.enabled })
      toast.success(config.enabled ? "Trade Finder disabled" : "Trade Finder enabled")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed")
    } finally {
      setSaving(false)
    }
  }

  const handleMinScoreChange = async (value: string) => {
    const num = parseFloat(value)
    if (isNaN(num) || num < 1 || num > 12) return
    try {
      await onUpdate({ minScore: num })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed")
    }
  }

  const handleAddPair = async (instrument: string, timeframeSet: TradeFinderTimeframeSet) => {
    const newPairs = [...localPairs, { instrument, enabled: true, timeframeSet }]
    setLocalPairs(newPairs)
    try {
      await onUpdate({ pairs: newPairs })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed")
    }
    setAddingPair(false)
  }

  const handleRemovePair = async (instrument: string) => {
    const newPairs = localPairs.filter((p) => p.instrument !== instrument)
    setLocalPairs(newPairs)
    try {
      await onUpdate({ pairs: newPairs })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed")
    }
  }

  const handleTogglePair = async (instrument: string) => {
    const newPairs = localPairs.map((p) =>
      p.instrument === instrument ? { ...p, enabled: !p.enabled } : p,
    )
    setLocalPairs(newPairs)
    try {
      await onUpdate({ pairs: newPairs })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed")
    }
  }

  const handleTfSetChange = async (instrument: string, timeframeSet: TradeFinderTimeframeSet) => {
    const newPairs = localPairs.map((p) =>
      p.instrument === instrument ? { ...p, timeframeSet } : p,
    )
    setLocalPairs(newPairs)
    try {
      await onUpdate({ pairs: newPairs })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed")
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Trade Finder Settings</CardTitle>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <label className="text-xs">Scanner Enabled</label>
          <Button
            variant={config.enabled ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={handleToggle}
            disabled={saving}
          >
            {config.enabled ? "Enabled" : "Disabled"}
          </Button>
        </div>

        {/* Min score */}
        <div className="flex items-center justify-between">
          <label className="text-xs">Minimum Score (1-12)</label>
          <input
            type="number"
            min={1}
            max={12}
            step={0.5}
            defaultValue={config.minScore}
            onBlur={(e) => handleMinScoreChange(e.target.value)}
            className="w-16 h-7 text-xs px-2 border rounded bg-background text-right font-mono"
          />
        </div>

        {/* Risk percent */}
        <div className="flex items-center justify-between">
          <label className="text-xs">Risk % per Trade</label>
          <span className="text-xs font-mono text-muted-foreground">{config.riskPercent}%</span>
        </div>

        {/* Pairs */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium">
              Pairs ({enabledCount}/{config.maxEnabledPairs})
            </label>
            {availablePairs.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px] gap-1"
                onClick={() => setAddingPair(!addingPair)}
                disabled={enabledCount >= config.maxEnabledPairs}
              >
                <Plus className="size-3" /> Add
              </Button>
            )}
          </div>

          {/* Add pair selector */}
          {addingPair && (
            <div className="mb-2 p-2 border rounded bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <select
                  id="pair-select"
                  className="flex-1 h-7 text-xs px-2 border rounded bg-background"
                  defaultValue=""
                >
                  <option value="" disabled>Select pair...</option>
                  {FOREX_PAIR_GROUPS.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.pairs
                        .filter((p) => !localPairs.some((lp) => lp.instrument === p.value))
                        .map((p) => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                    </optgroup>
                  ))}
                </select>
                <select
                  id="tf-select"
                  className="w-24 h-7 text-xs px-2 border rounded bg-background"
                  defaultValue="daily"
                >
                  {TF_SET_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <Button
                  variant="default"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    const pairEl = document.getElementById("pair-select") as HTMLSelectElement
                    const tfEl = document.getElementById("tf-select") as HTMLSelectElement
                    if (pairEl.value) {
                      handleAddPair(pairEl.value, tfEl.value as TradeFinderTimeframeSet)
                    }
                  }}
                >
                  Add
                </Button>
              </div>
            </div>
          )}

          {/* Pair list */}
          <div className="space-y-1">
            {localPairs.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No pairs configured. Add pairs to start scanning.</p>
            ) : (
              localPairs.map((pair) => (
                <div key={pair.instrument} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50">
                  <button
                    onClick={() => handleTogglePair(pair.instrument)}
                    className={`size-3 rounded-sm border ${pair.enabled ? "bg-primary border-primary" : "border-muted-foreground"}`}
                  />
                  <span className="text-xs flex-1 font-mono">{formatInstrument(pair.instrument)}</span>
                  <select
                    className="h-6 text-[10px] px-1 border rounded bg-background"
                    value={pair.timeframeSet}
                    onChange={(e) => handleTfSetChange(pair.instrument, e.target.value as TradeFinderTimeframeSet)}
                  >
                    {TF_SET_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleRemovePair(pair.instrument)}
                    className="text-muted-foreground hover:text-red-500"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
