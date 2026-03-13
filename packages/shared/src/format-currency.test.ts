import { describe, it, expect } from "vitest"
import { formatCurrency, formatPnL } from "./format-currency"

describe("formatCurrency", () => {
  it("should format USD by default", () => {
    expect(formatCurrency(1234.56)).toBe("$1,234.56")
  })

  it("should format with specified currency", () => {
    expect(formatCurrency(1234.56, "EUR")).toBe("€1,234.56")
    expect(formatCurrency(1234.56, "GBP")).toBe("£1,234.56")
  })

  it("should format zero", () => {
    expect(formatCurrency(0)).toBe("$0.00")
  })

  it("should format negative values", () => {
    expect(formatCurrency(-500.5)).toBe("-$500.50")
  })

  it("should round to two decimal places", () => {
    expect(formatCurrency(99.999)).toBe("$100.00")
  })
})

describe("formatPnL", () => {
  it("should return positive intent with + prefix for gains", () => {
    const result = formatPnL(1234.56)
    expect(result.formatted).toBe("+$1,234.56")
    expect(result.colorIntent).toBe("positive")
  })

  it("should return negative intent with - prefix for losses", () => {
    const result = formatPnL(-789)
    expect(result.formatted).toBe("-$789.00")
    expect(result.colorIntent).toBe("negative")
  })

  it("should return neutral intent for near-zero values", () => {
    const result = formatPnL(0)
    expect(result.formatted).toBe("$0.00")
    expect(result.colorIntent).toBe("neutral")
  })

  it("should treat values within ±0.005 as neutral", () => {
    expect(formatPnL(0.004).colorIntent).toBe("neutral")
    expect(formatPnL(-0.004).colorIntent).toBe("neutral")
  })

  it("should support non-USD currencies", () => {
    const result = formatPnL(500, "EUR")
    expect(result.formatted).toBe("+€500.00")
    expect(result.colorIntent).toBe("positive")
  })
})
