"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import type { ResetModule, ResetResult } from "@fxflow/db"
import { useAppReset } from "@/hooks/use-app-reset"
import { ResetLevelSelector, type ResetLevel } from "./reset-level-selector"
import { ModuleSelector } from "./module-selector"
import { PreflightChecks } from "./preflight-checks"
import { ResetSummary } from "./reset-summary"
import { ResetConfirmation } from "./reset-confirmation"
import { ResetProgress } from "./reset-progress"

type WizardStep = "level" | "modules" | "preflight" | "summary" | "confirm" | "progress"

export function ResetWizard() {
  const router = useRouter()
  const {
    preflight,
    isLoadingPreflight,
    fetchPreflight,
    isExecuting,
    executeError,
    executeReset,
    executeFreshInstall,
  } = useAppReset()

  const [step, setStep] = useState<WizardStep>("level")
  const [level, setLevel] = useState<ResetLevel | null>(null)
  const [selectedModules, setSelectedModules] = useState<ResetModule[]>([])
  const [result, setResult] = useState<ResetResult | null>(null)
  const [freshInstallDone, setFreshInstallDone] = useState(false)

  // Fetch preflight data when entering the preflight step
  useEffect(() => {
    if (step === "preflight" && !preflight && !isLoadingPreflight) {
      fetchPreflight()
    }
  }, [step, preflight, isLoadingPreflight, fetchPreflight])

  const handleLevelSelect = useCallback((selected: ResetLevel) => {
    setLevel(selected)
    setStep(selected === "selective" ? "modules" : "preflight")
  }, [])

  const handleModulesNext = useCallback((modules: ResetModule[]) => {
    setSelectedModules(modules)
    setStep("preflight")
  }, [])

  const handleRefresh = useCallback(async () => {
    await fetchPreflight()
  }, [fetchPreflight])

  const handleConfirm = useCallback(async () => {
    setStep("progress")

    if (level === "fresh_install") {
      const ok = await executeFreshInstall()
      setFreshInstallDone(ok)
      return
    }

    const apiLevel =
      level === "selective" ? "selective" : level === "trading_data" ? "trading_data" : "factory"

    const res = await executeReset(apiLevel, level === "selective" ? selectedModules : undefined)
    setResult(res)
  }, [level, selectedModules, executeReset, executeFreshInstall])

  const handleDone = useCallback(() => {
    router.push("/settings/oanda")
  }, [router])

  const handleBack = useCallback((target: WizardStep) => {
    setStep(target)
  }, [])

  // Step breadcrumb for screen readers
  const stepLabel = {
    level: "Step 1: Choose reset level",
    modules: "Step 2: Select modules",
    preflight: level === "selective" ? "Step 3: Pre-flight checks" : "Step 2: Pre-flight checks",
    summary: "Summary",
    confirm: "Confirmation",
    progress: "Progress",
  }

  return (
    <div className="w-full" role="region" aria-label={stepLabel[step]}>
      {step === "level" && <ResetLevelSelector onSelect={handleLevelSelect} />}

      {step === "modules" && preflight && (
        <ModuleSelector
          moduleCounts={preflight.moduleCounts}
          onNext={handleModulesNext}
          onBack={() => handleBack("level")}
        />
      )}

      {step === "modules" && !preflight && (
        <ModuleSelector
          moduleCounts={{
            trading_history: 0,
            tv_alerts: 0,
            ai_analysis: 0,
            ai_trader: 0,
            trade_finder: 0,
            technical_data: 0,
            notifications: 0,
            chart_state: 0,
          }}
          onNext={handleModulesNext}
          onBack={() => handleBack("level")}
        />
      )}

      {step === "preflight" && preflight && level && (
        <PreflightChecks
          preflight={preflight}
          level={level}
          onNext={() => setStep("summary")}
          onBack={() => handleBack(level === "selective" ? "modules" : "level")}
          onRefresh={handleRefresh}
        />
      )}

      {step === "preflight" && isLoadingPreflight && (
        <div className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
          <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Loading pre-flight status...
        </div>
      )}

      {step === "summary" && preflight && level && (
        <ResetSummary
          level={level}
          selectedModules={selectedModules}
          preflight={preflight}
          onNext={() => setStep("confirm")}
          onBack={() => handleBack("preflight")}
        />
      )}

      {step === "confirm" && level && (
        <ResetConfirmation
          level={level}
          onConfirm={handleConfirm}
          onBack={() => handleBack("summary")}
        />
      )}

      {step === "progress" && (
        <ResetProgress
          isExecuting={isExecuting}
          result={result}
          freshInstallDone={freshInstallDone}
          executeError={executeError}
          onDone={handleDone}
        />
      )}
    </div>
  )
}
