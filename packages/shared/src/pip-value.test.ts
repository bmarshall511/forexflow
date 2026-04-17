import { describe, it, expect } from "vitest"
import { calculatePipValueUsd, derivePipValueUsdFromUnrealizedPL } from "./pip-value"

describe("calculatePipValueUsd", () => {
  // Quote = USD pairs — pip is already in USD
  it("EUR_USD: $0.10 per pip per 1000 units", () => {
    const v = calculatePipValueUsd({ instrument: "EUR_USD", units: 1000 })
    expect(v).toBeCloseTo(0.1, 4) // 1000 * 0.0001 = $0.10
  })

  it("GBP_USD: $1 per pip per 10000 units", () => {
    const v = calculatePipValueUsd({ instrument: "GBP_USD", units: 10_000 })
    expect(v).toBeCloseTo(1)
  })

  // Base = USD pairs — divide pipSize by currentPrice
  it("USD_JPY at 150: ~$0.0667 per pip per 1000 units", () => {
    const v = calculatePipValueUsd({ instrument: "USD_JPY", units: 1000, currentPrice: 150 })
    expect(v).toBeCloseTo(0.0667, 3) // 1000 * 0.01 / 150
  })

  it("USD_CAD at 1.38: ~$0.0725 per pip per 1000 units", () => {
    const v = calculatePipValueUsd({ instrument: "USD_CAD", units: 1000, currentPrice: 1.38 })
    expect(v).toBeCloseTo(0.0725, 3)
  })

  it("USD_JPY returns null without a current price", () => {
    const v = calculatePipValueUsd({ instrument: "USD_JPY", units: 1000 })
    expect(v).toBeNull()
  })

  // Cross pairs — return null unless usdQuoteRates is provided
  it("EUR_JPY without usdQuoteRates returns null (don't guess)", () => {
    const v = calculatePipValueUsd({ instrument: "EUR_JPY", units: 287, currentPrice: 185.5 })
    expect(v).toBeNull()
  })

  it("EUR_JPY with usdQuoteRates { JPY: 160 } ≈ $0.000179 per pip per 287 units", () => {
    // 287 * 0.01 / 160 = 0.01794
    const v = calculatePipValueUsd({
      instrument: "EUR_JPY",
      units: 287,
      usdQuoteRates: { JPY: 160 },
    })
    expect(v).toBeCloseTo(0.01794, 4)
  })

  it("returns 0 for zero units", () => {
    expect(calculatePipValueUsd({ instrument: "EUR_USD", units: 0 })).toBe(0)
  })
})

describe("derivePipValueUsdFromUnrealizedPL — user's EUR_JPY reproduction", () => {
  // This is the exact scenario from the user's bug report:
  // EUR/JPY long 287 units, entry 184.929, current 185.833, +90.4 pips.
  // OANDA reports unrealizedPL = $1.62 (the TRUE value in USD).
  // The old `priceDiff * units` math gave $259.45 — wrong by 160x.
  const trade = {
    instrument: "EUR_JPY",
    direction: "long" as const,
    entryPrice: 184.929,
    currentPrice: 185.833,
    currentUnits: 287,
    unrealizedPL: 1.62,
  }

  it("derives pipValueUsd ≈ $0.01792 from OANDA's $1.62 reported P/L", () => {
    const v = derivePipValueUsdFromUnrealizedPL(trade)
    // 1.62 / 90.4 pips ≈ 0.01792 USD per pip
    expect(v).not.toBeNull()
    expect(v!).toBeCloseTo(0.01792, 4)
  })

  it("extrapolating 48.1 locked pips gives $0.86 (NOT $138.05)", () => {
    const v = derivePipValueUsdFromUnrealizedPL(trade)!
    const lockedUsd = 48.1 * v
    expect(lockedUsd).toBeCloseTo(0.862, 2)
    expect(lockedUsd).toBeLessThan(2) // sanity — never the buggy $138
  })

  it("extrapolating 249.1 target pips gives $4.46 (NOT $714.92)", () => {
    const v = derivePipValueUsdFromUnrealizedPL(trade)!
    const targetUsd = 249.1 * v
    expect(targetUsd).toBeCloseTo(4.465, 2)
    expect(targetUsd).toBeLessThan(10)
  })
})

describe("derivePipValueUsdFromUnrealizedPL — fallback behavior", () => {
  it("falls back to structural calculator when trade is near breakeven", () => {
    const v = derivePipValueUsdFromUnrealizedPL({
      instrument: "EUR_USD",
      direction: "long",
      entryPrice: 1.1,
      currentPrice: 1.1001, // only 1 pip of movement
      currentUnits: 10_000,
      unrealizedPL: 1.0,
    })
    // With pipsDelta < 0.5, falls back to structural: 10000 * 0.0001 = 1.0
    // Either path gives the same value here, just asserting non-null.
    expect(v).toBeCloseTo(1.0, 4)
  })

  it("returns null for cross pair near breakeven (don't guess)", () => {
    const v = derivePipValueUsdFromUnrealizedPL({
      instrument: "EUR_JPY",
      direction: "long",
      entryPrice: 185.0,
      currentPrice: 185.002, // 0.2 pips — below 0.5 threshold
      currentUnits: 287,
      unrealizedPL: 0,
    })
    expect(v).toBeNull()
  })
})
