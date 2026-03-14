import { describe, it, expect } from "vitest"
import {
  TradingModeSchema,
  SaveCredentialsRequestSchema,
  TVAlertsConfigUpdateSchema,
  AiSettingsUpdateSchema,
  TradeConditionTriggerTypeSchema,
  TradeConditionActionTypeSchema,
  CreateConditionSchema,
  TradeFinderConfigUpdateSchema,
  AiTraderConfigUpdateSchema,
  TagCreateSchema,
  TradeUpdateSchema,
  TestSignalSchema,
  UpdateTradingModeSchema,
} from "./schemas"

// ─── TradingModeSchema ──────────────────────────────────────────────────────

describe("TradingModeSchema", () => {
  it("accepts 'practice'", () => {
    expect(TradingModeSchema.parse("practice")).toBe("practice")
  })

  it("accepts 'live'", () => {
    expect(TradingModeSchema.parse("live")).toBe("live")
  })

  it("rejects invalid mode", () => {
    expect(() => TradingModeSchema.parse("demo")).toThrow()
  })

  it("rejects empty string", () => {
    expect(() => TradingModeSchema.parse("")).toThrow()
  })

  it("rejects non-string", () => {
    expect(() => TradingModeSchema.parse(42)).toThrow()
  })
})

// ─── SaveCredentialsRequestSchema ────────────────────────────────────────────

describe("SaveCredentialsRequestSchema", () => {
  it("accepts valid input with token", () => {
    const result = SaveCredentialsRequestSchema.parse({
      mode: "practice",
      accountId: "101-001-12345678-001",
      token: "abc123token",
    })
    expect(result.mode).toBe("practice")
    expect(result.accountId).toBe("101-001-12345678-001")
    expect(result.token).toBe("abc123token")
  })

  it("accepts valid input without token (optional)", () => {
    const result = SaveCredentialsRequestSchema.parse({
      mode: "live",
      accountId: "101-001-12345678-001",
    })
    expect(result.token).toBeUndefined()
  })

  it("rejects empty accountId", () => {
    const result = SaveCredentialsRequestSchema.safeParse({
      mode: "practice",
      accountId: "",
    })
    expect(result.success).toBe(false)
  })

  it("rejects whitespace-only accountId (trim then min 1)", () => {
    const result = SaveCredentialsRequestSchema.safeParse({
      mode: "practice",
      accountId: "   ",
    })
    expect(result.success).toBe(false)
  })

  it("rejects missing mode", () => {
    const result = SaveCredentialsRequestSchema.safeParse({
      accountId: "123",
    })
    expect(result.success).toBe(false)
  })

  it("rejects invalid mode value", () => {
    const result = SaveCredentialsRequestSchema.safeParse({
      mode: "sandbox",
      accountId: "123",
    })
    expect(result.success).toBe(false)
  })

  it("rejects empty token when provided", () => {
    const result = SaveCredentialsRequestSchema.safeParse({
      mode: "practice",
      accountId: "123",
      token: "",
    })
    expect(result.success).toBe(false)
  })

  it("trims whitespace from accountId", () => {
    const result = SaveCredentialsRequestSchema.parse({
      mode: "practice",
      accountId: "  abc  ",
    })
    expect(result.accountId).toBe("abc")
  })
})

// ─── TVAlertsConfigUpdateSchema ──────────────────────────────────────────────

describe("TVAlertsConfigUpdateSchema", () => {
  it("accepts empty object (all fields optional)", () => {
    const result = TVAlertsConfigUpdateSchema.parse({})
    expect(result).toEqual({})
  })

  it("accepts regenerateToken flag", () => {
    const result = TVAlertsConfigUpdateSchema.parse({ regenerateToken: true })
    expect(result.regenerateToken).toBe(true)
  })

  it("accepts full valid config", () => {
    const result = TVAlertsConfigUpdateSchema.parse({
      enabled: true,
      positionSizePercent: 2.5,
      cooldownSeconds: 60,
      maxOpenPositions: 5,
      dailyLossLimit: 100,
      pairWhitelist: ["EUR_USD", "GBP_USD"],
      marketHoursFilter: true,
      dedupWindowSeconds: 10,
      showChartMarkers: false,
      soundEnabled: true,
      cfWorkerUrl: "https://worker.example.com",
      cfWorkerSecret: "secret123",
    })
    expect(result.positionSizePercent).toBe(2.5)
    expect(result.pairWhitelist).toEqual(["EUR_USD", "GBP_USD"])
  })

  it("rejects positionSizePercent below 0.1", () => {
    const result = TVAlertsConfigUpdateSchema.safeParse({ positionSizePercent: 0.05 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]!.message).toContain("at least 0.1")
    }
  })

  it("rejects positionSizePercent above 100", () => {
    const result = TVAlertsConfigUpdateSchema.safeParse({ positionSizePercent: 101 })
    expect(result.success).toBe(false)
  })

  it("rejects cooldownSeconds above 3600", () => {
    const result = TVAlertsConfigUpdateSchema.safeParse({ cooldownSeconds: 3601 })
    expect(result.success).toBe(false)
  })

  it("rejects non-integer cooldownSeconds", () => {
    const result = TVAlertsConfigUpdateSchema.safeParse({ cooldownSeconds: 1.5 })
    expect(result.success).toBe(false)
  })

  it("rejects maxOpenPositions below 1", () => {
    const result = TVAlertsConfigUpdateSchema.safeParse({ maxOpenPositions: 0 })
    expect(result.success).toBe(false)
  })

  it("rejects maxOpenPositions above 100", () => {
    const result = TVAlertsConfigUpdateSchema.safeParse({ maxOpenPositions: 101 })
    expect(result.success).toBe(false)
  })

  it("rejects negative dailyLossLimit", () => {
    const result = TVAlertsConfigUpdateSchema.safeParse({ dailyLossLimit: -1 })
    expect(result.success).toBe(false)
  })

  it("rejects dedupWindowSeconds below 1", () => {
    const result = TVAlertsConfigUpdateSchema.safeParse({ dedupWindowSeconds: 0 })
    expect(result.success).toBe(false)
  })

  it("rejects dedupWindowSeconds above 60", () => {
    const result = TVAlertsConfigUpdateSchema.safeParse({ dedupWindowSeconds: 61 })
    expect(result.success).toBe(false)
  })

  it("rejects unknown fields (strict mode)", () => {
    const result = TVAlertsConfigUpdateSchema.safeParse({ unknownField: "value" })
    expect(result.success).toBe(false)
  })

  it("accepts boundary values", () => {
    const result = TVAlertsConfigUpdateSchema.parse({
      positionSizePercent: 0.1,
      cooldownSeconds: 0,
      maxOpenPositions: 1,
      dailyLossLimit: 0,
      dedupWindowSeconds: 1,
    })
    expect(result.positionSizePercent).toBe(0.1)
    expect(result.cooldownSeconds).toBe(0)
  })

  it("accepts upper boundary values", () => {
    const result = TVAlertsConfigUpdateSchema.parse({
      positionSizePercent: 100,
      cooldownSeconds: 3600,
      maxOpenPositions: 100,
      dedupWindowSeconds: 60,
    })
    expect(result.positionSizePercent).toBe(100)
  })
})

// ─── AiSettingsUpdateSchema ──────────────────────────────────────────────────

describe("AiSettingsUpdateSchema", () => {
  it("accepts empty object", () => {
    expect(AiSettingsUpdateSchema.parse({})).toEqual({})
  })

  it("accepts re-enable action", () => {
    const result = AiSettingsUpdateSchema.parse({ action: "re-enable-auto" })
    expect(result.action).toBe("re-enable-auto")
  })

  it("rejects invalid action literal", () => {
    const result = AiSettingsUpdateSchema.safeParse({ action: "disable" })
    expect(result.success).toBe(false)
  })

  it("accepts claudeApiKey as string", () => {
    const result = AiSettingsUpdateSchema.parse({ claudeApiKey: "sk-ant-123" })
    expect(result.claudeApiKey).toBe("sk-ant-123")
  })

  it("accepts claudeApiKey as null (delete)", () => {
    const result = AiSettingsUpdateSchema.parse({ claudeApiKey: null })
    expect(result.claudeApiKey).toBeNull()
  })

  it("rejects empty claudeApiKey string", () => {
    const result = AiSettingsUpdateSchema.safeParse({ claudeApiKey: "" })
    expect(result.success).toBe(false)
  })

  it("accepts finnhubApiKey as string", () => {
    const result = AiSettingsUpdateSchema.parse({ finnhubApiKey: "fh_key" })
    expect(result.finnhubApiKey).toBe("fh_key")
  })

  it("accepts finnhubApiKey as null", () => {
    const result = AiSettingsUpdateSchema.parse({ finnhubApiKey: null })
    expect(result.finnhubApiKey).toBeNull()
  })

  it("accepts preferences as record", () => {
    const result = AiSettingsUpdateSchema.parse({
      preferences: { autoEnabled: true, model: "claude-sonnet" },
    })
    expect(result.preferences).toEqual({ autoEnabled: true, model: "claude-sonnet" })
  })

  it("rejects unknown fields (strict mode)", () => {
    const result = AiSettingsUpdateSchema.safeParse({ extraField: true })
    expect(result.success).toBe(false)
  })
})

// ─── TradeConditionTriggerTypeSchema / TradeConditionActionTypeSchema ────────

describe("TradeConditionTriggerTypeSchema", () => {
  const validTriggers = [
    "price_reaches",
    "price_breaks_above",
    "price_breaks_below",
    "pnl_pips",
    "pnl_currency",
    "time_reached",
    "duration_hours",
    "trailing_stop",
  ] as const

  it.each(validTriggers)("accepts '%s'", (trigger) => {
    expect(TradeConditionTriggerTypeSchema.parse(trigger)).toBe(trigger)
  })

  it("rejects invalid trigger type", () => {
    expect(() => TradeConditionTriggerTypeSchema.parse("price_above")).toThrow()
  })
})

describe("TradeConditionActionTypeSchema", () => {
  const validActions = [
    "close_trade",
    "partial_close",
    "move_stop_loss",
    "move_take_profit",
    "cancel_order",
    "notify",
  ] as const

  it.each(validActions)("accepts '%s'", (action) => {
    expect(TradeConditionActionTypeSchema.parse(action)).toBe(action)
  })

  it("rejects invalid action type", () => {
    expect(() => TradeConditionActionTypeSchema.parse("delete_trade")).toThrow()
  })
})

// ─── CreateConditionSchema ───────────────────────────────────────────────────

describe("CreateConditionSchema", () => {
  const validCondition = {
    triggerType: "price_reaches",
    triggerValue: { price: 1.1234 },
    actionType: "notify",
  }

  it("accepts minimal valid input", () => {
    const result = CreateConditionSchema.parse(validCondition)
    expect(result.triggerType).toBe("price_reaches")
    expect(result.triggerValue).toEqual({ price: 1.1234 })
    expect(result.actionType).toBe("notify")
  })

  it("accepts full input with all optional fields", () => {
    const result = CreateConditionSchema.parse({
      ...validCondition,
      actionParams: { closePercent: 50 },
      label: "Close half at target",
      priority: 10,
      expiresAt: "2026-12-31T23:59:59Z",
      analysisId: "analysis-123",
      parentConditionId: "parent-456",
      status: "active",
    })
    expect(result.label).toBe("Close half at target")
    expect(result.priority).toBe(10)
    expect(result.status).toBe("active")
  })

  it("rejects empty triggerValue object", () => {
    const result = CreateConditionSchema.safeParse({
      ...validCondition,
      triggerValue: {},
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages).toContain("triggerValue must have at least one key")
    }
  })

  it("rejects missing triggerType", () => {
    const result = CreateConditionSchema.safeParse({
      triggerValue: { price: 1.0 },
      actionType: "notify",
    })
    expect(result.success).toBe(false)
  })

  it("rejects missing actionType", () => {
    const result = CreateConditionSchema.safeParse({
      triggerType: "price_reaches",
      triggerValue: { price: 1.0 },
    })
    expect(result.success).toBe(false)
  })

  it("rejects label over 200 characters", () => {
    const result = CreateConditionSchema.safeParse({
      ...validCondition,
      label: "x".repeat(201),
    })
    expect(result.success).toBe(false)
  })

  it("accepts label exactly 200 characters", () => {
    const result = CreateConditionSchema.parse({
      ...validCondition,
      label: "x".repeat(200),
    })
    expect(result.label).toHaveLength(200)
  })

  it("rejects priority below 0", () => {
    const result = CreateConditionSchema.safeParse({ ...validCondition, priority: -1 })
    expect(result.success).toBe(false)
  })

  it("rejects priority above 100", () => {
    const result = CreateConditionSchema.safeParse({ ...validCondition, priority: 101 })
    expect(result.success).toBe(false)
  })

  it("rejects non-integer priority", () => {
    const result = CreateConditionSchema.safeParse({ ...validCondition, priority: 5.5 })
    expect(result.success).toBe(false)
  })

  it("rejects invalid ISO datetime for expiresAt", () => {
    const result = CreateConditionSchema.safeParse({
      ...validCondition,
      expiresAt: "not-a-date",
    })
    expect(result.success).toBe(false)
  })

  it("rejects non-ISO date format for expiresAt", () => {
    const result = CreateConditionSchema.safeParse({
      ...validCondition,
      expiresAt: "2026-12-31",
    })
    expect(result.success).toBe(false)
  })

  it("accepts 'waiting' status", () => {
    const result = CreateConditionSchema.parse({ ...validCondition, status: "waiting" })
    expect(result.status).toBe("waiting")
  })

  it("rejects invalid status", () => {
    const result = CreateConditionSchema.safeParse({ ...validCondition, status: "completed" })
    expect(result.success).toBe(false)
  })

  it("rejects unknown fields (strict mode)", () => {
    const result = CreateConditionSchema.safeParse({ ...validCondition, extraField: true })
    expect(result.success).toBe(false)
  })
})

// ─── TradeFinderConfigUpdateSchema ───────────────────────────────────────────

describe("TradeFinderConfigUpdateSchema", () => {
  it("accepts empty object", () => {
    expect(TradeFinderConfigUpdateSchema.parse({})).toEqual({})
  })

  it("accepts valid full config", () => {
    const result = TradeFinderConfigUpdateSchema.parse({
      enabled: true,
      minScore: 70,
      riskPercent: 1.5,
      maxEnabledPairs: 10,
      pairs: [
        { instrument: "EUR_USD", enabled: true, timeframeSet: "daily" },
        { instrument: "GBP_JPY", enabled: false, timeframeSet: "hourly", autoTradeEnabled: true },
      ],
      approachingAtrMultiple: 2.0,
      autoTradeEnabled: true,
      autoTradeMinScore: 80,
      autoTradeMaxConcurrent: 3,
      autoTradeMaxDaily: 10,
      autoTradeMaxRiskPercent: 2.0,
      autoTradeMinRR: 1.5,
      autoTradeCancelOnInvalidation: true,
    })
    expect(result.pairs).toHaveLength(2)
    expect(result.autoTradeMinScore).toBe(80)
  })

  it("rejects invalid instrument format in pairs", () => {
    const result = TradeFinderConfigUpdateSchema.safeParse({
      pairs: [{ instrument: "eurusd", enabled: true, timeframeSet: "daily" }],
    })
    expect(result.success).toBe(false)
  })

  it("rejects instrument without underscore", () => {
    const result = TradeFinderConfigUpdateSchema.safeParse({
      pairs: [{ instrument: "EURUSD", enabled: true, timeframeSet: "daily" }],
    })
    expect(result.success).toBe(false)
  })

  it("rejects invalid timeframeSet in pairs", () => {
    const result = TradeFinderConfigUpdateSchema.safeParse({
      pairs: [{ instrument: "EUR_USD", enabled: true, timeframeSet: "yearly" }],
    })
    expect(result.success).toBe(false)
  })

  it("rejects minScore above 100", () => {
    const result = TradeFinderConfigUpdateSchema.safeParse({ minScore: 101 })
    expect(result.success).toBe(false)
  })

  it("rejects riskPercent below 0.01", () => {
    const result = TradeFinderConfigUpdateSchema.safeParse({ riskPercent: 0.001 })
    expect(result.success).toBe(false)
  })

  it("rejects riskPercent above 10", () => {
    const result = TradeFinderConfigUpdateSchema.safeParse({ riskPercent: 10.01 })
    expect(result.success).toBe(false)
  })

  it("accepts boundary riskPercent values", () => {
    expect(TradeFinderConfigUpdateSchema.parse({ riskPercent: 0.01 }).riskPercent).toBe(0.01)
    expect(TradeFinderConfigUpdateSchema.parse({ riskPercent: 10 }).riskPercent).toBe(10)
  })

  it("rejects autoTradeMaxConcurrent below 1", () => {
    const result = TradeFinderConfigUpdateSchema.safeParse({ autoTradeMaxConcurrent: 0 })
    expect(result.success).toBe(false)
  })

  it("rejects autoTradeMinRR below 0.5", () => {
    const result = TradeFinderConfigUpdateSchema.safeParse({ autoTradeMinRR: 0.3 })
    expect(result.success).toBe(false)
  })

  it("rejects autoTradeMinRR above 20", () => {
    const result = TradeFinderConfigUpdateSchema.safeParse({ autoTradeMinRR: 21 })
    expect(result.success).toBe(false)
  })

  it("rejects unknown fields (strict mode)", () => {
    const result = TradeFinderConfigUpdateSchema.safeParse({ mystery: true })
    expect(result.success).toBe(false)
  })
})

// ─── AiTraderConfigUpdateSchema ──────────────────────────────────────────────

describe("AiTraderConfigUpdateSchema", () => {
  it("accepts empty object", () => {
    expect(AiTraderConfigUpdateSchema.parse({})).toEqual({})
  })

  it("accepts valid operating modes", () => {
    expect(AiTraderConfigUpdateSchema.parse({ operatingMode: "manual" }).operatingMode).toBe(
      "manual",
    )
    expect(AiTraderConfigUpdateSchema.parse({ operatingMode: "semi_auto" }).operatingMode).toBe(
      "semi_auto",
    )
    expect(AiTraderConfigUpdateSchema.parse({ operatingMode: "full_auto" }).operatingMode).toBe(
      "full_auto",
    )
  })

  it("rejects invalid operating mode", () => {
    const result = AiTraderConfigUpdateSchema.safeParse({ operatingMode: "auto" })
    expect(result.success).toBe(false)
  })

  it("accepts valid enabledProfiles", () => {
    const result = AiTraderConfigUpdateSchema.parse({
      enabledProfiles: { scalper: true, intraday: false, swing: true, news: false },
    })
    expect(result.enabledProfiles?.scalper).toBe(true)
  })

  it("rejects invalid profile key in enabledProfiles", () => {
    const result = AiTraderConfigUpdateSchema.safeParse({
      enabledProfiles: { invalid_profile: true },
    })
    expect(result.success).toBe(false)
  })

  it("accepts valid enabledTechniques", () => {
    const result = AiTraderConfigUpdateSchema.parse({
      enabledTechniques: { smc_structure: true, rsi: false, macd: true },
    })
    expect(result.enabledTechniques?.smc_structure).toBe(true)
  })

  it("rejects invalid technique key", () => {
    const result = AiTraderConfigUpdateSchema.safeParse({
      enabledTechniques: { unknown_technique: true },
    })
    expect(result.success).toBe(false)
  })

  it("accepts valid managementConfig", () => {
    const result = AiTraderConfigUpdateSchema.parse({
      managementConfig: {
        breakevenEnabled: true,
        breakevenTriggerRR: 1.5,
        trailingStopEnabled: true,
        trailingStopAtrMultiplier: 2.0,
        partialCloseEnabled: false,
        partialClosePercent: 50,
        partialCloseTargetRR: 2.0,
        timeExitEnabled: true,
        timeExitHours: 24,
        newsProtectionEnabled: true,
        reEvaluationEnabled: false,
        scaleInEnabled: false,
      },
    })
    expect(result.managementConfig?.breakevenEnabled).toBe(true)
  })

  it("rejects breakevenTriggerRR out of range", () => {
    expect(
      AiTraderConfigUpdateSchema.safeParse({
        managementConfig: { breakevenTriggerRR: 0.05 },
      }).success,
    ).toBe(false)
    expect(
      AiTraderConfigUpdateSchema.safeParse({
        managementConfig: { breakevenTriggerRR: 11 },
      }).success,
    ).toBe(false)
  })

  it("rejects partialClosePercent out of range", () => {
    expect(
      AiTraderConfigUpdateSchema.safeParse({
        managementConfig: { partialClosePercent: 0 },
      }).success,
    ).toBe(false)
    expect(
      AiTraderConfigUpdateSchema.safeParse({
        managementConfig: { partialClosePercent: 100 },
      }).success,
    ).toBe(false)
  })

  it("rejects timeExitHours out of range", () => {
    expect(
      AiTraderConfigUpdateSchema.safeParse({
        managementConfig: { timeExitHours: 0 },
      }).success,
    ).toBe(false)
    expect(
      AiTraderConfigUpdateSchema.safeParse({
        managementConfig: { timeExitHours: 721 },
      }).success,
    ).toBe(false)
  })

  it("rejects scanIntervalMinutes out of range", () => {
    expect(AiTraderConfigUpdateSchema.safeParse({ scanIntervalMinutes: 0 }).success).toBe(false)
    expect(AiTraderConfigUpdateSchema.safeParse({ scanIntervalMinutes: 1441 }).success).toBe(false)
  })

  it("rejects confidenceThreshold out of range", () => {
    expect(AiTraderConfigUpdateSchema.safeParse({ confidenceThreshold: -1 }).success).toBe(false)
    expect(AiTraderConfigUpdateSchema.safeParse({ confidenceThreshold: 101 }).success).toBe(false)
  })

  it("rejects maxConcurrentTrades out of range", () => {
    expect(AiTraderConfigUpdateSchema.safeParse({ maxConcurrentTrades: 0 }).success).toBe(false)
    expect(AiTraderConfigUpdateSchema.safeParse({ maxConcurrentTrades: 51 }).success).toBe(false)
  })

  it("accepts pairWhitelist", () => {
    const result = AiTraderConfigUpdateSchema.parse({
      pairWhitelist: ["EUR_USD", "GBP_USD"],
    })
    expect(result.pairWhitelist).toEqual(["EUR_USD", "GBP_USD"])
  })

  it("accepts budget fields at boundaries", () => {
    const result = AiTraderConfigUpdateSchema.parse({
      dailyBudgetUsd: 0,
      monthlyBudgetUsd: 0,
    })
    expect(result.dailyBudgetUsd).toBe(0)
    expect(result.monthlyBudgetUsd).toBe(0)
  })

  it("rejects dailyBudgetUsd above 1000", () => {
    expect(AiTraderConfigUpdateSchema.safeParse({ dailyBudgetUsd: 1001 }).success).toBe(false)
  })

  it("rejects monthlyBudgetUsd above 10000", () => {
    expect(AiTraderConfigUpdateSchema.safeParse({ monthlyBudgetUsd: 10001 }).success).toBe(false)
  })

  it("accepts API key as string", () => {
    const result = AiTraderConfigUpdateSchema.parse({ fredApiKey: "fred-123" })
    expect(result.fredApiKey).toBe("fred-123")
  })

  it("accepts API key as null (delete)", () => {
    const result = AiTraderConfigUpdateSchema.parse({ fredApiKey: null })
    expect(result.fredApiKey).toBeNull()
  })

  it("rejects empty API key string", () => {
    expect(AiTraderConfigUpdateSchema.safeParse({ fredApiKey: "" }).success).toBe(false)
    expect(AiTraderConfigUpdateSchema.safeParse({ alphaVantageApiKey: "" }).success).toBe(false)
  })

  it("accepts model strings", () => {
    const result = AiTraderConfigUpdateSchema.parse({
      scanModel: "claude-3-haiku-20240307",
      decisionModel: "claude-sonnet-4-20250514",
    })
    expect(result.scanModel).toBe("claude-3-haiku-20240307")
  })

  it("rejects empty model strings", () => {
    expect(AiTraderConfigUpdateSchema.safeParse({ scanModel: "" }).success).toBe(false)
    expect(AiTraderConfigUpdateSchema.safeParse({ decisionModel: "" }).success).toBe(false)
  })

  it("rejects unknown fields (strict mode)", () => {
    const result = AiTraderConfigUpdateSchema.safeParse({ unknownSetting: 42 })
    expect(result.success).toBe(false)
  })
})

// ─── TagCreateSchema ─────────────────────────────────────────────────────────

describe("TagCreateSchema", () => {
  it("accepts valid tag", () => {
    const result = TagCreateSchema.parse({ name: "Scalp", color: "#ff0000" })
    expect(result.name).toBe("Scalp")
    expect(result.color).toBe("#ff0000")
  })

  it("accepts 3-digit hex color", () => {
    const result = TagCreateSchema.parse({ name: "Tag", color: "#FFF" })
    expect(result.color).toBe("#FFF")
  })

  it("accepts 6-digit hex color", () => {
    const result = TagCreateSchema.parse({ name: "Tag", color: "#aaBB00" })
    expect(result.color).toBe("#aaBB00")
  })

  it("rejects empty name", () => {
    const result = TagCreateSchema.safeParse({ name: "", color: "#000" })
    expect(result.success).toBe(false)
  })

  it("rejects whitespace-only name", () => {
    const result = TagCreateSchema.safeParse({ name: "   ", color: "#000" })
    expect(result.success).toBe(false)
  })

  it("rejects name over 50 characters", () => {
    const result = TagCreateSchema.safeParse({ name: "x".repeat(51), color: "#000" })
    expect(result.success).toBe(false)
  })

  it("accepts name exactly 50 characters", () => {
    const result = TagCreateSchema.parse({ name: "x".repeat(50), color: "#000" })
    expect(result.name).toHaveLength(50)
  })

  it("rejects invalid hex color — missing hash", () => {
    const result = TagCreateSchema.safeParse({ name: "Tag", color: "ff0000" })
    expect(result.success).toBe(false)
  })

  it("rejects invalid hex color — wrong length", () => {
    const result = TagCreateSchema.safeParse({ name: "Tag", color: "#ff00" })
    expect(result.success).toBe(false)
  })

  it("rejects invalid hex color — non-hex chars", () => {
    const result = TagCreateSchema.safeParse({ name: "Tag", color: "#gggggg" })
    expect(result.success).toBe(false)
  })

  it("rejects unknown fields (strict mode)", () => {
    const result = TagCreateSchema.safeParse({ name: "Tag", color: "#000", icon: "star" })
    expect(result.success).toBe(false)
  })

  it("trims whitespace from name", () => {
    const result = TagCreateSchema.parse({ name: "  Scalp  ", color: "#000" })
    expect(result.name).toBe("Scalp")
  })
})

// ─── TradeUpdateSchema ───────────────────────────────────────────────────────

describe("TradeUpdateSchema", () => {
  it("accepts empty object", () => {
    expect(TradeUpdateSchema.parse({})).toEqual({})
  })

  it("accepts notes as string", () => {
    const result = TradeUpdateSchema.parse({ notes: "Good trade setup" })
    expect(result.notes).toBe("Good trade setup")
  })

  it("accepts notes as null (clear)", () => {
    const result = TradeUpdateSchema.parse({ notes: null })
    expect(result.notes).toBeNull()
  })

  it("rejects notes over 5000 characters", () => {
    const result = TradeUpdateSchema.safeParse({ notes: "x".repeat(5001) })
    expect(result.success).toBe(false)
  })

  it("accepts notes exactly 5000 characters", () => {
    const result = TradeUpdateSchema.parse({ notes: "x".repeat(5000) })
    expect(result.notes).toHaveLength(5000)
  })

  it("accepts valid timeframes", () => {
    const timeframes = ["M1", "M5", "M15", "M30", "H1", "H4", "D", "W", "M"] as const
    for (const tf of timeframes) {
      expect(TradeUpdateSchema.parse({ timeframe: tf }).timeframe).toBe(tf)
    }
  })

  it("accepts timeframe as null (clear)", () => {
    const result = TradeUpdateSchema.parse({ timeframe: null })
    expect(result.timeframe).toBeNull()
  })

  it("rejects invalid timeframe", () => {
    const result = TradeUpdateSchema.safeParse({ timeframe: "H2" })
    expect(result.success).toBe(false)
  })

  it("rejects unknown fields (strict mode)", () => {
    const result = TradeUpdateSchema.safeParse({ notes: "ok", rating: 5 })
    expect(result.success).toBe(false)
  })
})

// ─── TestSignalSchema ────────────────────────────────────────────────────────

describe("TestSignalSchema", () => {
  it("accepts valid buy signal", () => {
    const result = TestSignalSchema.parse({ action: "buy", ticker: "EUR_USD" })
    expect(result.action).toBe("buy")
    expect(result.ticker).toBe("EUR_USD")
  })

  it("accepts valid sell signal", () => {
    const result = TestSignalSchema.parse({ action: "sell", ticker: "GBP_JPY" })
    expect(result.action).toBe("sell")
  })

  it("rejects invalid action", () => {
    const result = TestSignalSchema.safeParse({ action: "hold", ticker: "EUR_USD" })
    expect(result.success).toBe(false)
  })

  it("rejects empty ticker", () => {
    const result = TestSignalSchema.safeParse({ action: "buy", ticker: "" })
    expect(result.success).toBe(false)
  })

  it("rejects whitespace-only ticker", () => {
    const result = TestSignalSchema.safeParse({ action: "buy", ticker: "   " })
    expect(result.success).toBe(false)
  })

  it("rejects missing ticker", () => {
    const result = TestSignalSchema.safeParse({ action: "buy" })
    expect(result.success).toBe(false)
  })

  it("rejects missing action", () => {
    const result = TestSignalSchema.safeParse({ ticker: "EUR_USD" })
    expect(result.success).toBe(false)
  })

  it("rejects unknown fields (strict mode)", () => {
    const result = TestSignalSchema.safeParse({
      action: "buy",
      ticker: "EUR_USD",
      volume: 100,
    })
    expect(result.success).toBe(false)
  })

  it("trims ticker whitespace", () => {
    const result = TestSignalSchema.parse({ action: "buy", ticker: "  EUR_USD  " })
    expect(result.ticker).toBe("EUR_USD")
  })
})

// ─── UpdateTradingModeSchema ─────────────────────────────────────────────────

describe("UpdateTradingModeSchema", () => {
  it("accepts practice mode", () => {
    const result = UpdateTradingModeSchema.parse({ mode: "practice" })
    expect(result.mode).toBe("practice")
  })

  it("accepts live mode", () => {
    const result = UpdateTradingModeSchema.parse({ mode: "live" })
    expect(result.mode).toBe("live")
  })

  it("rejects invalid mode", () => {
    const result = UpdateTradingModeSchema.safeParse({ mode: "demo" })
    expect(result.success).toBe(false)
  })

  it("rejects missing mode", () => {
    const result = UpdateTradingModeSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it("rejects unknown fields (strict mode)", () => {
    const result = UpdateTradingModeSchema.safeParse({ mode: "live", extra: true })
    expect(result.success).toBe(false)
  })
})
