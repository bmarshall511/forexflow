import { describe, it, expect } from "vitest"
import {
  computeProfitPips,
  computeRiskPips,
  isBetterSL,
  evaluateBreakeven,
  evaluateTrailing,
  evaluateTimeExit,
} from "./index"

describe("computeProfitPips", () => {
  it("long trade in profit", () => {
    const pips = computeProfitPips({
      instrument: "EUR_USD",
      direction: "long",
      entryPrice: 1.1,
      currentPrice: 1.102,
    })
    expect(pips).toBeCloseTo(20, 0)
  })

  it("short trade in profit", () => {
    const pips = computeProfitPips({
      instrument: "EUR_USD",
      direction: "short",
      entryPrice: 1.1,
      currentPrice: 1.0985,
    })
    expect(pips).toBeCloseTo(15, 0)
  })

  it("JPY pair uses 0.01 pip size", () => {
    const pips = computeProfitPips({
      instrument: "USD_JPY",
      direction: "long",
      entryPrice: 150,
      currentPrice: 150.2,
    })
    expect(pips).toBeCloseTo(20, 0)
  })

  it("loss is negative", () => {
    const pips = computeProfitPips({
      instrument: "EUR_USD",
      direction: "long",
      entryPrice: 1.1,
      currentPrice: 1.0985,
    })
    expect(pips).toBeCloseTo(-15, 0)
  })
})

describe("computeRiskPips", () => {
  it("long trade", () => {
    expect(
      computeRiskPips({
        instrument: "EUR_USD",
        direction: "long",
        entryPrice: 1.1,
        stopLoss: 1.0975,
      }),
    ).toBeCloseTo(25, 0)
  })

  it("short trade", () => {
    expect(
      computeRiskPips({
        instrument: "EUR_USD",
        direction: "short",
        entryPrice: 1.1,
        stopLoss: 1.103,
      }),
    ).toBeCloseTo(30, 0)
  })

  it("returns 0 when SL is on the wrong side of entry", () => {
    expect(
      computeRiskPips({
        instrument: "EUR_USD",
        direction: "long",
        entryPrice: 1.1,
        stopLoss: 1.105, // SL above entry for a long — invalid
      }),
    ).toBe(0)
  })
})

describe("isBetterSL", () => {
  it("long: higher SL is better", () => {
    expect(isBetterSL("long", 1.09, 1.095)).toBe(true)
    expect(isBetterSL("long", 1.095, 1.09)).toBe(false)
    expect(isBetterSL("long", 1.09, 1.09)).toBe(false)
  })

  it("short: lower SL is better", () => {
    expect(isBetterSL("short", 1.11, 1.105)).toBe(true)
    expect(isBetterSL("short", 1.105, 1.11)).toBe(false)
  })

  it("null current SL accepts any proposed SL", () => {
    expect(isBetterSL("long", null, 1.09)).toBe(true)
    expect(isBetterSL("short", null, 1.11)).toBe(true)
  })
})

describe("evaluateBreakeven", () => {
  const base = {
    instrument: "EUR_USD",
    direction: "long" as const,
    entryPrice: 1.1,
    currentSL: 1.0975,
    bufferPips: 2,
    alreadyApplied: false,
  }

  it("fires when profit crosses threshold", () => {
    const d = evaluateBreakeven({
      ...base,
      profitPips: 30,
      thresholdPips: 25,
    })
    expect(d.shouldFire).toBe(true)
    expect(d.newSL).toBeCloseTo(1.1002, 4)
    expect(d.reason).toContain(">=")
  })

  it("does not fire when profit is below threshold", () => {
    const d = evaluateBreakeven({
      ...base,
      profitPips: 10,
      thresholdPips: 25,
    })
    expect(d.shouldFire).toBe(false)
    expect(d.newSL).toBeNull()
  })

  it("does not fire when already applied", () => {
    const d = evaluateBreakeven({
      ...base,
      profitPips: 100,
      thresholdPips: 25,
      alreadyApplied: true,
    })
    expect(d.shouldFire).toBe(false)
    expect(d.reason).toBe("already applied")
  })

  it("rejects when new SL would widen the existing stop", () => {
    // Long already past breakeven — current SL already at 1.105, proposed 1.1002 is worse
    const d = evaluateBreakeven({
      ...base,
      currentSL: 1.105,
      profitPips: 100,
      thresholdPips: 25,
    })
    expect(d.shouldFire).toBe(false)
    expect(d.reason).toContain("widen")
  })

  it("short: new SL is below entry by buffer pips", () => {
    const d = evaluateBreakeven({
      instrument: "EUR_USD",
      direction: "short",
      entryPrice: 1.1,
      currentSL: 1.1025,
      profitPips: 30,
      thresholdPips: 25,
      bufferPips: 2,
      alreadyApplied: false,
    })
    expect(d.shouldFire).toBe(true)
    expect(d.newSL).toBeCloseTo(1.0998, 4)
  })
})

describe("evaluateTrailing", () => {
  it("long: tightens SL as price rises", () => {
    const d = evaluateTrailing({
      instrument: "EUR_USD",
      direction: "long",
      currentPrice: 1.12,
      currentSL: 1.115,
      trailDistancePrice: 0.002,
    })
    expect(d.shouldFire).toBe(true)
    expect(d.newSL).toBeCloseTo(1.118, 4)
  })

  it("long: refuses to widen", () => {
    const d = evaluateTrailing({
      instrument: "EUR_USD",
      direction: "long",
      currentPrice: 1.12,
      currentSL: 1.119,
      trailDistancePrice: 0.002,
    })
    expect(d.shouldFire).toBe(false)
  })

  it("short: tightens SL as price falls", () => {
    const d = evaluateTrailing({
      instrument: "EUR_USD",
      direction: "short",
      currentPrice: 1.08,
      currentSL: 1.09,
      trailDistancePrice: 0.002,
    })
    expect(d.shouldFire).toBe(true)
    expect(d.newSL).toBeCloseTo(1.082, 4)
  })

  it("gated by activation flag", () => {
    const d = evaluateTrailing({
      instrument: "EUR_USD",
      direction: "long",
      currentPrice: 1.12,
      currentSL: 1.115,
      trailDistancePrice: 0.002,
      activated: false,
    })
    expect(d.shouldFire).toBe(false)
    expect(d.reason).toBe("not yet activated")
  })

  it("rejects non-positive trail distance", () => {
    const d = evaluateTrailing({
      instrument: "EUR_USD",
      direction: "long",
      currentPrice: 1.12,
      currentSL: 1.115,
      trailDistancePrice: 0,
    })
    expect(d.shouldFire).toBe(false)
  })

  it("null current SL: first write accepted", () => {
    const d = evaluateTrailing({
      instrument: "EUR_USD",
      direction: "long",
      currentPrice: 1.12,
      currentSL: null,
      trailDistancePrice: 0.002,
    })
    expect(d.shouldFire).toBe(true)
  })
})

describe("evaluateTimeExit", () => {
  it("fires when hold time exceeded", () => {
    const d = evaluateTimeExit({
      openedAt: Date.now() - 9 * 3_600_000,
      maxHours: 8,
    })
    expect(d.shouldFire).toBe(true)
    expect(d.hoursOpen).toBeCloseTo(9, 0)
  })

  it("does not fire when still within limit", () => {
    const d = evaluateTimeExit({
      openedAt: Date.now() - 2 * 3_600_000,
      maxHours: 8,
    })
    expect(d.shouldFire).toBe(false)
  })

  it("disabled when maxHours is 0", () => {
    const d = evaluateTimeExit({
      openedAt: Date.now() - 1000 * 3_600_000,
      maxHours: 0,
    })
    expect(d.shouldFire).toBe(false)
    expect(d.reason).toContain("disabled")
  })

  it("respects injected clock", () => {
    const now = Date.UTC(2026, 3, 15, 12, 0, 0)
    const openedAt = now - 5 * 3_600_000
    const d = evaluateTimeExit({ openedAt, maxHours: 4, now })
    expect(d.shouldFire).toBe(true)
    expect(d.hoursOpen).toBeCloseTo(5, 0)
  })
})
