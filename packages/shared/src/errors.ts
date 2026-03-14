/**
 * Structured error types for FXFlow.
 * All errors extend FxFlowError for consistent catch-block handling.
 */

export class FxFlowError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message)
    this.name = "FxFlowError"
  }
}

export class OandaApiError extends FxFlowError {
  constructor(
    message: string,
    public readonly statusCode?: number,
    context?: Record<string, unknown>,
  ) {
    super(message, "OANDA_API_ERROR", { ...context, statusCode })
    this.name = "OandaApiError"
  }
}

export class DbError extends FxFlowError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "DB_ERROR", context)
    this.name = "DbError"
  }
}

export class SignalError extends FxFlowError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "SIGNAL_ERROR", context)
    this.name = "SignalError"
  }
}

export class AiError extends FxFlowError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "AI_ERROR", context)
    this.name = "AiError"
  }
}

export class ValidationError extends FxFlowError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "VALIDATION_ERROR", context)
    this.name = "ValidationError"
  }
}
