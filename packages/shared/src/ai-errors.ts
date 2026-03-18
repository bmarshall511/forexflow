/**
 * Classify AI API errors into actionable categories.
 * Works with Anthropic SDK errors which have `status` and `error.type` properties.
 */

export type AiErrorCategory =
  | "quota_exceeded" // 402/403 — out of credits
  | "rate_limited" // 429 — too many requests
  | "overloaded" // 529 — API overloaded
  | "invalid_key" // 401 — bad API key
  | "context_too_long" // 400 — context length exceeded
  | "timeout" // Request timed out
  | "network" // Network/connection error
  | "unknown" // Unclassified error

export interface ClassifiedAiError {
  category: AiErrorCategory
  message: string // User-friendly message
  detail: string // Technical detail
  retryable: boolean // Whether retrying makes sense
  retryAfterMs?: number // Suggested retry delay
}

export function classifyAiError(error: unknown): ClassifiedAiError {
  const err = error as Record<string, unknown>
  const status = (err.status as number) ?? 0
  const message = (err.message as string) ?? String(error)
  const errorType = ((err.error as Record<string, unknown>)?.type as string) ?? ""

  // Anthropic SDK: 402/403 — quota/billing
  if (
    status === 402 ||
    status === 403 ||
    message.includes("credit") ||
    message.includes("quota") ||
    message.includes("billing") ||
    errorType === "insufficient_quota"
  ) {
    return {
      category: "quota_exceeded",
      message: "AI credits exhausted — check your Anthropic billing",
      detail: message,
      retryable: false,
    }
  }

  // 429 — rate limit
  if (status === 429 || errorType === "rate_limit_error" || message.includes("rate limit")) {
    const retryAfter = (err.headers as Record<string, string>)?.["retry-after"]
    return {
      category: "rate_limited",
      message: "AI is temporarily rate limited — will retry shortly",
      detail: message,
      retryable: true,
      retryAfterMs: retryAfter ? parseInt(retryAfter) * 1000 : 60_000,
    }
  }

  // 529 — overloaded
  if (status === 529 || errorType === "overloaded_error" || message.includes("overloaded")) {
    return {
      category: "overloaded",
      message: "Claude AI is temporarily overloaded — will retry in a moment",
      detail: message,
      retryable: true,
      retryAfterMs: 30_000,
    }
  }

  // 401 — authentication
  if (status === 401 || errorType === "authentication_error" || message.includes("api_key")) {
    return {
      category: "invalid_key",
      message: "Invalid Claude API key — check Settings > AI",
      detail: message,
      retryable: false,
    }
  }

  // 400 with context_length
  if (
    status === 400 &&
    (message.includes("context") || message.includes("too long") || message.includes("max_tokens"))
  ) {
    return {
      category: "context_too_long",
      message: "AI request was too large — trying with less data",
      detail: message,
      retryable: false,
    }
  }

  // Timeout
  if (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("ETIMEDOUT")
  ) {
    return {
      category: "timeout",
      message: "AI request timed out — will retry",
      detail: message,
      retryable: true,
      retryAfterMs: 5_000,
    }
  }

  // Network errors
  if (
    message.includes("ECONNREFUSED") ||
    message.includes("ENOTFOUND") ||
    message.includes("fetch failed") ||
    message.includes("network")
  ) {
    return {
      category: "network",
      message: "Cannot reach Claude AI — check your internet connection",
      detail: message,
      retryable: true,
      retryAfterMs: 10_000,
    }
  }

  return {
    category: "unknown",
    message: "AI encountered an unexpected error",
    detail: message,
    retryable: false,
  }
}
