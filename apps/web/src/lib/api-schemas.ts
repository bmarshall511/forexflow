/**
 * Zod schemas for API route query parameter validation.
 *
 * Used with `parseSearchParams()` from `./api-validation` to replace
 * unsafe `as` type casts on URLSearchParams.
 *
 * @module api-schemas
 */
import { z } from "zod"

/** Coerce a string to a positive integer, or return undefined if not provided. */
const optionalPositiveInt = z
  .string()
  .transform((v) => parseInt(v, 10))
  .pipe(z.number().int().positive())
  .optional()

// ─── /api/trades ────────────────────────────────────────────────────────────

export const tradeListParamsSchema = z.object({
  status: z.enum(["pending", "open", "closed"]).optional(),
  instrument: z.string().optional(),
  direction: z.enum(["long", "short"]).optional(),
  outcome: z.enum(["win", "loss", "breakeven", "cancelled"]).optional(),
  from: z.string().datetime({ offset: true }).optional().or(z.string().date().optional()),
  to: z.string().datetime({ offset: true }).optional().or(z.string().date().optional()),
  tags: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  page: optionalPositiveInt,
  limit: optionalPositiveInt,
})

export type TradeListParams = z.infer<typeof tradeListParamsSchema>

// ─── /api/candles/[instrument] ──────────────────────────────────────────────

export const candleParamsSchema = z.object({
  granularity: z
    .enum([
      "S5",
      "S10",
      "S15",
      "S30",
      "M1",
      "M2",
      "M4",
      "M5",
      "M10",
      "M15",
      "M30",
      "H1",
      "H2",
      "H3",
      "H4",
      "H6",
      "H8",
      "H12",
      "D",
      "W",
      "M",
    ])
    .optional()
    .default("H1"),
  count: z
    .string()
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(1).max(5000))
    .optional()
    .default("100"),
  to: z.string().optional(),
})

export type CandleParams = z.infer<typeof candleParamsSchema>
