import { describe, it, expect } from "vitest"
import {
  getPipSize,
  getDecimalPlaces,
  priceToPips,
  calculateDistanceInfo,
  calculateRiskReward,
  formatPips,
  getTradeOutcome,
  formatDuration,
} from "./pip-utils"

describe("getPipSize", () => {
  it("should return 0.01 for JPY pairs", () => {
    expect(getPipSize("USD_JPY")).toBe(0.01)
    expect(getPipSize("EUR_JPY")).toBe(0.01)
    expect(getPipSize("GBP_JPY")).toBe(0.01)
  })

  it("should return 0.0001 for standard pairs", () => {
    expect(getPipSize("EUR_USD")).toBe(0.0001)
    expect(getPipSize("GBP_USD")).toBe(0.0001)
    expect(getPipSize("AUD_USD")).toBe(0.0001)
  })
})

describe("getDecimalPlaces", () => {
  it("should return 3 for JPY pairs", () => {
    expect(getDecimalPlaces("USD_JPY")).toBe(3)
    expect(getDecimalPlaces("NZD_JPY")).toBe(3)
  })

  it("should return 5 for standard pairs", () => {
    expect(getDecimalPlaces("EUR_USD")).toBe(5)
    expect(getDecimalPlaces("USD_CAD")).toBe(5)
  })
})

describe("priceToPips", () => {
  it("should convert price distance to pips for standard pairs", () => {
    expect(priceToPips("EUR_USD", 0.005)).toBeCloseTo(50)
    expect(priceToPips("EUR_USD", 0.0001)).toBeCloseTo(1)
  })

  it("should convert price distance to pips for JPY pairs", () => {
    expect(priceToPips("USD_JPY", 0.5)).toBeCloseTo(50)
    expect(priceToPips("USD_JPY", 0.01)).toBeCloseTo(1)
  })

  it("should return positive value for negative distances", () => {
    expect(priceToPips("EUR_USD", -0.0025)).toBeCloseTo(25)
  })

  it("should return 0 for zero distance", () => {
    expect(priceToPips("EUR_USD", 0)).toBe(0)
  })
})

describe("calculateDistanceInfo", () => {
  it("should calculate pips and percentage for standard pair", () => {
    const result = calculateDistanceInfo("EUR_USD", 1.1, 1.105)
    expect(result.pips).toBeCloseTo(50)
    expect(result.percentage).toBeCloseTo(0.4545, 2)
  })

  it("should calculate pips and percentage for JPY pair", () => {
    const result = calculateDistanceInfo("USD_JPY", 150.0, 150.5)
    expect(result.pips).toBeCloseTo(50)
    expect(result.percentage).toBeCloseTo(0.3333, 2)
  })

  it("should handle downward moves (pips are always positive)", () => {
    const result = calculateDistanceInfo("EUR_USD", 1.105, 1.1)
    expect(result.pips).toBeCloseTo(50)
    expect(result.percentage).toBeCloseTo(0.4525, 2)
  })

  it("should return 0 percentage when fromPrice is 0", () => {
    const result = calculateDistanceInfo("EUR_USD", 0, 1.1)
    expect(result.percentage).toBe(0)
  })
})

describe("calculateRiskReward", () => {
  it("should calculate R:R for a long trade", () => {
    const result = calculateRiskReward("long", 1.1, 1.095, 1.11, "EUR_USD")
    expect(result.riskPips).toBeCloseTo(50)
    expect(result.rewardPips).toBeCloseTo(100)
    expect(result.ratio).toBe("2.0:1")
    expect(result.unprotected).toBe(false)
  })

  it("should calculate R:R for a short trade", () => {
    const result = calculateRiskReward("short", 1.1, 1.105, 1.09, "EUR_USD")
    expect(result.riskPips).toBeCloseTo(50)
    expect(result.rewardPips).toBeCloseTo(100)
    expect(result.ratio).toBe("2.0:1")
    expect(result.unprotected).toBe(false)
  })

  it("should calculate R:R for JPY pair", () => {
    const result = calculateRiskReward("long", 150.0, 149.5, 151.5, "USD_JPY")
    expect(result.riskPips).toBeCloseTo(50)
    expect(result.rewardPips).toBeCloseTo(150)
    expect(result.ratio).toBe("3.0:1")
  })

  it("should return null ratio when SL is missing", () => {
    const result = calculateRiskReward("long", 1.1, null, 1.11, "EUR_USD")
    expect(result.riskPips).toBeNull()
    expect(result.rewardPips).toBeCloseTo(100)
    expect(result.ratio).toBeNull()
    expect(result.unprotected).toBe(false)
  })

  it("should return null ratio when TP is missing", () => {
    const result = calculateRiskReward("long", 1.1, 1.095, null, "EUR_USD")
    expect(result.riskPips).toBeCloseTo(50)
    expect(result.rewardPips).toBeNull()
    expect(result.ratio).toBeNull()
    expect(result.unprotected).toBe(false)
  })

  it("should mark as unprotected when both SL and TP are missing", () => {
    const result = calculateRiskReward("long", 1.1, null, null, "EUR_USD")
    expect(result.riskPips).toBeNull()
    expect(result.rewardPips).toBeNull()
    expect(result.ratio).toBeNull()
    expect(result.unprotected).toBe(true)
  })

  it("should return null ratio when risk is zero", () => {
    const result = calculateRiskReward("long", 1.1, 1.1, 1.11, "EUR_USD")
    expect(result.riskPips).toBeCloseTo(0)
    expect(result.ratio).toBeNull()
  })
})

describe("formatPips", () => {
  it("should format pips to one decimal place", () => {
    expect(formatPips(45.23)).toBe("45.2")
    expect(formatPips(0)).toBe("0.0")
    expect(formatPips(100)).toBe("100.0")
  })
})

describe("getTradeOutcome", () => {
  it("should return win for positive P&L", () => {
    expect(getTradeOutcome(100)).toBe("win")
    expect(getTradeOutcome(0.01)).toBe("win")
  })

  it("should return loss for negative P&L", () => {
    expect(getTradeOutcome(-50)).toBe("loss")
    expect(getTradeOutcome(-0.01)).toBe("loss")
  })

  it("should return breakeven for zero P&L", () => {
    expect(getTradeOutcome(0)).toBe("breakeven")
  })
})

describe("formatDuration", () => {
  it("should format seconds", () => {
    expect(formatDuration(5000)).toBe("5s")
    expect(formatDuration(45000)).toBe("45s")
  })

  it("should format minutes and seconds", () => {
    expect(formatDuration(90_000)).toBe("1m 30s")
    expect(formatDuration(300_000)).toBe("5m 0s")
  })

  it("should format hours and minutes", () => {
    expect(formatDuration(3_660_000)).toBe("1h 1m")
    expect(formatDuration(7_200_000)).toBe("2h 0m")
  })

  it("should format days and hours", () => {
    expect(formatDuration(90_000_000)).toBe("1d 1h")
    expect(formatDuration(172_800_000)).toBe("2d 0h")
  })

  it("should format zero", () => {
    expect(formatDuration(0)).toBe("0s")
  })
})
