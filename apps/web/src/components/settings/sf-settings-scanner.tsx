"use client"

import type {
  SmartFlowSettingsData,
  SmartFlowScanMode,
  SmartFlowOperatingMode,
  SmartFlowScannerEntryMode,
} from "@fxflow/types"
import { SMART_FLOW_DEFAULT_SCAN_MODES } from "@fxflow/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { ToggleSwitch } from "@/components/ui/toggle-switch"
import { Separator } from "@/components/ui/separator"
import { Radar, Info } from "lucide-react"

export interface SfSettingsScannerProps {
  settings: SmartFlowSettingsData
  onUpdate: (fields: Partial<SmartFlowSettingsData>) => Promise<void>
}

const INPUT_CLS = "bg-background h-8 w-16 rounded border px-2 text-right font-mono text-sm"
const SELECT_CLS =
  "flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs outline-none focus:ring-1 focus:ring-ring"

const MODE_DESC: Record<SmartFlowOperatingMode, string> = {
  manual: "Scanner suggests trades — you approve each one",
  semi_auto: "Auto-places trades scoring above threshold",
  full_auto: "Auto-places all qualifying trades",
}

const SCAN_LABELS: Record<SmartFlowScanMode, string> = {
  trend_following: "Trend Following",
  mean_reversion: "Mean Reversion",
  breakout: "Breakout",
  session_momentum: "Session Momentum",
}

const ENTRY_LABELS: Record<SmartFlowScannerEntryMode, string> = {
  market: "Market (instant)",
  optimal: "Optimal (wait for confirmation)",
  smart_entry: "Smart Entry (wait for conditions)",
}

const PRESETS = [
  { value: "auto", label: "Auto (regime-based)" },
  { value: "momentum_catch", label: "Momentum Catch" },
  { value: "steady_growth", label: "Steady Growth" },
  { value: "swing_capture", label: "Swing Capture" },
  { value: "trend_rider", label: "Trend Rider" },
] as const

function Desc({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground mt-0.5 text-xs">{children}</p>
}

export function SfSettingsScanner({ settings, onUpdate }: SfSettingsScannerProps) {
  const modes = settings.scanModes ?? { ...SMART_FLOW_DEFAULT_SCAN_MODES }
  const toggle = (m: SmartFlowScanMode) =>
    void onUpdate({ scanModes: { ...modes, [m]: !modes[m] } })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Radar className="size-5 text-blue-500" />
          <CardTitle>Market Scanner</CardTitle>
        </div>
        <CardDescription>Automatically scan markets for trade opportunities.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Label>Market Scanner</Label>
            <Desc>Automatically scan markets for trade opportunities</Desc>
          </div>
          <ToggleSwitch
            checked={settings.scannerEnabled}
            onChange={(v) => void onUpdate({ scannerEnabled: v })}
          />
        </div>
        {settings.scannerEnabled && (
          <>
            <Separator />
            <div className="space-y-2">
              <Label className="text-xs font-medium">Operating Mode</Label>
              <select
                value={settings.operatingMode}
                onChange={(e) =>
                  void onUpdate({ operatingMode: e.target.value as SmartFlowOperatingMode })
                }
                className={SELECT_CLS}
                aria-label="Operating mode"
              >
                <option value="manual">Manual</option>
                <option value="semi_auto">Semi-Auto</option>
                <option value="full_auto">Full Auto</option>
              </select>
              <Desc>{MODE_DESC[settings.operatingMode]}</Desc>
            </div>
            {settings.operatingMode === "semi_auto" && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Minimum Score for Auto-Trade</Label>
                    <Desc>Only auto-place trades scoring this high or better (30-90)</Desc>
                  </div>
                  <input
                    type="number"
                    min={30}
                    max={90}
                    step={5}
                    defaultValue={settings.autoTradeMinScore}
                    onBlur={(e) => {
                      const n = parseInt(e.target.value)
                      if (!isNaN(n) && n >= 30 && n <= 90) void onUpdate({ autoTradeMinScore: n })
                    }}
                    className={INPUT_CLS}
                    aria-label="Minimum score for auto-trade"
                  />
                </div>
              </>
            )}
            <Separator />
            <ScannerDetails
              settings={settings}
              modes={modes}
              onUpdate={onUpdate}
              onToggle={toggle}
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}

/** Extracted to keep the parent component under 150 LOC. */
function ScannerDetails({
  settings,
  modes,
  onUpdate,
  onToggle,
}: {
  settings: SmartFlowSettingsData
  modes: Record<SmartFlowScanMode, boolean>
  onUpdate: (fields: Partial<SmartFlowSettingsData>) => Promise<void>
  onToggle: (mode: SmartFlowScanMode) => void
}) {
  return (
    <div className="space-y-6">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Scan Modes</legend>
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(SCAN_LABELS) as SmartFlowScanMode[]).map((m) => (
            <label key={m} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={modes[m]}
                onChange={() => onToggle(m)}
                className="size-4 rounded border"
              />
              {SCAN_LABELS[m]}
            </label>
          ))}
        </div>
      </fieldset>

      <Separator />
      <div className="flex items-center justify-between">
        <div>
          <Label>Scan Every</Label>
          <Desc>Minutes between each market scan (5-60)</Desc>
        </div>
        <input
          type="number"
          min={5}
          max={60}
          step={5}
          defaultValue={settings.scanIntervalMinutes}
          onBlur={(e) => {
            const n = parseInt(e.target.value)
            if (!isNaN(n) && n >= 5 && n <= 60) void onUpdate({ scanIntervalMinutes: n })
          }}
          className={INPUT_CLS}
          aria-label="Scan interval in minutes"
        />
      </div>

      <Separator />
      <div className="space-y-2">
        <Label className="text-xs font-medium">Preferred Preset</Label>
        <Desc>Strategy applied to scanner-found trades</Desc>
        <select
          value={settings.preferredPreset}
          onChange={(e) => void onUpdate({ preferredPreset: e.target.value })}
          className={SELECT_CLS}
          aria-label="Preferred preset"
        >
          {PRESETS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <Separator />
      <div className="space-y-2">
        <Label className="text-xs font-medium">Entry Mode</Label>
        <select
          value={settings.scannerEntryMode}
          onChange={(e) =>
            void onUpdate({ scannerEntryMode: e.target.value as SmartFlowScannerEntryMode })
          }
          className={SELECT_CLS}
          aria-label="Entry mode"
        >
          {(Object.keys(ENTRY_LABELS) as SmartFlowScannerEntryMode[]).map((m) => (
            <option key={m} value={m}>
              {ENTRY_LABELS[m]}
            </option>
          ))}
        </select>
      </div>

      <Separator />
      <div className="space-y-4">
        <Label className="text-xs font-medium">Daily Limits</Label>
        <div className="flex items-center justify-between">
          <div>
            <Label>Max Daily Trades</Label>
            <Desc>Maximum auto-placed trades per day (1-20)</Desc>
          </div>
          <input
            type="number"
            min={1}
            max={20}
            defaultValue={settings.maxDailyAutoTrades}
            onBlur={(e) => {
              const n = parseInt(e.target.value)
              if (!isNaN(n) && n >= 1 && n <= 20) void onUpdate({ maxDailyAutoTrades: n })
            }}
            className={INPUT_CLS}
            aria-label="Max daily trades"
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Label>Max Daily Scans</Label>
            <Desc>Maximum scan cycles per day (10-100)</Desc>
          </div>
          <input
            type="number"
            min={10}
            max={100}
            step={10}
            defaultValue={settings.maxDailyScans}
            onBlur={(e) => {
              const n = parseInt(e.target.value)
              if (!isNaN(n) && n >= 10 && n <= 100) void onUpdate({ maxDailyScans: n })
            }}
            className={INPUT_CLS}
            aria-label="Max daily scans"
          />
        </div>
      </div>

      <Separator />
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label>Simulation Mode</Label>
            <Desc>Run scanner logic without placing real trades — see what would happen</Desc>
          </div>
          <ToggleSwitch
            checked={settings.shadowMode}
            onChange={(v) => void onUpdate({ shadowMode: v })}
          />
        </div>
        {settings.shadowMode && (
          <div className="bg-muted/50 flex items-start gap-2 rounded-lg p-3">
            <Info className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Scanner will log opportunities but not place orders.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
