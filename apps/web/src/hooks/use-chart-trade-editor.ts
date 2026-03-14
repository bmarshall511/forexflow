"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { getDecimalPlaces, priceToPips, getPipSize } from "@fxflow/shared"

interface UseChartTradeEditorOptions {
  instrument: string
  direction: "long" | "short"
  entryPrice: number
  savedSL: number | null
  savedTP: number | null
  /** Performs the save action — return true on success. */
  saveFn: (stopLoss: number | null, takeProfit: number | null) => Promise<boolean>
  /** Called after a successful save — use to refetch trade detail, events, etc. */
  onSaved?: () => void
}

export interface UseChartTradeEditorReturn {
  draftSL: number | null
  draftTP: number | null
  setDraftSL: (price: number | null) => void
  setDraftTP: (price: number | null) => void
  isDirty: boolean
  isSLDirty: boolean
  isTPDirty: boolean
  validationErrors: { sl?: string; tp?: string }
  cancel: () => void
  save: () => Promise<void>
  isSaving: boolean
  slPips: number | null
  tpPips: number | null
  /** Default SL price when adding a new SL (entry ± 20 pips) */
  defaultSL: number
  /** Default TP price when adding a new TP (entry ± 20 pips) */
  defaultTP: number
}

export function useChartTradeEditor({
  instrument,
  direction,
  entryPrice,
  savedSL,
  savedTP,
  saveFn,
  onSaved,
}: UseChartTradeEditorOptions): UseChartTradeEditorReturn {
  const [draftSL, setDraftSL] = useState<number | null>(savedSL)
  const [draftTP, setDraftTP] = useState<number | null>(savedTP)
  const [isSaving, setIsSaving] = useState(false)

  const decimals = getDecimalPlaces(instrument)
  const pipSize = getPipSize(instrument)

  // Compute defaults for adding missing SL/TP
  const defaultSL = useMemo(() => {
    const offset = 20 * pipSize
    return Number(
      (direction === "long" ? entryPrice - offset : entryPrice + offset).toFixed(decimals),
    )
  }, [direction, entryPrice, pipSize, decimals])

  const defaultTP = useMemo(() => {
    const offset = 20 * pipSize
    return Number(
      (direction === "long" ? entryPrice + offset : entryPrice - offset).toFixed(decimals),
    )
  }, [direction, entryPrice, pipSize, decimals])

  // Compare prices using fixed precision to avoid floating point issues
  const pricesEqual = useCallback(
    (a: number | null, b: number | null): boolean => {
      if (a === null && b === null) return true
      if (a === null || b === null) return false
      return a.toFixed(decimals) === b.toFixed(decimals)
    },
    [decimals],
  )

  const isSLDirty = !pricesEqual(draftSL, savedSL)
  const isTPDirty = !pricesEqual(draftTP, savedTP)
  const isDirty = isSLDirty || isTPDirty

  // Sync drafts when saved values change (trade switch or server reconcile)
  useEffect(() => {
    setDraftSL(savedSL)
    setDraftTP(savedTP)
  }, [savedSL, savedTP])

  // Validation
  const validationErrors = useMemo(() => {
    const errors: { sl?: string; tp?: string } = {}

    if (draftSL !== null) {
      if (draftSL <= 0) {
        errors.sl = "Must be positive"
      } else if (direction === "long" && draftSL >= entryPrice) {
        errors.sl = "SL must be below entry for long trades"
      } else if (direction === "short" && draftSL <= entryPrice) {
        errors.sl = "SL must be above entry for short trades"
      }
    }

    if (draftTP !== null) {
      if (draftTP <= 0) {
        errors.tp = "Must be positive"
      } else if (direction === "long" && draftTP <= entryPrice) {
        errors.tp = "TP must be above entry for long trades"
      } else if (direction === "short" && draftTP >= entryPrice) {
        errors.tp = "TP must be below entry for short trades"
      }
    }

    if (
      draftSL !== null &&
      draftTP !== null &&
      draftSL.toFixed(decimals) === draftTP.toFixed(decimals)
    ) {
      errors.sl = "SL and TP cannot be the same"
      errors.tp = "SL and TP cannot be the same"
    }

    return errors
  }, [draftSL, draftTP, direction, entryPrice, decimals])

  // Pips distances
  const slPips = useMemo(() => {
    if (draftSL === null) return null
    return priceToPips(instrument, Math.abs(draftSL - entryPrice))
  }, [draftSL, entryPrice, instrument])

  const tpPips = useMemo(() => {
    if (draftTP === null) return null
    return priceToPips(instrument, Math.abs(draftTP - entryPrice))
  }, [draftTP, entryPrice, instrument])

  const cancel = useCallback(() => {
    setDraftSL(savedSL)
    setDraftTP(savedTP)
  }, [savedSL, savedTP])

  const save = useCallback(async () => {
    if (!isDirty || Object.keys(validationErrors).length > 0) return
    setIsSaving(true)
    try {
      const ok = await saveFn(draftSL, draftTP)
      if (ok) {
        onSaved?.()
      }
    } finally {
      setIsSaving(false)
    }
  }, [isDirty, validationErrors, saveFn, draftSL, draftTP, onSaved])

  return {
    draftSL,
    draftTP,
    setDraftSL,
    setDraftTP,
    isDirty,
    isSLDirty,
    isTPDirty,
    validationErrors,
    cancel,
    save,
    isSaving,
    slPips,
    tpPips,
    defaultSL,
    defaultTP,
  }
}
