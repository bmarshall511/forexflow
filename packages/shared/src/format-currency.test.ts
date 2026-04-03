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

  it("should round to two decimal places for normal amounts", () => {
    expect(formatCurrency(99.999)).toBe("$100.00")
  })

  it("should use 4 decimals for sub-cent amounts", () => {
    expect(formatCurrency(0.0006)).toBe("$0.0006")
    expect(formatCurrency(-0.0042)).toBe("-$0.0042")
    expect(formatCurrency(0.0099)).toBe("$0.0099")
  })

  it("should use 2 decimals for values >= $0.01", () => {
    expect(formatCurrency(0.01)).toBe("$0.01")
    expect(formatCurrency(0.05)).toBe("$0.05")
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

  it("should return neutral intent for zero", () => {
    const result = formatPnL(0)
    expect(result.formatted).toBe("$0.00")
    expect(result.colorIntent).toBe("neutral")
  })

  it("should show direction for sub-cent amounts", () => {
    const pos = formatPnL(0.0006)
    expect(pos.colorIntent).toBe("positive")
    expect(pos.formatted).toBe("+$0.0006")

    const neg = formatPnL(-0.004)
    expect(neg.colorIntent).toBe("negative")
    expect(neg.formatted).toBe("-$0.0040")
  })

  it("should support non-USD currencies", () => {
    const result = formatPnL(500, "EUR")
    expect(result.formatted).toBe("+€500.00")
    expect(result.colorIntent).toBe("positive")
  })
})
