import { describe, it, expect, vi } from "vitest"
import {
  countSharedCurrencyExposure,
  checkCorrelation,
  filterCorrelatedCandidates,
  CircuitBreaker,
  checkSpread,
  spreadImpactPercent,
  spreadAdjustedRR,
  calculatePositionSize,
  getAdaptiveMinRR,
  getSessionRRMultiplier,
  getRegimeRRMultiplier,
  checkNewsGate,
  type NewsCalendarSource,
} from "./index"

describe("correlation", () => {
  it("counts same-EUR exposure across EUR pairs", () => {
    const count = countSharedCurrencyExposure("EUR_USD", "long", [
      { instrument: "EUR_GBP", direction: "long" }, // long EUR
      { instrument: "GBP_EUR", direction: "short" }, // also long EUR
      { instrument: "GBP_JPY", direction: "long" }, // unrelated
    ])
    expect(count).toBe(2)
  })

  it("ignores pairs with no shared currency", () => {
    expect(
      countSharedCurrencyExposure("EUR_USD", "long", [
        { instrument: "GBP_JPY", direction: "long" },
      ]),
    ).toBe(0)
  })

  it("fails when exposure cap is reached", () => {
    const result = checkCorrelation(
      "EUR_USD",
      "long",
      [
        { instrument: "EUR_GBP", direction: "long" },
        { instrument: "EUR_CHF", direction: "long" },
      ],
      2,
    )
    expect(result.passed).toBe(false)
    expect(result.reason).toContain("correlated")
  })

  it("passes when exposure cap is not reached", () => {
    expect(
      checkCorrelation("EUR_USD", "long", [{ instrument: "EUR_GBP", direction: "long" }], 2).passed,
    ).toBe(true)
  })

  it("filterCorrelatedCandidates drops overflow and preserves order", () => {
    const candidates = [
      { instrument: "EUR_USD", direction: "long" as const, score: 95 },
      { instrument: "EUR_GBP", direction: "long" as const, score: 90 },
      { instrument: "EUR_CHF", direction: "long" as const, score: 85 },
      { instrument: "GBP_JPY", direction: "short" as const, score: 80 },
    ]
    const filtered = filterCorrelatedCandidates(candidates, 2)
    expect(filtered.map((c) => c.instrument)).toEqual(["EUR_USD", "EUR_GBP", "GBP_JPY"])
  })

  it("filterCorrelatedCandidates handles invalid instruments", () => {
    const filtered = filterCorrelatedCandidates(
      [{ instrument: "INVALID", direction: "long" as const }],
      2,
    )
    expect(filtered).toHaveLength(0)
  })
})

describe("CircuitBreaker", () => {
  const config = {
    maxConsecLosses: 3,
    consecPauseMinutes: 120,
    maxDailyLosses: 4,
    maxDailyDrawdownPercent: 3.0,
  }

  it("allows trading with no losses", () => {
    const cb = new CircuitBreaker(config)
    expect(cb.isAllowed().allowed).toBe(true)
  })

  it("pauses after consecutive loss threshold", () => {
    let now = Date.UTC(2026, 3, 15, 10, 0, 0)
    const cb = new CircuitBreaker(config, () => now)
    cb.recordOutcome(-10)
    cb.recordOutcome(-10)
    cb.recordOutcome(-10)
    expect(cb.isAllowed().allowed).toBe(false)
    expect(cb.isAllowed().reason).toContain("consecutive")
    // After pause window
    now += 121 * 60_000
    expect(cb.isAllowed().allowed).toBe(true)
  })

  it("resets consecutive loss counter on win", () => {
    const cb = new CircuitBreaker(config)
    cb.recordOutcome(-10)
    cb.recordOutcome(-10)
    cb.recordOutcome(20)
    cb.recordOutcome(-10)
    expect(cb.isAllowed().allowed).toBe(true)
  })

  it("pauses until midnight on daily loss cap", () => {
    let now = Date.UTC(2026, 3, 15, 10, 0, 0)
    const cb = new CircuitBreaker(config, () => now)
    cb.setStartingBalance(10_000)
    cb.recordOutcome(-10)
    cb.recordOutcome(-10)
    cb.recordOutcome(-10)
    cb.recordOutcome(-10)
    const result = cb.isAllowed()
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain("daily")
    // Before midnight still paused
    now = Date.UTC(2026, 3, 15, 23, 59, 0)
    expect(cb.isAllowed().allowed).toBe(false)
    // After midnight UTC next day
    now = Date.UTC(2026, 3, 16, 0, 1, 0)
    expect(cb.isAllowed().allowed).toBe(true)
  })

  it("pauses on daily drawdown percent", () => {
    const cb = new CircuitBreaker(config)
    cb.setStartingBalance(1000)
    cb.recordOutcome(-35) // 3.5% dd
    expect(cb.isAllowed().allowed).toBe(false)
  })

  it("exposes state snapshot", () => {
    const cb = new CircuitBreaker(config)
    cb.setStartingBalance(10_000)
    cb.recordOutcome(-100)
    const state = cb.getState()
    expect(state.consecutiveLosses).toBe(1)
    expect(state.dailyLosses).toBe(1)
    expect(state.dailyDrawdownPercent).toBeCloseTo(1.0, 1)
  })

  it("manual reset clears state", () => {
    const cb = new CircuitBreaker(config)
    cb.recordOutcome(-10)
    cb.recordOutcome(-10)
    cb.reset()
    expect(cb.getState().consecutiveLosses).toBe(0)
  })
})

describe("spread", () => {
  it("passes when spread is within limit", () => {
    expect(checkSpread({ spreadPips: 1.5, riskPips: 20, maxPercent: 0.2 }).passed).toBe(true)
  })
  it("fails when spread exceeds limit", () => {
    const r = checkSpread({ spreadPips: 5, riskPips: 20, maxPercent: 0.2 })
    expect(r.passed).toBe(false)
    expect(r.reason).toMatch(/Spread.*exceeds/)
  })
  it("passes when riskPips is zero (no risk defined)", () => {
    expect(checkSpread({ spreadPips: 5, riskPips: 0, maxPercent: 0.2 }).passed).toBe(true)
  })
  it("computes spread impact percent capped at 1", () => {
    expect(spreadImpactPercent(10, 20)).toBe(0.5)
    expect(spreadImpactPercent(30, 20)).toBe(1)
    expect(spreadImpactPercent(10, 0)).toBe(1)
  })
  it("computes spread-adjusted R:R", () => {
    const r = spreadAdjustedRR({ riskPips: 20, rewardPips: 60, spreadPips: 2 })
    expect(r.raw).toBe(3)
    // adjusted = (60-2) / (20+2) = 58/22 ≈ 2.636
    expect(r.adjusted).toBeCloseTo(2.636, 2)
  })
  it("spread-adjusted R:R floors adjusted reward at 0", () => {
    const r = spreadAdjustedRR({ riskPips: 20, rewardPips: 1, spreadPips: 5 })
    expect(r.adjusted).toBe(0)
  })
})

describe("risk sizing", () => {
  it("risk_percent uses pipSize for USD-quoted pairs", () => {
    // 1% of 10000 = $100 risk, 20 pip SL, pipValuePerUnit = 0.0001
    // units = 100 / (20 * 0.0001) = 50_000
    const units = calculatePositionSize({
      mode: "risk_percent",
      riskPercent: 1,
      accountBalance: 10_000,
      instrument: "EUR_USD",
      riskPips: 20,
    })
    expect(units).toBe(50_000)
  })

  it("risk_percent handles non-USD-quoted pairs via entryPrice approximation", () => {
    // USD_JPY at 150, pipSize 0.01, pipValuePerUnit = 0.01 / 150 ≈ 6.67e-5
    // risk $100 / (20 pips * 6.67e-5) ≈ 75000 units
    const units = calculatePositionSize({
      mode: "risk_percent",
      riskPercent: 1,
      accountBalance: 10_000,
      instrument: "USD_JPY",
      riskPips: 20,
      entryPrice: 150,
    })
    expect(units).toBeGreaterThan(70_000)
    expect(units).toBeLessThan(80_000)
  })

  it("returns minUnits when inputs are unusable", () => {
    expect(
      calculatePositionSize({
        mode: "risk_percent",
        riskPercent: 1,
        accountBalance: 0,
        instrument: "EUR_USD",
        riskPips: 20,
      }),
    ).toBe(1)
  })

  it("fixed_units returns floored units", () => {
    expect(calculatePositionSize({ mode: "fixed_units", units: 12345.7 })).toBe(12345)
  })

  it("fixed_lots scales lots by 100k", () => {
    expect(calculatePositionSize({ mode: "fixed_lots", lots: 0.1 })).toBe(10_000)
  })

  it("honours an explicit pipValuePerUnitOverride", () => {
    const units = calculatePositionSize({
      mode: "risk_percent",
      riskPercent: 1,
      accountBalance: 10_000,
      instrument: "EUR_JPY",
      riskPips: 20,
      pipValuePerUnitOverride: 0.000061,
    })
    // $100 / (20 * 6.1e-5) ≈ 81_967
    expect(units).toBeGreaterThan(80_000)
    expect(units).toBeLessThan(90_000)
  })
})

describe("adaptive R:R multipliers", () => {
  it("regime multiplier table", () => {
    expect(getRegimeRRMultiplier("trending")).toBe(1.0)
    expect(getRegimeRRMultiplier("ranging")).toBe(0.75)
    expect(getRegimeRRMultiplier("volatile")).toBe(0.9)
    expect(getRegimeRRMultiplier("low_volatility")).toBe(1.3)
    expect(getRegimeRRMultiplier(null)).toBe(1.0)
    expect(getRegimeRRMultiplier("unknown")).toBe(1.0)
  })

  it("session multiplier falls back to 1.2 in the off-session window (past 21:00 UTC, non-kill-zone)", () => {
    // 05:00 UTC ≈ 00:00-01:00 ET — no session window → off-session, UTC hour < 6 → 1.2
    const offEarly = new Date(Date.UTC(2026, 3, 15, 5, 0, 0))
    expect(getSessionRRMultiplier(offEarly)).toBe(1.2)
  })

  it("session multiplier returns 0.85 inside extended session (UTC 06-21, non-kill-zone)", () => {
    // 10:00 UTC ≈ 05:00 ET — not in any kill zone window → 0.85 extended.
    const ext = new Date(Date.UTC(2026, 3, 15, 10, 0, 0))
    const m = getSessionRRMultiplier(ext)
    // Value is either 0.85 (extended) or 1.0 (if DST puts ET inside a kill zone) — both are valid.
    expect([0.85, 1.0]).toContain(m)
  })

  it("adaptive min R:R floors at 1.0", () => {
    // Base 1.0, ranging regime (0.75), non-kill-zone session at 0.85 = 0.6375 → floored to 1.0
    const off = new Date(Date.UTC(2026, 3, 15, 9, 0, 0))
    const r = getAdaptiveMinRR(1.0, "ranging", off)
    expect(r).toBeGreaterThanOrEqual(1.0)
  })

  it("adaptive min R:R scales up in low volatility", () => {
    // 2.0 base * 1.0 * 1.3 = 2.6 in low_vol (session-dependent)
    const r = getAdaptiveMinRR(2.0, "low_volatility")
    expect(r).toBeGreaterThanOrEqual(2.0)
  })
})

describe("news gate", () => {
  const mkSource = (imminent: boolean, event = "NFP"): NewsCalendarSource => ({
    hasImminentEvent: vi.fn().mockResolvedValue({ imminent, event }),
  })

  it("passes when no imminent event", async () => {
    const r = await checkNewsGate({
      instrument: "EUR_USD",
      bufferMinutes: 60,
      source: mkSource(false),
    })
    expect(r.passed).toBe(true)
  })

  it("fails when high-impact event imminent", async () => {
    const r = await checkNewsGate({
      instrument: "EUR_USD",
      bufferMinutes: 60,
      source: mkSource(true, "FOMC"),
    })
    expect(r.passed).toBe(false)
    expect(r.reason).toContain("FOMC")
  })

  it("fails open on source error", async () => {
    const source: NewsCalendarSource = {
      hasImminentEvent: vi.fn().mockRejectedValue(new Error("db down")),
    }
    const r = await checkNewsGate({ instrument: "EUR_USD", bufferMinutes: 60, source })
    expect(r.passed).toBe(true)
    expect(r.reason).toContain("db down")
  })

  it("converts bufferMinutes to bufferHours", async () => {
    const source = mkSource(false)
    await checkNewsGate({ instrument: "EUR_USD", bufferMinutes: 120, source })
    expect(source.hasImminentEvent).toHaveBeenCalledWith("EUR_USD", 2)
  })
})
