"use client"

import { useState } from "react"
import type { ZoneDisplaySettings, ZonePreset, ZoneDetectionConfig, ChartPanelZoneOverrides, TrendDisplaySettings, ChartPanelTrendOverrides } from "@fxflow/types"
import { ZONE_PRESETS, getPresetConfig } from "@fxflow/shared"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

interface ZoneControlsPopoverProps {
  settings: ZoneDisplaySettings
  overrides: ChartPanelZoneOverrides
  onSaveGlobal: (settings: ZoneDisplaySettings) => Promise<void>
  onSetOverrides: (overrides: ChartPanelZoneOverrides) => void
  isComputing: boolean
  lastComputedAt: string | null
  onRecompute: () => void
  chartTimeframe: string
  trendSettings?: TrendDisplaySettings
  trendOverrides?: ChartPanelTrendOverrides
  onSaveTrendGlobal?: (settings: TrendDisplaySettings) => Promise<void>
  onSetTrendOverrides?: (overrides: ChartPanelTrendOverrides) => void
  trendComputing?: boolean
  trendLastComputedAt?: string | null
  onTrendRecompute?: () => void
  children: React.ReactNode
}

type Tab = "zones" | "trends"

const PRESET_LABELS: Record<ZonePreset, { label: string; desc: string }> = {
  conservative: { label: "Conservative", desc: "Show only the strongest zones" },
  standard: { label: "Standard", desc: "Good balance of quality and quantity" },
  aggressive: { label: "Aggressive", desc: "Show more zones, catch more opportunities" },
  custom: { label: "Custom", desc: "You've tweaked the settings manually" },
}

export function ZoneControlsPopover({
  settings,
  overrides,
  onSaveGlobal,
  onSetOverrides,
  isComputing,
  lastComputedAt,
  onRecompute,
  chartTimeframe,
  trendSettings,
  trendOverrides,
  onSaveTrendGlobal,
  onSetTrendOverrides,
  trendComputing,
  trendLastComputedAt,
  onTrendRecompute,
  children,
}: ZoneControlsPopoverProps) {
  const [tab, setTab] = useState<Tab>("zones")
  const [zoneAdvOpen, setZoneAdvOpen] = useState(false)
  const [trendAdvOpen, setTrendAdvOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const hasTrend = !!(trendSettings && onSaveTrendGlobal && onSetTrendOverrides)

  const updateGlobal = async (patch: Partial<ZoneDisplaySettings>) => {
    setSaving(true)
    try {
      await onSaveGlobal({ ...settings, ...patch })
    } finally {
      setSaving(false)
    }
  }

  const updateConfig = async (patch: Partial<ZoneDetectionConfig>) => {
    const newConfig = { ...settings.algorithmConfig, ...patch, preset: "custom" as ZonePreset }
    await updateGlobal({ algorithmConfig: newConfig })
  }

  const handlePresetChange = async (preset: ZonePreset) => {
    if (preset === "custom") {
      await updateGlobal({ algorithmConfig: { ...settings.algorithmConfig, preset: "custom" } })
    } else {
      await updateGlobal({ algorithmConfig: getPresetConfig(preset) })
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] max-h-[75vh] overflow-hidden p-0 rounded-xl" sideOffset={6}>
        <div className="flex flex-col max-h-[75vh]">
          {/* ── Header with tabs ───────────────────────────────── */}
          <div className="shrink-0">
            <div className="px-3 pt-3 pb-1.5">
              <h3 className="text-sm font-semibold">Chart Overlays</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Visual layers drawn on top of your chart
              </p>
            </div>

            {/* Tab bar */}
            {hasTrend && (
              <div className="flex gap-1 px-3 pb-2">
                <TabButton
                  active={tab === "zones"}
                  onClick={() => setTab("zones")}
                  color="emerald"
                  enabled={settings.enabled}
                >
                  Zones
                </TabButton>
                <TabButton
                  active={tab === "trends"}
                  onClick={() => setTab("trends")}
                  color="blue"
                  enabled={trendSettings.enabled}
                >
                  Trends
                </TabButton>
              </div>
            )}

            <div className="h-px bg-border" />
          </div>

          {/* ── Scrollable content ─────────────────────────────── */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {tab === "zones" ? (
              <ZonesTab
                settings={settings}
                overrides={overrides}
                onSaveGlobal={updateGlobal}
                onSetOverrides={onSetOverrides}
                handlePresetChange={handlePresetChange}
                updateConfig={updateConfig}
                chartTimeframe={chartTimeframe}
                advOpen={zoneAdvOpen}
                setAdvOpen={setZoneAdvOpen}
              />
            ) : hasTrend ? (
              <TrendsTab
                trendSettings={trendSettings}
                trendOverrides={trendOverrides!}
                onSaveTrendGlobal={onSaveTrendGlobal}
                onSetTrendOverrides={onSetTrendOverrides}
                advOpen={trendAdvOpen}
                setAdvOpen={setTrendAdvOpen}
              />
            ) : null}
          </div>

          {/* ── Footer ─────────────────────────────────────────── */}
          <div className="shrink-0 border-t">
            {tab === "zones" ? (
              <FooterBar
                onRecompute={onRecompute}
                computing={isComputing}
                lastComputed={lastComputedAt}
                label="Refresh zones"
                color="emerald"
              />
            ) : (
              <FooterBar
                onRecompute={onTrendRecompute ?? (() => {})}
                computing={trendComputing ?? false}
                lastComputed={trendLastComputedAt ?? null}
                label="Refresh trend"
                color="blue"
              />
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ─── Zones Tab ──────────────────────────────────────────────────────────────

function ZonesTab({
  settings,
  overrides,
  onSaveGlobal,
  onSetOverrides,
  handlePresetChange,
  updateConfig,
  chartTimeframe,
  advOpen,
  setAdvOpen,
}: {
  settings: ZoneDisplaySettings
  overrides: ChartPanelZoneOverrides
  onSaveGlobal: (patch: Partial<ZoneDisplaySettings>) => Promise<void>
  onSetOverrides: (overrides: ChartPanelZoneOverrides) => void
  handlePresetChange: (preset: ZonePreset) => Promise<void>
  updateConfig: (patch: Partial<ZoneDetectionConfig>) => Promise<void>
  chartTimeframe: string
  advOpen: boolean
  setAdvOpen: (open: boolean) => void
}) {
  return (
    <div className="py-2">
      {/* Master toggle */}
      <MasterToggle
        id="zone-enabled"
        label="Show Zones"
        description="Price areas where buying or selling pressure was strong"
        enabled={settings.enabled}
        color="emerald"
        onToggle={() => {
          onSetOverrides({ ...overrides, enabled: !settings.enabled })
          onSaveGlobal({ enabled: !settings.enabled })
        }}
      />

      {settings.enabled && (
        <>
          {/* Preset pills */}
          <Section title="Detection Style" className="pt-1">
            <div className="grid grid-cols-3 gap-1.5">
              {(["conservative", "standard", "aggressive"] as ZonePreset[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePresetChange(p)}
                  className={cn(
                    "rounded-lg px-2 py-1.5 text-[11px] font-medium transition-all",
                    settings.algorithmConfig.preset === p
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {PRESET_LABELS[p].label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              {PRESET_LABELS[settings.algorithmConfig.preset].desc}
            </p>
          </Section>

          {/* Display options */}
          <Section title="Display">
            <div className="space-y-1">
              <SliderRow
                label="How many zones to show"
                value={settings.maxZonesPerType}
                min={1}
                max={10}
                step={1}
                suffix=""
                color="emerald"
                onChange={(v) => {
                  onSetOverrides({ ...overrides, maxZonesPerType: v })
                  onSaveGlobal({ maxZonesPerType: v })
                }}
              />
              <SliderRow
                label="Minimum quality score"
                value={settings.minScore}
                min={0}
                max={5}
                step={0.5}
                suffix=""
                color="emerald"
                onChange={(v) => {
                  onSetOverrides({ ...overrides, minScore: v })
                  onSaveGlobal({ minScore: v })
                }}
              />
            </div>
          </Section>

          {/* Features */}
          <Section title="Features">
            <div className="space-y-0.5">
              <CompactToggle
                label="Show broken zones"
                checked={settings.showInvalidated}
                onChange={(v) => {
                  onSetOverrides({ ...overrides, showInvalidated: v })
                  onSaveGlobal({ showInvalidated: v })
                }}
              />
              <CompactToggle
                label="Higher timeframe zones"
                checked={settings.showHigherTf}
                onChange={(v) => {
                  onSetOverrides({ ...overrides, showHigherTf: v })
                  onSaveGlobal({ showHigherTf: v })
                }}
              />
              {settings.showHigherTf && (
                <InlineSelect
                  label="Timeframe"
                  value={settings.higherTimeframe ?? ""}
                  onChange={(v) => onSaveGlobal({ higherTimeframe: v || null })}
                  options={[
                    { value: "", label: "Auto" },
                    { value: "M15", label: "M15" },
                    { value: "M30", label: "M30" },
                    { value: "H1", label: "H1" },
                    { value: "H4", label: "H4" },
                    { value: "D", label: "Daily" },
                    { value: "W", label: "Weekly" },
                  ]}
                />
              )}
              <CompactToggle
                label="Show curve indicator"
                checked={settings.curve.enabled}
                onChange={(v) => {
                  onSetOverrides({ ...overrides, showCurve: v })
                  onSaveGlobal({ curve: { ...settings.curve, enabled: v } })
                }}
              />
              {settings.curve.enabled && (
                <InlineSelect
                  label="Curve timeframe"
                  value={settings.curve.timeframe === chartTimeframe ? "__chart__" : settings.curve.timeframe ?? ""}
                  onChange={(v) => {
                    const tf = v === "__chart__" ? chartTimeframe : v || null
                    onSaveGlobal({ curve: { ...settings.curve, timeframe: tf } })
                  }}
                  options={[
                    { value: "", label: "Auto" },
                    { value: "__chart__", label: `Chart (${chartTimeframe})` },
                    { value: "H1", label: "H1" },
                    { value: "H4", label: "H4" },
                    { value: "D", label: "Daily" },
                    { value: "W", label: "Weekly" },
                  ]}
                />
              )}
            </div>
          </Section>

          {/* Advanced */}
          <AdvancedSection open={advOpen} onOpenChange={setAdvOpen}>
            <SliderRow
              label="Leg body ratio"
              value={settings.algorithmConfig.minLegBodyRatio}
              min={0.3} max={0.8} step={0.05} color="emerald"
              onChange={(v) => updateConfig({ minLegBodyRatio: v })}
            />
            <SliderRow
              label="Leg vs ATR size"
              value={settings.algorithmConfig.minLegBodyAtr}
              min={0.5} max={3.0} step={0.1} color="emerald"
              onChange={(v) => updateConfig({ minLegBodyAtr: v })}
            />
            <SliderRow
              label="Base body ratio"
              value={settings.algorithmConfig.maxBaseBodyRatio}
              min={0.2} max={0.7} step={0.05} color="emerald"
              onChange={(v) => updateConfig({ maxBaseBodyRatio: v })}
            />
            <SliderRow
              label="Max base candles"
              value={settings.algorithmConfig.maxBaseCandles}
              min={2} max={12} step={1} color="emerald"
              onChange={(v) => updateConfig({ maxBaseCandles: v })}
            />
            <SliderRow
              label="Move-out strength"
              value={settings.algorithmConfig.minMoveOutMultiple}
              min={1.0} max={5.0} step={0.5} color="emerald"
              onChange={(v) => updateConfig({ minMoveOutMultiple: v })}
            />
            <SliderRow
              label="Lookback candles"
              value={settings.lookbackCandles}
              min={100} max={1000} step={50} color="emerald"
              onChange={(v) => onSaveGlobal({ lookbackCandles: v })}
            />
          </AdvancedSection>
        </>
      )}
    </div>
  )
}

// ─── Trends Tab ─────────────────────────────────────────────────────────────

function TrendsTab({
  trendSettings,
  trendOverrides,
  onSaveTrendGlobal,
  onSetTrendOverrides,
  advOpen,
  setAdvOpen,
}: {
  trendSettings: TrendDisplaySettings
  trendOverrides: ChartPanelTrendOverrides
  onSaveTrendGlobal: (settings: TrendDisplaySettings) => Promise<void>
  onSetTrendOverrides: (overrides: ChartPanelTrendOverrides) => void
  advOpen: boolean
  setAdvOpen: (open: boolean) => void
}) {
  const save = (patch: Partial<TrendDisplaySettings>) => {
    onSaveTrendGlobal({ ...trendSettings, ...patch })
  }
  const saveVisual = (patch: Partial<TrendDisplaySettings["visuals"]>) => {
    save({ visuals: { ...trendSettings.visuals, ...patch } })
  }

  return (
    <div className="py-2">
      {/* Master toggle */}
      <MasterToggle
        id="trend-enabled"
        label="Show Trend"
        description="See if price is moving up, down, or sideways"
        enabled={trendSettings.enabled}
        color="blue"
        onToggle={() => {
          onSetTrendOverrides({ ...trendOverrides, enabled: !trendSettings.enabled })
          save({ enabled: !trendSettings.enabled })
        }}
      />

      {trendSettings.enabled && (
        <>
          {/* What to show */}
          <Section title="What to Show">
            <div className="space-y-0.5">
              <CompactToggle
                label="Connecting lines"
                hint="Lines between turning points"
                checked={trendSettings.visuals.showLines}
                onChange={(v) => {
                  onSetTrendOverrides({ ...trendOverrides, showLines: v })
                  saveVisual({ showLines: v })
                }}
              />
              <CompactToggle
                label="Turning point dots"
                hint="Circles at highs and lows"
                checked={trendSettings.visuals.showMarkers}
                onChange={(v) => {
                  onSetTrendOverrides({ ...trendOverrides, showMarkers: v })
                  saveVisual({ showMarkers: v })
                }}
              />
              <CompactToggle
                label="Labels (HH, HL, etc.)"
                hint="Tags showing the pattern at each point"
                checked={trendSettings.visuals.showLabels}
                onChange={(v) => {
                  onSetTrendOverrides({ ...trendOverrides, showLabels: v })
                  saveVisual({ showLabels: v })
                }}
              />
              <CompactToggle
                label="Colored boxes"
                hint="Shaded areas between turning points"
                checked={trendSettings.visuals.showBoxes}
                onChange={(v) => {
                  onSetTrendOverrides({ ...trendOverrides, showBoxes: v })
                  saveVisual({ showBoxes: v })
                }}
              />
              <CompactToggle
                label="Key level line"
                hint="The price that would break the trend"
                checked={trendSettings.visuals.showControllingSwing}
                onChange={(v) => saveVisual({ showControllingSwing: v })}
              />
            </div>
          </Section>

          {/* Multi-timeframe */}
          <Section title="Bigger Picture">
            <div className="space-y-0.5">
              <CompactToggle
                label="Show higher timeframe trend"
                hint="See the trend from a zoomed-out view"
                checked={trendSettings.showHigherTf}
                onChange={(v) => {
                  onSetTrendOverrides({ ...trendOverrides, showHigherTf: v })
                  save({ showHigherTf: v })
                }}
              />
              {trendSettings.showHigherTf && (
                <InlineSelect
                  label="Timeframe"
                  value={trendSettings.higherTimeframe ?? ""}
                  onChange={(v) => save({ higherTimeframe: v || null })}
                  options={[
                    { value: "", label: "Auto" },
                    { value: "M15", label: "M15" },
                    { value: "M30", label: "M30" },
                    { value: "H1", label: "H1" },
                    { value: "H4", label: "H4" },
                    { value: "D", label: "Daily" },
                    { value: "W", label: "Weekly" },
                  ]}
                />
              )}
            </div>
          </Section>

          {/* Advanced */}
          <AdvancedSection open={advOpen} onOpenChange={setAdvOpen}>
            <SliderRow
              label="Swing sensitivity"
              value={trendSettings.config.swingStrength}
              min={0} max={10} step={1} color="blue"
              hint="0 = automatic"
              onChange={(v) => save({ config: { ...trendSettings.config, swingStrength: v } })}
            />
            <SliderRow
              label="Min move size"
              value={trendSettings.config.minSegmentAtr}
              min={0} max={3} step={0.1} color="blue"
              onChange={(v) => save({ config: { ...trendSettings.config, minSegmentAtr: v } })}
            />
            <SliderRow
              label="Max turning points"
              value={trendSettings.config.maxSwingPoints}
              min={6} max={50} step={2} color="blue"
              onChange={(v) => save({ config: { ...trendSettings.config, maxSwingPoints: v } })}
            />
            <SliderRow
              label="Lookback candles"
              value={trendSettings.config.lookbackCandles}
              min={100} max={1000} step={50} color="blue"
              onChange={(v) => save({ config: { ...trendSettings.config, lookbackCandles: v } })}
            />
          </AdvancedSection>
        </>
      )}
    </div>
  )
}

// ─── Shared Components ──────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  color,
  enabled,
  children,
}: {
  active: boolean
  onClick: () => void
  color: "emerald" | "blue"
  enabled: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
        active
          ? color === "emerald"
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20"
            : "bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
      )}
    >
      {/* Status dot */}
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full shrink-0",
          enabled
            ? color === "emerald" ? "bg-emerald-500" : "bg-blue-500"
            : "bg-muted-foreground/30",
        )}
      />
      {children}
    </button>
  )
}

function MasterToggle({
  id,
  label,
  description,
  enabled,
  color,
  onToggle,
}: {
  id: string
  label: string
  description: string
  enabled: boolean
  color: "emerald" | "blue"
  onToggle: () => void
}) {
  return (
    <div className="mx-3 mb-2 rounded-lg border p-2.5 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <label htmlFor={id} className="text-sm font-medium cursor-pointer leading-tight">
          {label}
        </label>
        <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={onToggle}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors",
          enabled
            ? color === "emerald" ? "bg-emerald-500" : "bg-blue-500"
            : "bg-muted",
        )}
      >
        <span
          className={cn(
            "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-md transition-transform mt-0.5 ml-0.5",
            enabled ? "translate-x-5" : "translate-x-0",
          )}
        />
      </button>
    </div>
  )
}

function Section({
  title,
  className,
  children,
}: {
  title: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("px-3 py-2", className)}>
      <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {title}
      </h4>
      {children}
    </div>
  )
}

function CompactToggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-center gap-2.5 w-full rounded-md px-2 py-1.5 text-left transition-colors",
        checked ? "bg-accent/50" : "hover:bg-accent/30",
      )}
    >
      {/* Checkbox-style indicator */}
      <span
        className={cn(
          "flex items-center justify-center h-4 w-4 rounded shrink-0 border transition-colors",
          checked
            ? "bg-foreground border-foreground"
            : "border-muted-foreground/40",
        )}
      >
        {checked && (
          <svg className="h-3 w-3 text-background" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-[12px] leading-tight">{label}</span>
        {hint && (
          <span className="block text-[10px] text-muted-foreground leading-tight mt-px">{hint}</span>
        )}
      </span>
    </button>
  )
}

function InlineSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1 ml-6">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border bg-background px-2 py-0.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring min-w-[5rem] text-right"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  suffix,
  color,
  hint,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  suffix?: string
  color: "emerald" | "blue"
  hint?: string
  onChange: (value: number) => void
}) {
  const display = Number.isInteger(step) ? value.toString() : value.toFixed(step < 0.1 ? 2 : 1)

  return (
    <div className="space-y-1 py-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className={cn(
          "text-[11px] font-mono tabular-nums font-medium",
          color === "emerald" ? "text-emerald-600 dark:text-emerald-400" : "text-blue-600 dark:text-blue-400",
        )}>
          {display}{suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const v = Number.isInteger(step) ? parseInt(e.target.value) : parseFloat(e.target.value)
          onChange(v)
        }}
        className={cn(
          "w-full h-1.5 rounded-full appearance-none cursor-pointer",
          "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-sm",
          color === "emerald"
            ? "accent-emerald-500 bg-emerald-500/20 [&::-webkit-slider-thumb]:bg-emerald-500"
            : "accent-blue-500 bg-blue-500/20 [&::-webkit-slider-thumb]:bg-blue-500",
        )}
      />
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

function AdvancedSection({
  open,
  onOpenChange,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div className="border-t mx-3" />
      <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
        <span className="font-medium">Fine-tune settings</span>
        <svg
          className={cn("h-3 w-3 transition-transform", open && "rotate-180")}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-3 pb-2 space-y-0.5">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function FooterBar({
  onRecompute,
  computing,
  lastComputed,
  label,
  color,
}: {
  onRecompute: () => void
  computing: boolean
  lastComputed: string | null
  label: string
  color: "emerald" | "blue"
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <button
        type="button"
        onClick={onRecompute}
        disabled={computing}
        className={cn(
          "text-[11px] font-medium transition-colors disabled:opacity-50",
          computing
            ? "text-muted-foreground animate-pulse"
            : color === "emerald"
              ? "text-emerald-600 dark:text-emerald-400 hover:text-emerald-500"
              : "text-blue-600 dark:text-blue-400 hover:text-blue-500",
        )}
      >
        {computing ? "Computing..." : label}
      </button>
      {lastComputed && (
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {new Date(lastComputed).toLocaleTimeString()}
        </span>
      )}
    </div>
  )
}
