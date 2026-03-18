// Zod schemas — runtime validation for API request bodies.
// Each schema matches the corresponding TypeScript interface in index.ts.

import { z } from "zod"

// ─── Reusable Validators ────────────────────────────────────────────────────

/** OANDA instrument format, e.g. "EUR_USD" */
const instrumentSchema = z
  .string()
  .trim()
  .regex(/^[A-Z]{2,6}_[A-Z]{2,6}$/, "Invalid instrument format (expected e.g. EUR_USD)")

/** CSS hex color, e.g. "#ff00aa" or "#FFF" */
const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Invalid hex color (expected e.g. #ff00aa)")

// ─── Trading Mode ───────────────────────────────────────────────────────────

export const TradingModeSchema = z.enum(["practice", "live"])

// ─── Save Credentials ───────────────────────────────────────────────────────

export const SaveCredentialsRequestSchema = z.object({
  mode: TradingModeSchema,
  accountId: z.string().trim().min(1, "Account ID is required"),
  token: z.string().trim().min(1, "API token is required").optional(),
})

// ─── TV Alerts Config (PUT) ─────────────────────────────────────────────────

export const TVAlertsConfigUpdateSchema = z
  .object({
    /** Special flag to regenerate webhook token (bypasses other fields) */
    regenerateToken: z.boolean().optional(),
    enabled: z.boolean().optional(),
    positionSizePercent: z
      .number()
      .min(0.1, "Must be at least 0.1")
      .max(100, "Must be at most 100")
      .optional(),
    cooldownSeconds: z
      .number()
      .int()
      .min(0, "Must be >= 0")
      .max(3600, "Must be at most 3600")
      .optional(),
    maxOpenPositions: z
      .number()
      .int()
      .min(1, "Must be at least 1")
      .max(100, "Must be at most 100")
      .optional(),
    dailyLossLimit: z.number().min(0, "Must be >= 0").optional(),
    pairWhitelist: z.array(z.string().trim()).optional(),
    marketHoursFilter: z.boolean().optional(),
    dedupWindowSeconds: z
      .number()
      .int()
      .min(1, "Must be at least 1")
      .max(60, "Must be at most 60")
      .optional(),
    showChartMarkers: z.boolean().optional(),
    soundEnabled: z.boolean().optional(),
    cfWorkerUrl: z.string().trim().optional(),
    cfWorkerSecret: z.string().trim().optional(),
  })
  .strict()

// ─── AI Settings (PUT) ─────────────────────────────────────────────────────

export const AiSettingsUpdateSchema = z
  .object({
    /** Special action to re-enable auto-analysis after auto-disable */
    action: z.literal("re-enable-auto").optional(),
    /** Set to a string to save, or null to delete */
    claudeApiKey: z.string().trim().min(1).nullable().optional(),
    /** Set to a string to save, or null to delete */
    finnhubApiKey: z.string().trim().min(1).nullable().optional(),
    /** Preferences to merge into auto-analysis JSON blob */
    preferences: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()

// ─── Create Condition (POST) ────────────────────────────────────────────────

export const TradeConditionTriggerTypeSchema = z.enum([
  "price_reaches",
  "price_breaks_above",
  "price_breaks_below",
  "pnl_pips",
  "pnl_currency",
  "time_reached",
  "duration_hours",
  "trailing_stop",
])

export const TradeConditionActionTypeSchema = z.enum([
  "close_trade",
  "partial_close",
  "move_stop_loss",
  "move_take_profit",
  "cancel_order",
  "notify",
])

export const CreateConditionSchema = z
  .object({
    triggerType: TradeConditionTriggerTypeSchema,
    triggerValue: z.record(z.string(), z.unknown()).refine((v) => Object.keys(v).length > 0, {
      message: "triggerValue must have at least one key",
    }),
    actionType: TradeConditionActionTypeSchema,
    actionParams: z.record(z.string(), z.unknown()).optional(),
    label: z.string().trim().max(200, "Label must be 200 characters or fewer").optional(),
    priority: z.number().int().min(0).max(100).optional(),
    expiresAt: z
      .string()
      .datetime({ message: "expiresAt must be a valid ISO 8601 datetime" })
      .optional(),
    analysisId: z.string().trim().optional(),
    parentConditionId: z.string().trim().optional(),
    status: z.enum(["active", "waiting"]).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    // Validate triggerValue has the required keys for each trigger type
    const tv = data.triggerValue as Record<string, unknown>
    switch (data.triggerType) {
      case "price_reaches":
      case "price_breaks_above":
      case "price_breaks_below":
        if (typeof tv.price !== "number" || tv.price <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `triggerValue.price must be a positive number for ${data.triggerType}`,
            path: ["triggerValue", "price"],
          })
        }
        break
      case "pnl_pips":
        if (typeof tv.pips !== "number") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "triggerValue.pips must be a number for pnl_pips",
            path: ["triggerValue", "pips"],
          })
        }
        break
      case "pnl_currency":
        if (typeof tv.amount !== "number") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "triggerValue.amount must be a number for pnl_currency",
            path: ["triggerValue", "amount"],
          })
        }
        break
      case "time_reached":
        if (typeof tv.datetime !== "string") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "triggerValue.datetime must be an ISO string for time_reached",
            path: ["triggerValue", "datetime"],
          })
        }
        break
      case "duration_hours":
        if (typeof tv.hours !== "number" || tv.hours <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "triggerValue.hours must be a positive number for duration_hours",
            path: ["triggerValue", "hours"],
          })
        }
        break
      case "trailing_stop":
        if (typeof tv.distancePips !== "number" || tv.distancePips <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "triggerValue.distancePips must be a positive number for trailing_stop",
            path: ["triggerValue", "distancePips"],
          })
        }
        break
    }

    // Validate actionParams for actions that require them
    const ap = data.actionParams as Record<string, unknown> | undefined
    switch (data.actionType) {
      case "partial_close":
        if (!ap || typeof ap.percent !== "number" || ap.percent <= 0 || ap.percent >= 100) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "actionParams.percent must be between 0 and 100 for partial_close",
            path: ["actionParams", "percent"],
          })
        }
        break
      case "move_stop_loss":
        if (!ap || typeof ap.price !== "number" || ap.price <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "actionParams.price must be a positive number for move_stop_loss",
            path: ["actionParams", "price"],
          })
        }
        break
      case "move_take_profit":
        if (!ap || typeof ap.price !== "number" || ap.price <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "actionParams.price must be a positive number for move_take_profit",
            path: ["actionParams", "price"],
          })
        }
        break
    }
  })

// ─── AI Condition Suggestion Validation ─────────────────────────────────────
// Used to validate condition suggestions from Claude output before creating conditions.

export const AiConditionSuggestionSchema = z.object({
  label: z.string().min(1),
  triggerType: TradeConditionTriggerTypeSchema,
  triggerValue: z.record(z.string(), z.unknown()).refine((v) => Object.keys(v).length > 0, {
    message: "triggerValue must have at least one key",
  }),
  actionType: TradeConditionActionTypeSchema,
  actionParams: z.record(z.string(), z.unknown()).default({}),
  confidence: z.enum(["high", "medium", "low"]).optional(),
  rationale: z.string().optional(),
})

// ─── Trade Finder Config (PUT) ──────────────────────────────────────────────

const TradeFinderPairConfigSchema = z.object({
  instrument: instrumentSchema,
  enabled: z.boolean(),
  timeframeSet: z.enum(["hourly", "daily", "weekly", "monthly"]),
  autoTradeEnabled: z.boolean().optional(),
})

export const TradeFinderConfigUpdateSchema = z
  .object({
    enabled: z.boolean().optional(),
    minScore: z.number().int().min(0).max(100).optional(),
    riskPercent: z
      .number()
      .min(0.01, "Must be at least 0.01")
      .max(10, "Must be at most 10")
      .optional(),
    maxEnabledPairs: z.number().int().min(1).max(50).optional(),
    pairs: z.array(TradeFinderPairConfigSchema).optional(),
    approachingAtrMultiple: z.number().min(0.1).max(10).optional(),
    autoTradeEnabled: z.boolean().optional(),
    autoTradeMinScore: z.number().int().min(0).max(100).optional(),
    autoTradeMaxConcurrent: z.number().int().min(1).max(20).optional(),
    autoTradeMaxDaily: z.number().int().min(0).max(50).optional(),
    autoTradeMaxRiskPercent: z.number().min(0.01).max(50).optional(),
    autoTradeMinRR: z.number().min(0.5).max(20).optional(),
    autoTradeCancelOnInvalidation: z.boolean().optional(),
    smartSizing: z.boolean().optional(),
    entryConfirmation: z.boolean().optional(),
    confirmationTimeout: z.number().int().min(1).max(20).optional(),
    breakevenEnabled: z.boolean().optional(),
    partialCloseEnabled: z.boolean().optional(),
    partialClosePercent: z.number().min(10).max(90).optional(),
    partialCloseRR: z.number().min(0.5).max(10).optional(),
    trailingStopEnabled: z.boolean().optional(),
    trailingStopCandles: z.number().int().min(1).max(20).optional(),
    timeExitEnabled: z.boolean().optional(),
    timeExitCandles: z.number().int().min(5).max(100).optional(),
  })
  .strict()

// ─── AI Trader Config (PUT) ─────────────────────────────────────────────────

const AiTraderOperatingModeSchema = z.enum(["manual", "semi_auto", "full_auto"])

const AiTraderProfileSchema = z.enum(["scalper", "intraday", "swing", "news"])

const AiTraderTechniqueSchema = z.enum([
  "smc_structure",
  "fair_value_gap",
  "order_block",
  "liquidity_sweep",
  "supply_demand_zone",
  "fibonacci_ote",
  "rsi",
  "macd",
  "ema_alignment",
  "bollinger_bands",
  "williams_r",
  "adx_regime",
  "divergence",
  "trend_detection",
])

const AiTraderManagementConfigSchema = z.object({
  breakevenEnabled: z.boolean().optional(),
  breakevenTriggerRR: z.number().min(0.1).max(10).optional(),
  trailingStopEnabled: z.boolean().optional(),
  trailingStopAtrMultiplier: z.number().min(0.5).max(10).optional(),
  partialCloseEnabled: z.boolean().optional(),
  partialClosePercent: z.number().min(1).max(99).optional(),
  partialCloseTargetRR: z.number().min(0.1).max(20).optional(),
  timeExitEnabled: z.boolean().optional(),
  timeExitHours: z.number().int().min(1).max(720).optional(),
  newsProtectionEnabled: z.boolean().optional(),
  reEvaluationEnabled: z.boolean().optional(),
  scaleInEnabled: z.boolean().optional(),
})

export const AiTraderConfigUpdateSchema = z
  .object({
    enabled: z.boolean().optional(),
    operatingMode: AiTraderOperatingModeSchema.optional(),
    scanIntervalMinutes: z.number().int().min(1).max(1440).optional(),
    confidenceThreshold: z.number().min(0).max(100).optional(),
    minimumConfidence: z.number().min(0).max(100).optional(),
    maxConcurrentTrades: z.number().int().min(1).max(50).optional(),
    pairWhitelist: z.array(z.string().trim()).optional(),
    enabledProfiles: z.record(AiTraderProfileSchema, z.boolean()).optional(),
    enabledTechniques: z.record(AiTraderTechniqueSchema, z.boolean()).optional(),
    managementConfig: AiTraderManagementConfigSchema.optional(),
    reEvalIntervalMinutes: z.number().int().min(1).max(1440).optional(),
    dailyBudgetUsd: z.number().min(0).max(1000).optional(),
    monthlyBudgetUsd: z.number().min(0).max(10000).optional(),
    scanModel: z.string().trim().min(1).optional(),
    decisionModel: z.string().trim().min(1).optional(),
    /** Set to a string to save, or null to delete an API key */
    fredApiKey: z.string().trim().min(1).nullable().optional(),
    alphaVantageApiKey: z.string().trim().min(1).nullable().optional(),
  })
  .strict()

// ─── Tags ───────────────────────────────────────────────────────────────────

export const TagCreateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Tag name is required")
      .max(50, "Tag name must be 50 characters or fewer"),
    color: hexColorSchema,
  })
  .strict()

// ─── Trade Update ───────────────────────────────────────────────────────────

export const TradeUpdateSchema = z
  .object({
    notes: z.string().max(5000, "Notes must be 5000 characters or fewer").nullable().optional(),
    timeframe: z.enum(["M1", "M5", "M15", "M30", "H1", "H4", "D", "W", "M"]).nullable().optional(),
  })
  .strict()

// ─── Test Signal ────────────────────────────────────────────────────────────

export const TestSignalSchema = z
  .object({
    action: z.enum(["buy", "sell"]),
    ticker: z.string().trim().min(1, "Ticker/instrument is required"),
  })
  .strict()

// ─── Update Trading Mode ────────────────────────────────────────────────────

export const UpdateTradingModeSchema = z
  .object({
    mode: TradingModeSchema,
  })
  .strict()

// ─── Inferred Types (for convenience) ───────────────────────────────────────

export type TVAlertsConfigUpdate = z.infer<typeof TVAlertsConfigUpdateSchema>
export type AiSettingsUpdate = z.infer<typeof AiSettingsUpdateSchema>
export type CreateConditionInput = z.infer<typeof CreateConditionSchema>
export type TradeFinderConfigUpdate = z.infer<typeof TradeFinderConfigUpdateSchema>
export type AiTraderConfigUpdate = z.infer<typeof AiTraderConfigUpdateSchema>
