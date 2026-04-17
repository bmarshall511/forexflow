"use client"

/**
 * AI reliability & budget settings — exposes the v2 lifecycle fields on
 * `AiSettings` that don't live inside the `autoAnalysisJson` blob:
 *
 *  - `autoRetryInterrupted`: auto-retry daemon-restart interruptions
 *  - `monthlyBudgetCapUsd`: hard cap enforced daemon-side
 *  - `maxReconciliationOps`: guardrail for re-run structured diff execution
 *
 * Kept as a dedicated sub-component because the parent
 * `ai-settings-page.tsx` is already well above the 150 LOC component limit;
 * splitting reliability settings into their own file is both a size win
 * and a clearer conceptual grouping for users.
 */

import { useState } from "react"
import type { AiSettingsData } from "@fxflow/types"
import { toast } from "sonner"
import { ToggleSwitch } from "@/components/ui/toggle-switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SectionCard } from "@/components/ui/section-card"
import { Shield } from "lucide-react"

interface AiReliabilitySectionProps {
  settings: AiSettingsData
  onRefetch: () => void
}

export function AiReliabilitySection({ settings, onRefetch }: AiReliabilitySectionProps) {
  // Local draft state for debounced-save fields (budget + max ops). Toggles
  // save immediately since they're single boolean atoms.
  const [budgetDraft, setBudgetDraft] = useState(
    settings.monthlyBudgetCapUsd !== null ? String(settings.monthlyBudgetCapUsd) : "",
  )
  const [maxOpsDraft, setMaxOpsDraft] = useState(String(settings.maxReconciliationOps))
  const [isSaving, setIsSaving] = useState(false)

  async function save(body: Record<string, unknown>) {
    setIsSaving(true)
    try {
      const res = await fetch("/api/ai/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as { ok: boolean; error?: string }
      if (!json.ok) throw new Error(json.error ?? "Failed to save")
      onRefetch()
    } catch (err) {
      toast.error(`Save failed: ${(err as Error).message}`)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleAutoRetryChange(next: boolean) {
    await save({ autoRetryInterrupted: next })
    if (next) toast.success("Auto-retry enabled")
  }

  async function handleBudgetBlur() {
    const trimmed = budgetDraft.trim()
    if (trimmed === "") {
      if (settings.monthlyBudgetCapUsd !== null) {
        await save({ monthlyBudgetCapUsd: null })
        toast.success("Budget cap cleared")
      }
      return
    }
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Budget cap must be a positive number")
      setBudgetDraft(
        settings.monthlyBudgetCapUsd !== null ? String(settings.monthlyBudgetCapUsd) : "",
      )
      return
    }
    if (parsed === settings.monthlyBudgetCapUsd) return
    await save({ monthlyBudgetCapUsd: parsed })
    toast.success(`Budget cap set to $${parsed.toFixed(2)}/mo`)
  }

  async function handleMaxOpsBlur() {
    const parsed = parseInt(maxOpsDraft, 10)
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 100) {
      toast.error("Max reconciliation ops must be between 1 and 100")
      setMaxOpsDraft(String(settings.maxReconciliationOps))
      return
    }
    if (parsed === settings.maxReconciliationOps) return
    await save({ maxReconciliationOps: parsed })
  }

  return (
    <SectionCard
      icon={Shield}
      title="Reliability & Budget"
      helper="Recovery, cost caps, and reconciliation guardrails"
    >
      <div className="space-y-4">
        {/* Auto-retry interrupted */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-0.5">
            <Label htmlFor="auto-retry-interrupted" className="text-sm">
              Auto-retry interrupted analyses
            </Label>
            <p className="text-muted-foreground text-xs">
              When an analysis is interrupted (daemon restart, stream stall), automatically retry
              once after a 3-second cancelable countdown. Off by default — you stay in control of
              retries.
            </p>
          </div>
          <ToggleSwitch
            checked={settings.autoRetryInterrupted}
            onChange={(v: boolean) => void handleAutoRetryChange(v)}
            disabled={isSaving}
          />
        </div>

        {/* Monthly budget cap */}
        <div className="space-y-1.5">
          <Label htmlFor="monthly-budget-cap" className="text-sm">
            Monthly budget cap (USD)
          </Label>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">$</span>
            <Input
              id="monthly-budget-cap"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.50"
              placeholder="No cap"
              value={budgetDraft}
              onChange={(e) => setBudgetDraft(e.target.value)}
              onBlur={() => void handleBudgetBlur()}
              disabled={isSaving}
              className="max-w-40"
              aria-describedby="budget-cap-help"
            />
            <span className="text-muted-foreground text-xs">/ month</span>
          </div>
          <p id="budget-cap-help" className="text-muted-foreground text-xs">
            The daemon hard-stops new analyses when month-to-date AI spend reaches the cap. Leave
            empty to disable. Cap resets automatically at the start of each calendar month.
          </p>
        </div>

        {/* Max reconciliation ops */}
        <div className="space-y-1.5">
          <Label htmlFor="max-reconciliation-ops" className="text-sm">
            Max reconciliation ops per re-run
          </Label>
          <Input
            id="max-reconciliation-ops"
            type="number"
            inputMode="numeric"
            min="1"
            max="100"
            step="1"
            value={maxOpsDraft}
            onChange={(e) => setMaxOpsDraft(e.target.value)}
            onBlur={() => void handleMaxOpsBlur()}
            disabled={isSaving}
            className="max-w-32"
            aria-describedby="max-ops-help"
          />
          <p id="max-ops-help" className="text-muted-foreground text-xs">
            When a re-analysis proposes structured changes to existing conditions (add / update /
            remove), this caps how many ops the daemon will execute in a single run. Prevents a
            malformed AI response from rewriting every rule on a trade. Default: 20.
          </p>
        </div>
      </div>
    </SectionCard>
  )
}
