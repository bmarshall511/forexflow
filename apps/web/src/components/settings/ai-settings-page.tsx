"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { AI_MODEL_OPTIONS, type AiClaudeModel, type AiAnalysisDepth } from "@fxflow/types"
import { useAiSettings } from "@/hooks/use-ai-settings"
import {
  Eye,
  EyeOff,
  Trash2,
  CheckCircle2,
  Sparkles,
  AlertTriangle,
  Shield,
  Zap,
  GraduationCap,
  CalendarDays,
} from "lucide-react"

// ─── Key Field ────────────────────────────────────────────────────────────────

function ApiKeyField({
  label,
  description,
  hasKey,
  lastFour,
  onSave,
  onRemove,
}: {
  label: string
  description: string
  hasKey: boolean
  lastFour: string
  onSave: (key: string) => Promise<void>
  onRemove: () => Promise<void>
}) {
  const [value, setValue] = useState("")
  const [showInput, setShowInput] = useState(false)
  const [showValue, setShowValue] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!value.trim()) return
    setSaving(true)
    try {
      await onSave(value.trim())
      setValue("")
      setShowInput(false)
      toast.success(`${label} saved`)
    } catch {
      toast.error(`Failed to save ${label}`)
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    setSaving(true)
    try {
      await onRemove()
      toast.success(`${label} removed`)
    } catch {
      toast.error(`Failed to remove ${label}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      <p className="text-muted-foreground text-xs">{description}</p>

      {hasKey ? (
        <div className="flex items-center gap-2">
          <div className="bg-muted flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs">
            <CheckCircle2 className="size-3 text-emerald-500" />
            <span>Configured ••••{lastFour}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive h-7 gap-1 text-xs"
            onClick={() => void handleRemove()}
            disabled={saving}
          >
            <Trash2 className="size-3" />
            Remove
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowInput(!showInput)}
          >
            Replace
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setShowInput(true)}
        >
          Add Key
        </Button>
      )}

      {showInput && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              type={showValue ? "text" : "password"}
              placeholder="Paste API key…"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-8 pr-8 text-xs"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowValue(!showValue)}
              className="text-muted-foreground hover:text-foreground absolute right-2 top-1/2 -translate-y-1/2"
            >
              {showValue ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
            </button>
          </div>
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={() => void handleSave()}
            disabled={!value.trim() || saving}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setShowInput(false)
              setValue("")
            }}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`focus-visible:ring-ring relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${checked ? "bg-primary" : "bg-input"}`}
    >
      <span
        className={`bg-background pointer-events-none inline-block h-4 w-4 rounded-full shadow-lg ring-0 transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`}
      />
    </button>
  )
}

// ─── Compact Toggle Row ──────────────────────────────────────────────────────

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        {description && <p className="text-muted-foreground text-xs">{description}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  )
}

// ─── Select styling ──────────────────────────────────────────────────────────

const selectClass =
  "flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AiSettingsPage() {
  const {
    settings,
    isLoading,
    saveClaudeKey,
    removeClaudeKey,
    saveFinnhubKey,
    removeFinnhubKey,
    savePreferences,
  } = useAiSettings()
  const [saving, setSaving] = useState(false)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!settings) {
    return <p className="text-muted-foreground text-sm">Failed to load AI settings.</p>
  }

  const autoAnalysis = settings.autoAnalysis
  const isAutoDisabled = !!autoAnalysis.autoDisabledReason

  const handleReEnableAuto = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/ai/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "re-enable-auto" }),
      })
      const json = (await res.json()) as { ok: boolean }
      if (json.ok) {
        toast.success("Auto-analysis re-enabled")
        window.location.reload()
      } else {
        toast.error("Failed to re-enable auto-analysis")
      }
    } catch {
      toast.error("Failed to re-enable auto-analysis")
    } finally {
      setSaving(false)
    }
  }

  const updatePref = async (updates: Partial<typeof autoAnalysis>) => {
    setSaving(true)
    try {
      await savePreferences(updates)
    } catch {
      toast.error("Failed to save preferences")
    } finally {
      setSaving(false)
    }
  }

  const handleLiveAutoApplyToggle = async (enabled: boolean) => {
    if (enabled) {
      const confirmed = window.confirm(
        "Are you sure you want to enable auto-apply on your live account? " +
          "AI-recommended actions will be executed automatically on real money trades.",
      )
      if (!confirmed) return
    }
    await updatePref({ liveAutoApplyEnabled: enabled })
  }

  return (
    <div className="space-y-6">
      {/* ── API Keys ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="text-primary size-4" />
            API Keys
          </CardTitle>
          <CardDescription>
            API keys are encrypted at rest and never transmitted to the browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ApiKeyField
            label="Claude API Key"
            description="Required for AI analysis. Get your key at console.anthropic.com."
            hasKey={settings.hasClaudeKey}
            lastFour={settings.claudeKeyLastFour}
            onSave={saveClaudeKey}
            onRemove={removeClaudeKey}
          />

          <Separator />

          <ApiKeyField
            label="FinnHub API Key (optional)"
            description="Provides economic calendar and forex news context. Free tier available at finnhub.io."
            hasKey={settings.hasFinnhubKey}
            lastFour={settings.finnhubKeyLastFour}
            onSave={saveFinnhubKey}
            onRemove={removeFinnhubKey}
          />
        </CardContent>
      </Card>

      {/* ── Analysis Defaults ── */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis Defaults</CardTitle>
          <CardDescription>
            The model and depth pre-selected when opening the AI analysis sheet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Default Model</Label>
            <select
              value={autoAnalysis.defaultModel}
              onChange={(e) => void updatePref({ defaultModel: e.target.value as AiClaudeModel })}
              disabled={saving}
              className={selectClass}
            >
              {AI_MODEL_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name} — {opt.description}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Default Depth</Label>
            <select
              value={autoAnalysis.defaultDepth}
              onChange={(e) => void updatePref({ defaultDepth: e.target.value as AiAnalysisDepth })}
              disabled={saving}
              className={selectClass}
            >
              <option value="quick">Quick — Fast assessment, key risks</option>
              <option value="standard">Standard — Full analysis and recommendations</option>
              <option value="deep">Deep — Multi-timeframe, highest quality</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* ── Automation ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="size-4 text-amber-500" />
            Automation
          </CardTitle>
          <CardDescription>
            Configure automatic analysis triggers and how AI suggestions are applied.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Auto-disabled warning */}
          {isAutoDisabled && (
            <div className="space-y-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-500" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-red-600">
                    Auto-analysis was disabled due to repeated failures
                  </p>
                  <p className="text-muted-foreground text-xs">{autoAnalysis.autoDisabledReason}</p>
                  {autoAnalysis.autoDisabledAt && (
                    <p className="text-muted-foreground text-xs">
                      Disabled at: {new Date(autoAnalysis.autoDisabledAt).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => void handleReEnableAuto()}
                disabled={saving}
              >
                Re-enable Auto-Analysis
              </Button>
            </div>
          )}

          {/* ── Sub-section: Analysis Triggers ── */}
          <div className="bg-muted/5 space-y-4 rounded-lg border p-4">
            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
              Analysis Triggers
            </p>

            <ToggleRow
              label="Enable Auto-Analysis"
              description="Master toggle for all automatic analysis triggers"
              checked={autoAnalysis.enabled}
              onChange={(v) => void updatePref({ enabled: v })}
              disabled={saving}
            />

            {autoAnalysis.enabled && (
              <>
                <Separator />

                {/* Event triggers in compact grid */}
                <div className="space-y-2">
                  <p className="text-xs font-medium">Event Triggers</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[
                      { key: "onPendingCreate" as const, label: "New Pending Order" },
                      { key: "onOrderFill" as const, label: "Order Filled" },
                      { key: "onTradeClose" as const, label: "Trade Closed" },
                      { key: "notifyOnComplete" as const, label: "Notify on Complete" },
                    ].map(({ key, label }) => (
                      <div
                        key={key}
                        className="bg-background flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                      >
                        <span className="text-xs">{label}</span>
                        <Toggle
                          checked={autoAnalysis[key]}
                          onChange={(v) => void updatePref({ [key]: v })}
                          disabled={saving}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Interval analysis */}
                <div className="space-y-2">
                  <ToggleRow
                    label="Re-analyze Periodically"
                    description="Automatically re-analyze open trades at set intervals"
                    checked={autoAnalysis.intervalEnabled}
                    onChange={(v) => void updatePref({ intervalEnabled: v })}
                    disabled={saving}
                  />
                  {autoAnalysis.intervalEnabled && (
                    <div className="flex items-center gap-2 pl-1">
                      <Input
                        type="number"
                        min="1"
                        max="24"
                        step="1"
                        className="h-8 w-24 text-xs"
                        value={autoAnalysis.intervalHours}
                        onChange={(e) =>
                          void updatePref({ intervalHours: parseInt(e.target.value) || 4 })
                        }
                        disabled={saving}
                      />
                      <span className="text-muted-foreground text-xs">hours between analyses</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ── Sub-section: Auto-Apply Conditions ── */}
          <div className="bg-muted/5 space-y-3 rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                Auto-Apply Conditions
              </p>
              <Shield className="text-muted-foreground size-3" />
            </div>

            <ToggleRow
              label="Create AI-Suggested Conditions"
              description="Automatically add trade conditions recommended by AI analysis"
              checked={autoAnalysis.autoApplyConditions}
              onChange={(v) => void updatePref({ autoApplyConditions: v })}
              disabled={saving}
            />

            <p className="text-muted-foreground pl-0.5 text-[11px] italic">
              Applies to both automatic and manual analyses. Conditions only monitor — they do not
              trade until triggered.
            </p>

            {autoAnalysis.autoApplyConditions && (
              <>
                <Separator />
                <div className="space-y-1.5">
                  <Label className="text-xs">Minimum Confidence for Conditions</Label>
                  <select
                    value={autoAnalysis.autoApplyMinConditionConfidence ?? "medium"}
                    onChange={(e) =>
                      void updatePref({
                        autoApplyMinConditionConfidence: e.target.value as
                          | "high"
                          | "medium"
                          | "low",
                      })
                    }
                    disabled={saving}
                    className={selectClass}
                  >
                    <option value="high">High — Only highest confidence conditions</option>
                    <option value="medium">Medium — Moderate confidence and above</option>
                    <option value="low">Low — All confidence levels</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Minimum Confidence for Stop-Loss Conditions</Label>
                  <select
                    value={autoAnalysis.autoApplyMinSLConditionConfidence ?? "high"}
                    onChange={(e) =>
                      void updatePref({
                        autoApplyMinSLConditionConfidence: e.target.value as
                          | "high"
                          | "medium"
                          | "low",
                      })
                    }
                    disabled={saving}
                    className={selectClass}
                  >
                    <option value="high">High — Only highest confidence (recommended)</option>
                    <option value="medium">Medium — Moderate confidence and above</option>
                    <option value="low">Low — All confidence levels</option>
                  </select>
                  <p className="text-muted-foreground text-[10px]">
                    SL modifications (breakeven, move stop-loss) directly affect risk — a higher bar
                    prevents premature stop-outs from marginal AI suggestions.
                  </p>
                </div>
              </>
            )}
          </div>

          {/* ── Sub-section: Auto-Apply Actions ── */}
          <div className="bg-muted/5 space-y-3 rounded-lg border border-l-4 border-l-red-500/30 p-4">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                Auto-Apply Actions
              </p>
              <Badge variant="outline" className="border-amber-500/50 text-[10px] text-amber-600">
                Caution
              </Badge>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <p className="text-sm">Practice Account</p>
                <Badge variant="outline" className="h-4 px-1 text-[10px]">
                  Safe
                </Badge>
              </div>
              <Toggle
                checked={autoAnalysis.practiceAutoApplyEnabled}
                onChange={(v) => void updatePref({ practiceAutoApplyEnabled: v })}
                disabled={saving}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <p className="text-sm">Live Account</p>
                <Badge
                  variant="outline"
                  className="h-4 border-red-500/50 px-1 text-[10px] text-red-600"
                >
                  Risk
                </Badge>
              </div>
              <Toggle
                checked={autoAnalysis.liveAutoApplyEnabled}
                onChange={(v) => void handleLiveAutoApplyToggle(v)}
                disabled={saving}
              />
            </div>

            {(autoAnalysis.practiceAutoApplyEnabled || autoAnalysis.liveAutoApplyEnabled) && (
              <>
                <Separator />
                <div className="space-y-1.5">
                  <Label className="text-xs">Minimum Confidence for Actions</Label>
                  <p className="text-muted-foreground text-[11px]">
                    Only auto-apply actions at or above this confidence level
                  </p>
                  <select
                    value={autoAnalysis.autoApplyMinConfidence ?? "high"}
                    onChange={(e) =>
                      void updatePref({
                        autoApplyMinConfidence: e.target.value as "high" | "medium" | "low",
                      })
                    }
                    disabled={saving}
                    className={selectClass}
                  >
                    <option value="high">High — Safest, only highest confidence actions</option>
                    <option value="medium">Medium — Moderate confidence and above</option>
                    <option value="low">Low — Most aggressive, all confidence levels</option>
                  </select>
                </div>
              </>
            )}

            <p className="text-[11px] italic text-red-600/70">
              Auto-apply executes trade modifications automatically. Use with extreme caution on
              live accounts.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Learning Mode ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="size-4 text-blue-500" />
            Learning Mode
          </CardTitle>
          <CardDescription>
            Get educational explanations alongside every analysis to help you learn trading
            concepts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ToggleRow
            label="Enable Learning Mode"
            description="Each analysis section will include a plain-English explanation of the concepts and indicators used, written so a complete beginner can understand."
            checked={autoAnalysis.learningMode ?? false}
            onChange={(v) => void updatePref({ learningMode: v })}
            disabled={saving}
          />
        </CardContent>
      </Card>

      {/* ── AI Digest ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="size-4 text-violet-500" />
            Performance Digest
          </CardTitle>
          <CardDescription>
            Get periodic AI-generated reports analyzing your trading patterns, mistakes, and
            improvements.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow
            label="Enable Automatic Digests"
            description="AI will analyze your trades at the end of each period and generate a comprehensive performance report."
            checked={autoAnalysis.digestEnabled ?? false}
            onChange={(v) => void updatePref({ digestEnabled: v })}
            disabled={saving}
          />

          {autoAnalysis.digestEnabled && (
            <>
              <Separator />
              <div className="space-y-1.5">
                <Label className="text-xs">Frequency</Label>
                <select
                  value={autoAnalysis.digestFrequency ?? "weekly"}
                  onChange={(e) =>
                    void updatePref({
                      digestFrequency: e.target.value as "weekly" | "monthly" | "both",
                    })
                  }
                  disabled={saving}
                  className={selectClass}
                >
                  <option value="weekly">Weekly — Every Monday</option>
                  <option value="monthly">Monthly — 1st of each month</option>
                  <option value="both">Both — Weekly and monthly reports</option>
                </select>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
