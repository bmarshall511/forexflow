"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Check, Zap } from "lucide-react"
import type { SmartFlowPreset } from "@fxflow/types"
import { PRESET_INFO, PRESET_KEYS } from "./trade-builder-presets"
import { logSmartFlowActivity } from "@/lib/smart-flow-activity"
import { StepPair, StepDirection, StepStrategy, StepReview } from "./trade-builder-steps"
import type { AiFullSuggestion } from "./step-pair"
import { StepEntryTiming } from "./step-entry-timing"

// ── Step metadata ────────────────────────────────────────────────────────

const STEPS = [
  {
    label: "Pick a Pair",
    title: "Choose Your Currency Pair",
    subtitle: "Pick the pair you want to trade. Majors are the safest for beginners.",
  },
  {
    label: "Pick Direction",
    title: "Which Way Will It Go?",
    subtitle: "Choose whether you think the price will go up or down.",
  },
  {
    label: "Choose Strategy",
    title: "Pick Your Strategy",
    subtitle: "Each strategy manages your trade differently. Start with Steady Growth if unsure.",
  },
  {
    label: "Entry Timing",
    title: "When Should SmartFlow Enter?",
    subtitle: "Enter immediately at market price, or set a target price and wait.",
  },
  {
    label: "Review & Confirm",
    title: "Review Your Trade",
    subtitle: "Everything looks good? Let SmartFlow handle the rest.",
  },
] as const

// ── Main component ───────────────────────────────────────────────────────

interface TradeBuilderProps {
  onComplete?: () => void
}

export function TradeBuilder({ onComplete }: TradeBuilderProps) {
  const [step, setStep] = useState(0)
  const [pair, setPair] = useState("")
  const [direction, setDirection] = useState<"long" | "short" | null>(null)
  const [preset, setPreset] = useState<Exclude<SmartFlowPreset, "custom">>("steady_growth")
  const [entryMode, setEntryMode] = useState<"market" | "smart_entry">("market")
  const [entryPrice, setEntryPrice] = useState("")
  const [entryExpireHours, setEntryExpireHours] = useState("")
  const [search, setSearch] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState<AiFullSuggestion | null>(null)

  function handleAiQuickStart(result: AiFullSuggestion) {
    setAiSuggestion(result)
    // Auto-set direction from AI result
    setDirection(result.direction)
    // Auto-set strategy if the suggestion maps to a valid preset
    const suggested = result.suggestedStrategy as Exclude<SmartFlowPreset, "custom"> | undefined
    if (suggested && PRESET_KEYS.includes(suggested)) {
      setPreset(suggested)
      // All fields filled — skip to Entry Timing (step 3)
      setStep(3)
    } else {
      // Direction set but no valid strategy — skip to Strategy (step 2)
      setStep(2)
    }
  }

  const canNext =
    (step === 0 && pair !== "") ||
    (step === 1 && direction !== null) ||
    (step === 2 && preset !== null) ||
    (step === 3 && (entryMode === "market" || (entryPrice !== "" && entryExpireHours !== ""))) ||
    step === 4

  const pairLabel = pair.replace("_", "/")
  const progress = ((step + 1) / STEPS.length) * 100

  async function handleSubmit() {
    if (!pair || !direction) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/smart-flow/configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instrument: pair,
          name: `${pairLabel} ${direction === "long" ? "Buy" : "Sell"} \u2014 ${PRESET_INFO[preset].label}`,
          direction,
          preset,
          isActive: true,
          entryMode,
          ...(entryMode === "smart_entry" && entryPrice !== ""
            ? { entryPrice: parseFloat(entryPrice) }
            : {}),
          ...(entryMode === "smart_entry" && entryExpireHours !== ""
            ? { entryExpireHours: parseInt(entryExpireHours, 10) }
            : {}),
          positionSizeMode: "risk_percent",
          positionSizeValue: 1,
          minRiskReward: preset === "swing_capture" ? 3 : preset === "momentum_catch" ? 1.6 : 2,
          breakevenEnabled: preset !== "recovery",
          breakevenAtrMultiple: preset === "swing_capture" ? 1.0 : 0.75,
          breakevenBufferPips: 2,
          trailingEnabled: preset !== "momentum_catch" && preset !== "recovery",
          trailingAtrMultiple: preset === "trend_rider" ? 1.0 : 0.5,
          trailingActivationAtr: preset === "swing_capture" ? 1.0 : 0.75,
          sessionAwareManagement: true,
          offSessionBehavior: "widen_thresholds",
          weekendCloseEnabled: preset === "momentum_catch",
          newsProtectionEnabled: true,
          newsProtectionMinutes: 30,
          recoveryEnabled: preset === "recovery",
          recoveryMaxLevels: 3,
          recoveryAtrInterval: 0.5,
          recoverySizeMultiplier: 1.5,
          recoveryTpAtrMultiple: 0.3,
          aiMode: "off",
          aiMonitorIntervalHours: 4,
          aiActionToggles: {},
          aiConfidenceThresholds: {},
          aiMaxActionsPerDay: 5,
          aiCooldownAfterManualMins: 60,
          aiGracePeriodMins: 30,
        }),
      })
      const json = (await res.json()) as { ok: boolean; error?: string; data?: { id: string } }
      if (!json.ok) {
        toast.error(json.error ?? "Failed to create trade plan")
        return
      }
      const configId = json.data?.id
      const configName = `${pairLabel} ${direction === "long" ? "Buy" : "Sell"} — ${PRESET_INFO[preset].label}`
      logSmartFlowActivity("config_created", `Trade plan created: ${configName}`, {
        instrument: pair,
        severity: "success",
      })

      // Auto-place trade via daemon
      if (configId) {
        const endpoint =
          entryMode === "smart_entry"
            ? `/api/daemon/smart-flow/smart-entry/${configId}`
            : `/api/daemon/smart-flow/place/${configId}`
        try {
          const placeRes = await fetch(endpoint, { method: "POST" })
          const placeJson = (await placeRes.json()) as { ok: boolean; error?: string }
          if (placeJson.ok) {
            toast.success(
              entryMode === "smart_entry"
                ? "Trade plan active! SmartFlow is watching for your target price."
                : "Trade plan active! SmartFlow placed your trade and is managing it.",
            )
          } else {
            toast.warning(
              `Trade plan saved but couldn't place trade: ${placeJson.error ?? "daemon unavailable"}`,
            )
          }
        } catch {
          toast.warning(
            "Trade plan saved — SmartFlow will place the trade when the daemon connects.",
          )
        }
      } else {
        toast.success("Trade plan created!")
      }

      window.dispatchEvent(new Event("smart-flow-updated"))
      onComplete?.()
    } catch {
      toast.error("Network error \u2014 could not save config")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Step indicator with connecting lines */}
      <nav aria-label="Wizard progress" className="flex items-center justify-center gap-0">
        {STEPS.map(({ label }, i) => (
          <div key={label} className="flex items-center">
            {i > 0 && (
              <div
                className={`hidden h-0.5 w-6 sm:block ${i <= step ? "bg-primary" : "bg-muted"} transition-colors duration-300`}
              />
            )}
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              aria-current={i === step ? "step" : undefined}
              className={`flex min-h-[44px] items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-all duration-300 ${
                i === step
                  ? "bg-primary text-primary-foreground shadow-primary/30 shadow-sm"
                  : i < step
                    ? "bg-primary/15 text-primary hover:bg-primary/25 cursor-pointer"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              <span
                className={`flex size-6 items-center justify-center rounded-full text-[11px] font-bold ${
                  i < step
                    ? "bg-primary text-primary-foreground"
                    : i === step
                      ? "bg-white/20"
                      : "bg-black/10 dark:bg-white/10"
                }`}
              >
                {i < step ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          </div>
        ))}
      </nav>

      {/* Progress bar */}
      <div
        className="bg-muted h-1 overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={step + 1}
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
      >
        <div
          className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step title + subtitle */}
      <div className="text-center transition-opacity duration-300">
        <h2 className="text-lg font-bold">{STEPS[step]?.title}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{STEPS[step]?.subtitle}</p>
      </div>

      {/* Step content with fade transition */}
      <div key={step} className="animate-fade-in">
        {step === 0 && (
          <StepPair
            pair={pair}
            onSelect={setPair}
            search={search}
            onSearch={setSearch}
            onAiQuickStart={handleAiQuickStart}
          />
        )}
        {step === 1 && (
          <StepDirection
            pair={pair}
            direction={direction}
            onSelect={setDirection}
            aiSuggestion={
              aiSuggestion
                ? {
                    direction: aiSuggestion.direction,
                    confidence: aiSuggestion.confidence,
                    reasoning: aiSuggestion.reasoning,
                    factors: aiSuggestion.factors,
                  }
                : undefined
            }
          />
        )}
        {step === 2 && (
          <StepStrategy
            preset={preset}
            onSelect={setPreset}
            aiSuggestedStrategy={aiSuggestion?.suggestedStrategy}
            aiStrategyReason={aiSuggestion?.strategyReason}
          />
        )}
        {step === 3 && (
          <StepEntryTiming
            pair={pair}
            direction={direction ?? "long"}
            entryMode={entryMode}
            entryPrice={entryPrice}
            entryExpireHours={entryExpireHours}
            onEntryModeChange={setEntryMode}
            onEntryPriceChange={setEntryPrice}
            onEntryExpireHoursChange={setEntryExpireHours}
          />
        )}
        {step === 4 && (
          <StepReview
            pair={pairLabel}
            direction={direction!}
            preset={preset}
            entryMode={entryMode}
            entryPrice={entryPrice}
            entryExpireHours={entryExpireHours}
            submitting={submitting}
            onSubmit={handleSubmit}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="ghost"
          size="lg"
          onClick={() => setStep(step - 1)}
          disabled={step === 0}
          className="min-h-[48px] gap-2 px-5"
        >
          <ChevronLeft className="size-4" /> Back
        </Button>
        {step < 4 ? (
          <Button
            size="lg"
            onClick={() => setStep(step + 1)}
            disabled={!canNext}
            className="min-h-[48px] gap-2 px-6"
          >
            Next <ChevronRight className="size-4" />
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={submitting}
            className="min-h-[48px] gap-2 px-6"
          >
            {submitting ? "Activating\u2026" : "Activate Trade Plan"} <Zap className="size-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
