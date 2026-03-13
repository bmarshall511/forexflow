import { describe, it, expect } from "vitest"
import { getPipSize, getDecimalPlaces, priceToPips, formatPips } from "./pip-utils"

describe("getPipSize", () => {
  it("should return 0.01 for JPY pairs", () => {
    expect(getPipSize("USD_JPY")).toBe(0.01)
    expect(getPipSize("EUR_JPY")).toBe(0.01)
    expect(getPipSize("GBP_JPY")).toBe(0.01)
  })

  it("should return 0.0001 for non-JPY pairs", () => {
    expect(getPipSize("EUR_USD")).toBe(0.0001)
    expect(getPipSize("GBP_USD")).toBe(0.0001)
    expect(getPipSize("AUD_USD")).toBe(0.0001)
  })
})

describe("getDecimalPlaces", () => {
  it("should return 3 for JPY pairs", () => {
    expect(getDecimalPlaces("USD_JPY")).toBe(3)
  })

  it("should return 5 for non-JPY pairs", () => {
    expect(getDecimalPlaces("EUR_USD")).toBe(5)
  })
})

describe("priceToPips", () => {
  it("should convert price distance to pips for standard pairs", () => {
    expect(priceToPips("EUR_USD", 0.0050)).toBeCloseTo(50)
  })

  it("should convert price distance to pips for JPY pairs", () => {
    expect(priceToPips("USD_JPY", 0.50)).toBeCloseTo(50)
  })

  it("should return absolute value regardless of sign", () => {
    expect(priceToPips("EUR_USD", -0.0025)).toBeCloseTo(25)
  })
})

describe("formatPips", () => {
  it("should format pips to one decimal place", () => {
    expect(formatPips(45.23)).toBe("45.2")
    expect(formatPips(0)).toBe("0.0")
    expect(formatPips(100)).toBe("100.0")
  })
})
