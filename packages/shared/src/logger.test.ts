import { describe, it, expect, vi, beforeEach } from "vitest"
import { Logger } from "./logger"

describe("Logger", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("should output JSON with level, msg, timestamp, and name", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {})
    const logger = new Logger("test-service")

    logger.info("hello")

    expect(spy).toHaveBeenCalledOnce()
    const entry = JSON.parse(spy.mock.calls[0]![0] as string)
    expect(entry.level).toBe("info")
    expect(entry.msg).toBe("hello")
    expect(entry.name).toBe("test-service")
    expect(entry.timestamp).toBeDefined()
  })

  it("should include additional data in the log entry", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {})
    const logger = new Logger("svc")

    logger.info("trade placed", { tradeId: "T1", units: 100 })

    const entry = JSON.parse(spy.mock.calls[0]![0] as string)
    expect(entry.tradeId).toBe("T1")
    expect(entry.units).toBe(100)
  })

  describe("log levels", () => {
    it("should call console.debug for debug level", () => {
      const spy = vi.spyOn(console, "debug").mockImplementation(() => {})
      new Logger("svc").debug("dbg msg")
      expect(spy).toHaveBeenCalledOnce()
      const entry = JSON.parse(spy.mock.calls[0]![0] as string)
      expect(entry.level).toBe("debug")
    })

    it("should call console.info for info level", () => {
      const spy = vi.spyOn(console, "info").mockImplementation(() => {})
      new Logger("svc").info("info msg")
      expect(spy).toHaveBeenCalledOnce()
    })

    it("should call console.warn for warn level", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {})
      new Logger("svc").warn("warn msg")
      expect(spy).toHaveBeenCalledOnce()
      const entry = JSON.parse(spy.mock.calls[0]![0] as string)
      expect(entry.level).toBe("warn")
    })

    it("should call console.error for error level", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {})
      new Logger("svc").error("err msg")
      expect(spy).toHaveBeenCalledOnce()
      const entry = JSON.parse(spy.mock.calls[0]![0] as string)
      expect(entry.level).toBe("error")
    })
  })

  describe("error method", () => {
    it("should extract message and stack from Error objects", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {})
      const logger = new Logger("svc")
      const cause = new Error("root cause")

      logger.error("operation failed", cause)

      const entry = JSON.parse(spy.mock.calls[0]![0] as string)
      expect(entry.error).toBe("root cause")
      expect(entry.stack).toBeDefined()
    })

    it("should extract code and context from FxFlowError-like objects", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {})
      const logger = new Logger("svc")
      const err = Object.assign(new Error("oops"), {
        code: "OANDA_API_ERROR",
        context: { statusCode: 429 },
      })

      logger.error("api failed", err)

      const entry = JSON.parse(spy.mock.calls[0]![0] as string)
      expect(entry.errorCode).toBe("OANDA_API_ERROR")
      expect(entry.errorContext).toEqual({ statusCode: 429 })
    })

    it("should stringify non-Error values", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {})
      const logger = new Logger("svc")

      logger.error("unexpected", "string error")

      const entry = JSON.parse(spy.mock.calls[0]![0] as string)
      expect(entry.error).toBe("string error")
    })

    it("should merge additional data with error data", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {})
      const logger = new Logger("svc")

      logger.error("failed", new Error("boom"), { tradeId: "T1" })

      const entry = JSON.parse(spy.mock.calls[0]![0] as string)
      expect(entry.error).toBe("boom")
      expect(entry.tradeId).toBe("T1")
    })

    it("should handle null and undefined error values gracefully", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {})
      const logger = new Logger("svc")

      logger.error("no error value", null)
      logger.error("undef error value", undefined)

      expect(spy).toHaveBeenCalledTimes(2)
      const entry1 = JSON.parse(spy.mock.calls[0]![0] as string)
      const entry2 = JSON.parse(spy.mock.calls[1]![0] as string)
      expect(entry1.error).toBeUndefined()
      expect(entry2.error).toBeUndefined()
    })
  })

  describe("child logger", () => {
    it("should inherit parent context and add new context", () => {
      const spy = vi.spyOn(console, "info").mockImplementation(() => {})
      const parent = new Logger("parent-svc", { requestId: "R1" })
      const child = parent.child({ tradeId: "T1" })

      child.info("child log")

      const entry = JSON.parse(spy.mock.calls[0]![0] as string)
      expect(entry.name).toBe("parent-svc")
      expect(entry.requestId).toBe("R1")
      expect(entry.tradeId).toBe("T1")
    })

    it("should allow child context to override parent context", () => {
      const spy = vi.spyOn(console, "info").mockImplementation(() => {})
      const parent = new Logger("svc", { component: "old" })
      const child = parent.child({ component: "new" })

      child.info("override test")

      const entry = JSON.parse(spy.mock.calls[0]![0] as string)
      expect(entry.component).toBe("new")
    })

    it("should not affect parent when child logs", () => {
      const parentSpy = vi.spyOn(console, "info").mockImplementation(() => {})
      const parent = new Logger("svc")
      const child = parent.child({ extra: true })

      parent.info("parent log")
      child.info("child log")

      const parentEntry = JSON.parse(parentSpy.mock.calls[0]![0] as string)
      expect(parentEntry.extra).toBeUndefined()
    })
  })

  describe("constructor context", () => {
    it("should include initial context in all log entries", () => {
      const spy = vi.spyOn(console, "info").mockImplementation(() => {})
      const logger = new Logger("svc", { env: "test", version: "1.0" })

      logger.info("boot")

      const entry = JSON.parse(spy.mock.calls[0]![0] as string)
      expect(entry.env).toBe("test")
      expect(entry.version).toBe("1.0")
    })
  })
})
