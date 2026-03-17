"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Check, Zap } from "lucide-react"
import type { SmartFlowPreset } from "@fxflow/types"
import { PRESET_INFO } from "./trade-builder-presets"
import { StepPair, StepDirection, StepStrategy, StepReview } from "./trade-builder-steps"

// ─── Step labels ────────────────────────────────────────────────────────

const STEPS = ["Pick a Pair", "Pick Direction", "Choose Strategy", "Review & Confirm"] as const

// ─── Main component ─────────────────────────────────────────────────────

interface TradeBuilderProps {
  onComplete?: () => void
}

export function TradeBuilder({ onComplete }: TradeBuilderProps) {
  const [step, setStep] = useState(0)
  const [pair, setPair] = useState("")
  const [direction, setDirection] = useState<"long" | "short" | null>(null)
  const [preset, setPreset] = useState<Exclude<SmartFlowPreset, "custom">>("steady_growth")
  const [search, setSearch] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const canNext =
    (step === 0 && pair !== "") ||
    (step === 1 && direction !== null) ||
    (step === 2 && preset !== null) ||
    step === 3

  const pairLabel = pair.replace("_", "/")

  async function handleSubmit() {
    if (!pair || !direction) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/smart-flow/configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instrument: pair,
          name: `${pairLabel} ${direction === "long" ? "Buy" : "Sell"} — ${PRESET_INFO[preset].label}`,
          direction,
          preset,
          isActive: true,
          entryMode: "market",
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
      const json = (await res.json()) as { ok: boolean; error?: string }
      if (!json.ok) {
        toast.error(json.error ?? "Failed to create config")
        return
      }
      toast.success(
        "Configuration saved! Trade placement will be available once the daemon endpoints are connected.",
      )
      window.dispatchEvent(new Event("smart-flow-updated"))
      onComplete?.()
    } catch {
      toast.error("Network error — could not save config")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Step indicator */}
      <nav aria-label="Wizard progress" className="flex items-center justify-center gap-2">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => i < step && setStep(i)}
            disabled={i > step}
            aria-current={i === step ? "step" : undefined}
            className={`flex min-h-[44px] items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-colors ${
              i === step
                ? "bg-primary text-primary-foreground"
                : i < step
                  ? "bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            <span className="flex size-5 items-center justify-center rounded-full bg-black/10 text-[10px]">
              {i < step ? <Check className="size-3" /> : i + 1}
            </span>
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </nav>

      {/* Step content */}
      {step === 0 && (
        <StepPair pair={pair} onSelect={setPair} search={search} onSearch={setSearch} />
      )}
      {step === 1 && <StepDirection direction={direction} onSelect={setDirection} />}
      {step === 2 && <StepStrategy preset={preset} onSelect={setPreset} />}
      {step === 3 && (
        <StepReview
          pair={pairLabel}
          direction={direction!}
          preset={preset}
          submitting={submitting}
          onSubmit={handleSubmit}
        />
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStep(step - 1)}
          disabled={step === 0}
          className="min-h-[44px] gap-1.5"
        >
          <ChevronLeft className="size-4" /> Back
        </Button>
        {step < 3 ? (
          <Button
            size="sm"
            onClick={() => setStep(step + 1)}
            disabled={!canNext}
            className="min-h-[44px] gap-1.5"
          >
            Next <ChevronRight className="size-4" />
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={submitting}
            className="min-h-[44px] gap-1.5"
          >
            {submitting ? "Saving…" : "Start SmartFlow Trade"} <Zap className="size-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
