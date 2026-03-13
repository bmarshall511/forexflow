import { describe, it, expect } from "vitest"
import {
  isWeekendClosed,
  isRolloverWindow,
  isMarketExpectedOpen,
  getNextExpectedChange,
  formatCountdown,
  toET,
} from "./market-hours"

// Helper: create a Date for a specific ET time.
// During EST (Nov-Mar), ET = UTC-5.
// During EDT (Mar-Nov), ET = UTC-4.
// These tests use January dates (EST) for predictability.

// 2025-01-13 is a Monday (EST)
// 2025-01-17 is a Friday
// 2025-01-18 is a Saturday
// 2025-01-19 is a Sunday

function utcDate(iso: string): Date {
  return new Date(iso)
}

describe("toET", () => {
  it("converts UTC to ET components during EST", () => {
    // Wednesday Jan 15, 2025 at 3:00 PM UTC = 10:00 AM ET (EST, UTC-5)
    const et = toET(utcDate("2025-01-15T15:00:00Z"))
    expect(et.hour).toBe(10)
    expect(et.minute).toBe(0)
    expect(et.day).toBe(3) // Wednesday
  })

  it("converts UTC to ET components near midnight", () => {
    // Thursday Jan 16, 2025 at 2:30 AM UTC = 9:30 PM ET Wed (EST, UTC-5)
    const et = toET(utcDate("2025-01-16T02:30:00Z"))
    expect(et.hour).toBe(21)
    expect(et.minute).toBe(30)
    expect(et.day).toBe(3) // Still Wednesday in ET
  })
})

describe("isWeekendClosed", () => {
  it("returns true for Saturday", () => {
    // Saturday Jan 18, 2025 12:00 PM ET = 5:00 PM UTC
    expect(isWeekendClosed(utcDate("2025-01-18T17:00:00Z"))).toBe(true)
  })

  it("returns true for Friday at 5:00 PM ET exactly", () => {
    // Friday Jan 17, 2025 5:00 PM ET = 10:00 PM UTC
    expect(isWeekendClosed(utcDate("2025-01-17T22:00:00Z"))).toBe(true)
  })

  it("returns true for Friday at 11:00 PM ET", () => {
    // Friday Jan 17, 2025 11:00 PM ET = Sat Jan 18 4:00 AM UTC
    expect(isWeekendClosed(utcDate("2025-01-18T04:00:00Z"))).toBe(true)
  })

  it("returns true for Sunday at 2:00 PM ET", () => {
    // Sunday Jan 19, 2025 2:00 PM ET = 7:00 PM UTC
    expect(isWeekendClosed(utcDate("2025-01-19T19:00:00Z"))).toBe(true)
  })

  it("returns false for Friday at 4:58 PM ET", () => {
    // Friday Jan 17, 2025 4:58 PM ET = 9:58 PM UTC
    expect(isWeekendClosed(utcDate("2025-01-17T21:58:00Z"))).toBe(false)
  })

  it("returns false for Sunday at 5:00 PM ET exactly", () => {
    // Sunday Jan 19, 2025 5:00 PM ET = 10:00 PM UTC
    expect(isWeekendClosed(utcDate("2025-01-19T22:00:00Z"))).toBe(false)
  })

  it("returns false for Sunday at 6:00 PM ET", () => {
    // Sunday Jan 19, 2025 6:00 PM ET = 11:00 PM UTC
    expect(isWeekendClosed(utcDate("2025-01-19T23:00:00Z"))).toBe(false)
  })

  it("returns false for Wednesday midday", () => {
    // Wednesday Jan 15, 2025 12:00 PM ET = 5:00 PM UTC
    expect(isWeekendClosed(utcDate("2025-01-15T17:00:00Z"))).toBe(false)
  })
})

describe("isRolloverWindow", () => {
  it("returns true for 4:59 PM ET on Tuesday", () => {
    // Tuesday Jan 14, 2025 4:59 PM ET = 9:59 PM UTC
    expect(isRolloverWindow(utcDate("2025-01-14T21:59:00Z"))).toBe(true)
  })

  it("returns true for 5:00 PM ET on Tuesday", () => {
    // Tuesday Jan 14, 2025 5:00 PM ET = 10:00 PM UTC
    expect(isRolloverWindow(utcDate("2025-01-14T22:00:00Z"))).toBe(true)
  })

  it("returns true for 5:04 PM ET on Tuesday", () => {
    // Tuesday Jan 14, 2025 5:04 PM ET = 10:04 PM UTC
    expect(isRolloverWindow(utcDate("2025-01-14T22:04:00Z"))).toBe(true)
  })

  it("returns false for 5:05 PM ET on Tuesday", () => {
    // Tuesday Jan 14, 2025 5:05 PM ET = 10:05 PM UTC
    expect(isRolloverWindow(utcDate("2025-01-14T22:05:00Z"))).toBe(false)
  })

  it("returns false for 5:06 PM ET on Tuesday", () => {
    // Tuesday Jan 14, 2025 5:06 PM ET = 10:06 PM UTC
    expect(isRolloverWindow(utcDate("2025-01-14T22:06:00Z"))).toBe(false)
  })

  it("returns false for 4:58 PM ET on Tuesday", () => {
    // Tuesday Jan 14, 2025 4:58 PM ET = 9:58 PM UTC
    expect(isRolloverWindow(utcDate("2025-01-14T21:58:00Z"))).toBe(false)
  })

  it("returns false during weekend even at rollover time", () => {
    // Saturday Jan 18, 2025 5:00 PM ET = 10:00 PM UTC
    // Weekend takes priority over rollover
    expect(isRolloverWindow(utcDate("2025-01-18T22:00:00Z"))).toBe(false)
  })

  it("returns false during Friday weekend close even at rollover time", () => {
    // Friday Jan 17, 2025 5:00 PM ET = 10:00 PM UTC
    // This is technically rollover time but isWeekendClosed returns true
    expect(isRolloverWindow(utcDate("2025-01-17T22:00:00Z"))).toBe(false)
  })
})

describe("isMarketExpectedOpen", () => {
  it("returns true during normal Wednesday trading hours", () => {
    // Wednesday Jan 15, 2025 10:00 AM ET = 3:00 PM UTC
    expect(isMarketExpectedOpen(utcDate("2025-01-15T15:00:00Z"))).toBe(true)
  })

  it("returns true on Monday 9:00 AM ET", () => {
    // Monday Jan 13, 2025 9:00 AM ET = 2:00 PM UTC
    expect(isMarketExpectedOpen(utcDate("2025-01-13T14:00:00Z"))).toBe(true)
  })

  it("returns false during weekend (Saturday)", () => {
    expect(isMarketExpectedOpen(utcDate("2025-01-18T17:00:00Z"))).toBe(false)
  })

  it("returns false during rollover window", () => {
    // Tuesday Jan 14, 2025 5:01 PM ET = 10:01 PM UTC
    expect(isMarketExpectedOpen(utcDate("2025-01-14T22:01:00Z"))).toBe(false)
  })

  it("returns true on Sunday after 5:05 PM ET", () => {
    // Sunday Jan 19, 2025 5:10 PM ET = 10:10 PM UTC
    expect(isMarketExpectedOpen(utcDate("2025-01-19T22:10:00Z"))).toBe(true)
  })

  it("returns false on Sunday at 4:59 PM ET (before market opens)", () => {
    // Sunday Jan 19, 2025 4:59 PM ET = 9:59 PM UTC
    expect(isMarketExpectedOpen(utcDate("2025-01-19T21:59:00Z"))).toBe(false)
  })

  it("returns true on Friday 4:58 PM ET (before close)", () => {
    // Friday Jan 17, 2025 4:58 PM ET = 9:58 PM UTC
    expect(isMarketExpectedOpen(utcDate("2025-01-17T21:58:00Z"))).toBe(true)
  })
})

describe("getNextExpectedChange", () => {
  it("returns next rollover when market is open mid-week", () => {
    // Wednesday Jan 15, 2025 10:00 AM ET = 3:00 PM UTC
    // Next change should be today's rollover at 4:59 PM ET = 9:59 PM UTC
    const next = getNextExpectedChange(utcDate("2025-01-15T15:00:00Z"))
    expect(next.toISOString()).toBe("2025-01-15T21:59:00.000Z")
  })

  it("returns Sunday 5PM when in weekend (Saturday)", () => {
    // Saturday Jan 18, 2025 12:00 PM ET = 5:00 PM UTC
    // Next open = Sunday Jan 19 5:00 PM ET = 10:00 PM UTC
    const next = getNextExpectedChange(utcDate("2025-01-18T17:00:00Z"))
    expect(next.toISOString()).toBe("2025-01-19T22:00:00.000Z")
  })

  it("returns rollover end when in rollover window", () => {
    // Tuesday Jan 14, 2025 5:01 PM ET = 10:01 PM UTC
    // Rollover ends at 5:05 PM ET = 10:05 PM UTC
    const next = getNextExpectedChange(utcDate("2025-01-14T22:01:00Z"))
    expect(next.toISOString()).toBe("2025-01-14T22:05:00.000Z")
  })

  it("returns Friday 5PM when currently Friday before close", () => {
    // Friday Jan 17, 2025 2:00 PM ET = 7:00 PM UTC
    // Next close = Friday 5:00 PM ET = 10:00 PM UTC
    const next = getNextExpectedChange(utcDate("2025-01-17T19:00:00Z"))
    expect(next.toISOString()).toBe("2025-01-17T22:00:00.000Z")
  })

  it("returns tomorrow rollover when past today's rollover", () => {
    // Wednesday Jan 15, 2025 5:30 PM ET = 10:30 PM UTC
    // Past rollover, next = Thursday 4:59 PM ET = 9:59 PM UTC
    const next = getNextExpectedChange(utcDate("2025-01-15T22:30:00Z"))
    expect(next.toISOString()).toBe("2025-01-16T21:59:00.000Z")
  })
})

describe("formatCountdown", () => {
  it("formats hours-minutes-seconds correctly", () => {
    const now = new Date("2025-01-15T12:00:00Z")
    const target = new Date("2025-01-15T13:30:45Z")
    expect(formatCountdown(now, target)).toBe("01:30:45")
  })

  it("includes day count when more than 24 hours", () => {
    const now = new Date("2025-01-15T12:00:00Z")
    const target = new Date("2025-01-17T14:30:45Z")
    expect(formatCountdown(now, target)).toBe("2d 02:30:45")
  })

  it("returns 00:00:00 when target is in the past", () => {
    const now = new Date("2025-01-15T14:00:00Z")
    const target = new Date("2025-01-15T12:00:00Z")
    expect(formatCountdown(now, target)).toBe("00:00:00")
  })

  it("handles exactly 1 day difference", () => {
    const now = new Date("2025-01-15T12:00:00Z")
    const target = new Date("2025-01-16T12:00:00Z")
    expect(formatCountdown(now, target)).toBe("1d 00:00:00")
  })

  it("handles zero difference", () => {
    const now = new Date("2025-01-15T12:00:00Z")
    expect(formatCountdown(now, now)).toBe("00:00:00")
  })
})
