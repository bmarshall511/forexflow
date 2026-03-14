import { describe, it, expect } from "vitest"
import {
  FxFlowError,
  OandaApiError,
  DbError,
  SignalError,
  AiError,
  ValidationError,
} from "./errors"

describe("FxFlowError", () => {
  it("should set name, message, and code", () => {
    const err = new FxFlowError("something broke", "GENERIC")
    expect(err.name).toBe("FxFlowError")
    expect(err.message).toBe("something broke")
    expect(err.code).toBe("GENERIC")
  })

  it("should be an instance of Error and FxFlowError", () => {
    const err = new FxFlowError("test", "CODE")
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(FxFlowError)
  })

  it("should store optional context", () => {
    const err = new FxFlowError("test", "CODE", { tradeId: "123" })
    expect(err.context).toEqual({ tradeId: "123" })
  })

  it("should have undefined context when not provided", () => {
    const err = new FxFlowError("test", "CODE")
    expect(err.context).toBeUndefined()
  })
})

describe("OandaApiError", () => {
  it("should set name and code", () => {
    const err = new OandaApiError("rate limited", 429)
    expect(err.name).toBe("OandaApiError")
    expect(err.code).toBe("OANDA_API_ERROR")
  })

  it("should store statusCode on the instance and in context", () => {
    const err = new OandaApiError("not found", 404)
    expect(err.statusCode).toBe(404)
    expect(err.context).toEqual({ statusCode: 404 })
  })

  it("should merge additional context with statusCode", () => {
    const err = new OandaApiError("fail", 500, { endpoint: "/trades" })
    expect(err.context).toEqual({ endpoint: "/trades", statusCode: 500 })
  })

  it("should be an instance of FxFlowError and Error", () => {
    const err = new OandaApiError("test")
    expect(err).toBeInstanceOf(FxFlowError)
    expect(err).toBeInstanceOf(Error)
  })
})

describe("DbError", () => {
  it("should set name and code", () => {
    const err = new DbError("connection failed")
    expect(err.name).toBe("DbError")
    expect(err.code).toBe("DB_ERROR")
  })

  it("should store context", () => {
    const err = new DbError("unique constraint", { table: "trades" })
    expect(err.context).toEqual({ table: "trades" })
  })

  it("should be an instance of FxFlowError", () => {
    expect(new DbError("test")).toBeInstanceOf(FxFlowError)
  })
})

describe("SignalError", () => {
  it("should set name and code", () => {
    const err = new SignalError("invalid payload")
    expect(err.name).toBe("SignalError")
    expect(err.code).toBe("SIGNAL_ERROR")
  })

  it("should be an instance of FxFlowError", () => {
    expect(new SignalError("test")).toBeInstanceOf(FxFlowError)
  })
})

describe("AiError", () => {
  it("should set name and code", () => {
    const err = new AiError("model unavailable")
    expect(err.name).toBe("AiError")
    expect(err.code).toBe("AI_ERROR")
  })

  it("should be an instance of FxFlowError", () => {
    expect(new AiError("test")).toBeInstanceOf(FxFlowError)
  })
})

describe("ValidationError", () => {
  it("should set name and code", () => {
    const err = new ValidationError("invalid input")
    expect(err.name).toBe("ValidationError")
    expect(err.code).toBe("VALIDATION_ERROR")
  })

  it("should store context with validation details", () => {
    const err = new ValidationError("bad field", { field: "units", value: -1 })
    expect(err.context).toEqual({ field: "units", value: -1 })
  })

  it("should be an instance of FxFlowError", () => {
    expect(new ValidationError("test")).toBeInstanceOf(FxFlowError)
  })
})

describe("error hierarchy catch patterns", () => {
  it("should catch all subtypes with FxFlowError", () => {
    const errors = [
      new OandaApiError("a", 500),
      new DbError("b"),
      new SignalError("c"),
      new AiError("d"),
      new ValidationError("e"),
    ]

    for (const err of errors) {
      expect(err).toBeInstanceOf(FxFlowError)
    }
  })
})
