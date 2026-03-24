import { z } from "zod"

/**
 * Zod schema for TradingView webhook payloads.
 * Validates and coerces raw JSON into a normalized shape before further processing.
 */
export const webhookPayloadSchema = z.object({
  /** Trade direction — required */
  action: z
    .string()
    .transform((v) => v.toLowerCase())
    .pipe(z.enum(["buy", "sell"])),

  /** TradingView ticker symbol — required, non-empty */
  ticker: z.string().min(1, "ticker is required"),

  /** Signal price — TradingView may send as string or number */
  price: z
    .union([z.number(), z.string().transform((v) => parseFloat(v))])
    .optional()
    .pipe(z.number().positive().optional().catch(undefined)),

  /** Alias for price — TradingView {{close}} variable */
  close: z
    .union([z.number(), z.string().transform((v) => parseFloat(v))])
    .optional()
    .pipe(z.number().positive().optional().catch(undefined)),

  /** Exchange prefix (e.g., "FX", "OANDA") */
  exchange: z.string().optional(),

  /** Chart timeframe — may arrive as number (e.g., 15) or string (e.g., "D") */
  interval: z.union([z.number().transform(String), z.string()]).optional(),

  /** ISO timestamp from TradingView */
  time: z.string().optional(),

  /** Optional auth token embedded in payload */
  token: z.string().optional(),
})

export type WebhookPayloadInput = z.input<typeof webhookPayloadSchema>
export type WebhookPayloadParsed = z.output<typeof webhookPayloadSchema>
