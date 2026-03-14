"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import type { PlaceableOrderType, TradeDirection, Timeframe } from "@fxflow/types"
import { getDecimalPlaces, getPipSize, priceToPips, calculateRiskReward } from "@fxflow/shared"

export type UnitsMode = "units" | "lots" | "risk"

interface UseOrderTicketOptions {
  instrument: string
  direction: TradeDirection
  bid: number | null
  ask: number | null
  accountBalance: number
  accountCurrency: string
  initialTimeframe?: Timeframe | null
}

export interface UseOrderTicketReturn {
  // Order type
  orderType: PlaceableOrderType
  setOrderType: (type: PlaceableOrderType) => void

  // Entry price (for LIMIT only)
  entryPrice: number | null
  setEntryPrice: (price: number | null) => void

  // Units
  units: number
  setUnits: (units: number) => void
  unitsMode: UnitsMode
  setUnitsMode: (mode: UnitsMode) => void
  riskPercent: number
  setRiskPercent: (pct: number) => void

  // SL / TP
  stopLoss: number | null
  setStopLoss: (sl: number | null) => void
  takeProfit: number | null
  setTakeProfit: (tp: number | null) => void
  slEnabled: boolean
  setSlEnabled: (enabled: boolean) => void
  tpEnabled: boolean
  setTpEnabled: (enabled: boolean) => void

  // Timeframe
  timeframe: Timeframe | null
  setTimeframe: (tf: Timeframe | null) => void

  // Notes
  notes: string
  setNotes: (n: string) => void

  // Tags
  selectedTagIds: string[]
  addTag: (tagId: string) => void
  removeTag: (tagId: string) => void

  // Computed
  slPips: number | null
  tpPips: number | null
  riskReward: ReturnType<typeof calculateRiskReward> | null
  validationErrors: Record<string, string>
  isValid: boolean
  effectiveEntryPrice: number | null
  spreadPips: number | null

  // Defaults
  defaultSL: number
  defaultTP: number
  decimals: number
  pipSize: number

  // Actions
  reset: () => void
}

const LOT_UNITS = { micro: 1000, mini: 10000, standard: 100000 } as const

export function useOrderTicket({
  instrument,
  direction,
  bid,
  ask,
  accountBalance,
  initialTimeframe = null,
}: UseOrderTicketOptions): UseOrderTicketReturn {
  const decimals = getDecimalPlaces(instrument)
  const pipSize = getPipSize(instrument)

  const [orderType, setOrderType] = useState<PlaceableOrderType>("LIMIT")
  const [entryPrice, setEntryPrice] = useState<number | null>(null)
  const [units, setUnits] = useState(1000)
  const [unitsMode, setUnitsMode] = useState<UnitsMode>("risk")
  const [riskPercent, setRiskPercent] = useState(1)
  const [stopLoss, setStopLoss] = useState<number | null>(null)
  const [takeProfit, setTakeProfit] = useState<number | null>(null)
  const [slEnabled, setSlEnabled] = useState(true)
  const [tpEnabled, setTpEnabled] = useState(true)
  const [timeframe, setTimeframe] = useState<Timeframe | null>(initialTimeframe)

  // Sync timeframe when initialTimeframe prop changes (e.g. order ticket opens)
  useEffect(() => {
    setTimeframe(initialTimeframe)
  }, [initialTimeframe])
  const [notes, setNotes] = useState("")
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])

  // Track whether user has manually edited SL/TP so auto-fill doesn't overwrite
  const slManuallySet = useRef(false)
  const tpManuallySet = useRef(false)

  // Wrapped setters that mark manual edits
  const handleSetStopLoss = useCallback((val: number | null) => {
    slManuallySet.current = true
    setStopLoss(val)
  }, [])

  const handleSetTakeProfit = useCallback((val: number | null) => {
    tpManuallySet.current = true
    setTakeProfit(val)
  }, [])

  // Effective entry price: for market → ask (buy) or bid (sell); for limit → user's price
  const effectiveEntryPrice = useMemo(() => {
    if (orderType === "LIMIT") return entryPrice
    return direction === "long" ? ask : bid
  }, [orderType, entryPrice, direction, ask, bid])

  // Default SL/TP at ±20 pips from effective entry
  const defaultSL = useMemo(() => {
    if (!effectiveEntryPrice) return 0
    const offset = 20 * pipSize
    return Number(
      (direction === "long" ? effectiveEntryPrice - offset : effectiveEntryPrice + offset).toFixed(
        decimals,
      ),
    )
  }, [direction, effectiveEntryPrice, pipSize, decimals])

  const defaultTP = useMemo(() => {
    if (!effectiveEntryPrice) return 0
    const offset = 20 * pipSize
    return Number(
      (direction === "long" ? effectiveEntryPrice + offset : effectiveEntryPrice - offset).toFixed(
        decimals,
      ),
    )
  }, [direction, effectiveEntryPrice, pipSize, decimals])

  // Auto-fill SL/TP from defaults when effectiveEntryPrice becomes available
  // and user hasn't manually edited them yet
  useEffect(() => {
    if (!effectiveEntryPrice || defaultSL === 0) return
    if (slEnabled && stopLoss === null && !slManuallySet.current) {
      setStopLoss(defaultSL)
    }
    if (tpEnabled && takeProfit === null && !tpManuallySet.current) {
      setTakeProfit(defaultTP)
    }
  }, [effectiveEntryPrice, defaultSL, defaultTP, slEnabled, tpEnabled, stopLoss, takeProfit])

  // SL/TP pip distances
  const slPips = useMemo(() => {
    if (!slEnabled || stopLoss === null || !effectiveEntryPrice) return null
    return priceToPips(instrument, Math.abs(stopLoss - effectiveEntryPrice))
  }, [slEnabled, stopLoss, effectiveEntryPrice, instrument])

  const tpPips = useMemo(() => {
    if (!tpEnabled || takeProfit === null || !effectiveEntryPrice) return null
    return priceToPips(instrument, Math.abs(takeProfit - effectiveEntryPrice))
  }, [tpEnabled, takeProfit, effectiveEntryPrice, instrument])

  // Risk-based units calculation
  const riskBasedUnits = useMemo(() => {
    if (!slEnabled || slPips === null || slPips === 0 || !effectiveEntryPrice) return null
    // Approximate pip value: for USD-quoted pairs, pip value per unit ≈ pipSize
    // For non-USD pairs, this is approximate (would need conversion rate for precision)
    const riskAmount = accountBalance * (riskPercent / 100)
    const slDistance = slPips * pipSize
    if (slDistance === 0) return null
    return Math.round(riskAmount / slDistance)
  }, [slEnabled, slPips, effectiveEntryPrice, accountBalance, riskPercent, pipSize])

  // Auto-set units when in risk mode
  const effectiveUnits = unitsMode === "risk" && riskBasedUnits !== null ? riskBasedUnits : units

  // Spread
  const spreadPips = useMemo(() => {
    if (bid === null || ask === null) return null
    return priceToPips(instrument, ask - bid)
  }, [bid, ask, instrument])

  // Risk/Reward
  const riskReward = useMemo(() => {
    if (
      !effectiveEntryPrice ||
      !slEnabled ||
      !tpEnabled ||
      stopLoss === null ||
      takeProfit === null
    )
      return null
    return calculateRiskReward(direction, effectiveEntryPrice, stopLoss, takeProfit, instrument)
  }, [direction, effectiveEntryPrice, slEnabled, tpEnabled, stopLoss, takeProfit, instrument])

  // Validation
  const validationErrors = useMemo(() => {
    const errors: Record<string, string> = {}

    if (effectiveUnits <= 0) {
      errors.units = "Units must be positive"
    }

    if (orderType === "LIMIT") {
      if (entryPrice === null) {
        errors.entryPrice = "Entry price is required"
      } else if (entryPrice <= 0) {
        errors.entryPrice = "Must be positive"
      } else if (direction === "long" && ask !== null && entryPrice >= ask) {
        errors.entryPrice = "Limit buy must be below current ask"
      } else if (direction === "short" && bid !== null && entryPrice <= bid) {
        errors.entryPrice = "Limit sell must be above current bid"
      }
    }

    if (slEnabled && stopLoss !== null && effectiveEntryPrice) {
      if (stopLoss <= 0) {
        errors.stopLoss = "Must be positive"
      } else if (direction === "long" && stopLoss >= effectiveEntryPrice) {
        errors.stopLoss = "SL must be below entry for buy"
      } else if (direction === "short" && stopLoss <= effectiveEntryPrice) {
        errors.stopLoss = "SL must be above entry for sell"
      }
    }

    if (tpEnabled && takeProfit !== null && effectiveEntryPrice) {
      if (takeProfit <= 0) {
        errors.takeProfit = "Must be positive"
      } else if (direction === "long" && takeProfit <= effectiveEntryPrice) {
        errors.takeProfit = "TP must be above entry for buy"
      } else if (direction === "short" && takeProfit >= effectiveEntryPrice) {
        errors.takeProfit = "TP must be below entry for sell"
      }
    }

    if (unitsMode === "risk" && !slEnabled) {
      errors.units = "Risk mode requires SL to be set"
    }

    return errors
  }, [
    effectiveUnits,
    orderType,
    entryPrice,
    direction,
    ask,
    bid,
    slEnabled,
    stopLoss,
    tpEnabled,
    takeProfit,
    effectiveEntryPrice,
    unitsMode,
  ])

  const isValid = Object.keys(validationErrors).length === 0 && effectiveUnits > 0

  // Handle SL/TP toggle
  const handleSetSlEnabled = useCallback(
    (enabled: boolean) => {
      setSlEnabled(enabled)
      if (enabled && stopLoss === null) {
        setStopLoss(defaultSL)
      }
      if (!enabled) {
        setStopLoss(null)
        slManuallySet.current = false
      }
    },
    [stopLoss, defaultSL],
  )

  const handleSetTpEnabled = useCallback(
    (enabled: boolean) => {
      setTpEnabled(enabled)
      if (enabled && takeProfit === null) {
        setTakeProfit(defaultTP)
      }
      if (!enabled) {
        setTakeProfit(null)
        tpManuallySet.current = false
      }
    },
    [takeProfit, defaultTP],
  )

  // Tag handlers
  const addTag = useCallback((tagId: string) => {
    setSelectedTagIds((prev) => (prev.includes(tagId) ? prev : [...prev, tagId]))
  }, [])

  const removeTag = useCallback((tagId: string) => {
    setSelectedTagIds((prev) => prev.filter((id) => id !== tagId))
  }, [])

  const reset = useCallback(() => {
    setOrderType("LIMIT")
    setEntryPrice(null)
    setUnits(1000)
    setUnitsMode("risk")
    setRiskPercent(1)
    setStopLoss(null)
    setTakeProfit(null)
    setSlEnabled(true)
    setTpEnabled(true)
    setTimeframe(initialTimeframe)
    setNotes("")
    setSelectedTagIds([])
    slManuallySet.current = false
    tpManuallySet.current = false
  }, [initialTimeframe])

  return {
    orderType,
    setOrderType,
    entryPrice,
    setEntryPrice,
    units: effectiveUnits,
    setUnits,
    unitsMode,
    setUnitsMode,
    riskPercent,
    setRiskPercent,
    stopLoss: slEnabled ? stopLoss : null,
    setStopLoss: handleSetStopLoss,
    takeProfit: tpEnabled ? takeProfit : null,
    setTakeProfit: handleSetTakeProfit,
    slEnabled,
    setSlEnabled: handleSetSlEnabled,
    tpEnabled,
    setTpEnabled: handleSetTpEnabled,
    timeframe,
    setTimeframe,
    notes,
    setNotes,
    selectedTagIds,
    addTag,
    removeTag,
    slPips,
    tpPips,
    riskReward,
    validationErrors,
    isValid,
    effectiveEntryPrice,
    spreadPips,
    defaultSL,
    defaultTP,
    decimals,
    pipSize,
    reset,
  }
}

export { LOT_UNITS }
