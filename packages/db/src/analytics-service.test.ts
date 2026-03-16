import { describe, it, expect, vi, beforeEach } from "vitest"

const mockTrade = vi.hoisted(() => ({
  findMany: vi.fn(),
}))

vi.mock("./client", () => ({
  db: {
    trade: mockTrade,
  },
}))

vi.mock("@fxflow/shared", () => ({
  getCurrentSession: vi.fn((date: Date) => {
    const h = date.getUTCHours()
    if (h >= 0 && h < 8) return { session: "Asian" }
    if (h >= 8 && h < 16) return { session: "London" }
    return { session: "New York" }
  }),
}))

import {
  getPerformanceSummary,
  getPerformanceByInstrument,
  getPerformanceBySession,
  getPerformanceByDayOfWeek,
  getPerformanceByHourOfDay,
  getPerformanceBySource,
  getMfeMaeDistribution,
  getEquityCurve,
} from "./analytics-service"

function makeTrade(
  overrides: Partial<{
    id: string
    source: string
    instrument: string
    direction: string
    realizedPL: number
    exitPrice: number | null
    mfe: number | null
    mae: number | null
    metadata: string | null
    openedAt: Date
    closedAt: Date | null
    stopLoss: number | null
    takeProfit: number | null
    entryPrice: number
  }> = {},
) {
  return {
    id: overrides.id ?? "t-1",
    source: overrides.source ?? "oanda",
    instrument: overrides.instrument ?? "EUR_USD",
    direction: overrides.direction ?? "long",
    realizedPL: overrides.realizedPL ?? 50,
    exitPrice: overrides.exitPrice ?? 1.11,
    mfe: overrides.mfe ?? 80,
    mae: overrides.mae ?? -20,
    metadata: overrides.metadata ?? null,
    openedAt: overrides.openedAt ?? new Date("2025-06-01T10:00:00Z"),
    closedAt: overrides.closedAt ?? new Date("2025-06-01T12:00:00Z"),
    stopLoss: overrides.stopLoss ?? 1.09,
    takeProfit: overrides.takeProfit ?? 1.12,
    entryPrice: overrides.entryPrice ?? 1.1,
  }
}

const winTrade = makeTrade({ id: "t-1", realizedPL: 100 })
const lossTrade = makeTrade({ id: "t-2", realizedPL: -40 })
const breakeven = makeTrade({ id: "t-3", realizedPL: 0, exitPrice: 1.1 })

describe("analytics-service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("getPerformanceSummary", () => {
    it("returns empty summary when no trades", async () => {
      mockTrade.findMany.mockResolvedValue([])

      const result = await getPerformanceSummary()

      expect(result.totalTrades).toBe(0)
      expect(result.wins).toBe(0)
      expect(result.losses).toBe(0)
      expect(result.winRate).toBe(0)
      expect(result.totalPL).toBe(0)
    })

    it("calculates correct summary for mixed trades", async () => {
      mockTrade.findMany.mockResolvedValue([winTrade, lossTrade, breakeven])

      const result = await getPerformanceSummary()

      expect(result.totalTrades).toBe(3)
      expect(result.wins).toBe(1)
      expect(result.losses).toBe(1)
      expect(result.breakevens).toBe(1)
      expect(result.winRate).toBeCloseTo(1 / 3)
      expect(result.totalPL).toBe(60) // 100 - 40 + 0
      expect(result.avgPL).toBe(20)
      expect(result.largestWin).toBe(100)
      expect(result.largestLoss).toBe(-40)
      expect(result.profitFactor).toBeCloseTo(2.5) // 100/40
    })

    it("passes date filters to Prisma query", async () => {
      mockTrade.findMany.mockResolvedValue([])
      const dateFrom = new Date("2025-01-01")
      const dateTo = new Date("2025-06-30")

      await getPerformanceSummary({ dateFrom, dateTo })

      expect(mockTrade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "closed",
            closedAt: { gte: dateFrom, lte: dateTo },
          }),
        }),
      )
    })

    it("passes instrument filter to Prisma query", async () => {
      mockTrade.findMany.mockResolvedValue([])

      await getPerformanceSummary({ instrument: "GBP_USD" })

      expect(mockTrade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ instrument: "GBP_USD" }),
        }),
      )
    })

    it("filters by enriched source client-side", async () => {
      const tvTrade = makeTrade({
        id: "t-tv",
        realizedPL: 50,
        metadata: JSON.stringify({ placedVia: "ut_bot_alerts" }),
      })
      const manualTrade = makeTrade({
        id: "t-manual",
        realizedPL: 30,
        metadata: JSON.stringify({ placedVia: "fxflow" }),
      })
      mockTrade.findMany.mockResolvedValue([tvTrade, manualTrade])

      const result = await getPerformanceSummary({ source: "ut_bot_alerts" })

      expect(result.totalTrades).toBe(1)
      expect(result.totalPL).toBe(50)
    })

    it("calculates profit factor as 999 when no losses", async () => {
      mockTrade.findMany.mockResolvedValue([winTrade])

      const result = await getPerformanceSummary()

      expect(result.profitFactor).toBe(999)
    })

    it("calculates streaks correctly", async () => {
      const trades = [
        makeTrade({ id: "1", realizedPL: 10, closedAt: new Date("2025-06-01T01:00:00Z") }),
        makeTrade({ id: "2", realizedPL: 20, closedAt: new Date("2025-06-01T02:00:00Z") }),
        makeTrade({ id: "3", realizedPL: -5, closedAt: new Date("2025-06-01T03:00:00Z") }),
      ]
      mockTrade.findMany.mockResolvedValue(trades)

      const result = await getPerformanceSummary()

      expect(result.longestWinStreak).toBe(2)
      expect(result.longestLossStreak).toBe(1)
      expect(result.currentStreak).toEqual({ type: "loss", count: 1 })
    })
  })

  describe("getPerformanceByInstrument", () => {
    it("groups trades by instrument", async () => {
      const eur = makeTrade({ id: "1", instrument: "EUR_USD", realizedPL: 50 })
      const gbp = makeTrade({ id: "2", instrument: "GBP_USD", realizedPL: -20 })
      mockTrade.findMany.mockResolvedValue([eur, gbp])

      const result = await getPerformanceByInstrument()

      expect(result).toHaveLength(2)
      const eurResult = result.find((r) => r.instrument === "EUR_USD")
      expect(eurResult).toBeDefined()
      expect(eurResult!.trades).toBe(1)
      expect(eurResult!.totalPL).toBe(50)
    })

    it("sorts by trade count descending", async () => {
      const trades = [
        makeTrade({ id: "1", instrument: "EUR_USD" }),
        makeTrade({ id: "2", instrument: "EUR_USD" }),
        makeTrade({ id: "3", instrument: "GBP_USD" }),
      ]
      mockTrade.findMany.mockResolvedValue(trades)

      const result = await getPerformanceByInstrument()

      expect(result[0]!.instrument).toBe("EUR_USD")
      expect(result[0]!.trades).toBe(2)
    })
  })

  describe("getPerformanceBySession", () => {
    it("groups trades by trading session", async () => {
      const londonTrade = makeTrade({ id: "1", openedAt: new Date("2025-06-01T10:00:00Z") })
      const asianTrade = makeTrade({ id: "2", openedAt: new Date("2025-06-01T03:00:00Z") })
      mockTrade.findMany.mockResolvedValue([londonTrade, asianTrade])

      const result = await getPerformanceBySession()

      expect(result).toHaveLength(2)
      const sessions = result.map((r) => r.session)
      expect(sessions).toContain("London")
      expect(sessions).toContain("Asian")
    })
  })

  describe("getPerformanceByDayOfWeek", () => {
    it("groups trades by UTC day and includes day name", async () => {
      // 2025-06-02 is a Monday (UTC)
      const monday = makeTrade({ id: "1", openedAt: new Date("2025-06-02T10:00:00Z") })
      mockTrade.findMany.mockResolvedValue([monday])

      const result = await getPerformanceByDayOfWeek()

      expect(result).toHaveLength(1)
      expect(result[0]!.dayName).toBe("Monday")
      expect(result[0]!.day).toBe(1)
    })

    it("sorts by day ascending", async () => {
      const fri = makeTrade({ id: "1", openedAt: new Date("2025-06-06T10:00:00Z") }) // Friday=5
      const mon = makeTrade({ id: "2", openedAt: new Date("2025-06-02T10:00:00Z") }) // Monday=1
      mockTrade.findMany.mockResolvedValue([fri, mon])

      const result = await getPerformanceByDayOfWeek()

      expect(result[0]!.day).toBeLessThan(result[1]!.day)
    })
  })

  describe("getPerformanceByHourOfDay", () => {
    it("groups trades by UTC hour", async () => {
      const h10 = makeTrade({ id: "1", openedAt: new Date("2025-06-01T10:00:00Z") })
      const h15 = makeTrade({ id: "2", openedAt: new Date("2025-06-01T15:30:00Z") })
      mockTrade.findMany.mockResolvedValue([h10, h15])

      const result = await getPerformanceByHourOfDay()

      expect(result).toHaveLength(2)
      expect(result[0]!.hour).toBe(10)
      expect(result[1]!.hour).toBe(15)
    })
  })

  describe("getPerformanceBySource", () => {
    it("enriches source from metadata and groups", async () => {
      const tvTrade = makeTrade({
        id: "1",
        metadata: JSON.stringify({ placedVia: "ut_bot_alerts" }),
        realizedPL: 50,
      })
      const manualTrade = makeTrade({
        id: "2",
        metadata: JSON.stringify({ placedVia: "fxflow" }),
        realizedPL: 30,
      })
      mockTrade.findMany.mockResolvedValue([tvTrade, manualTrade])

      const result = await getPerformanceBySource()

      expect(result).toHaveLength(2)
      const tvResult = result.find((r) => r.source === "ut_bot_alerts")
      expect(tvResult).toBeDefined()
      expect(tvResult!.sourceLabel).toBe("TradingView Alert")
      const manualResult = result.find((r) => r.source === "manual")
      expect(manualResult).toBeDefined()
      expect(manualResult!.sourceLabel).toBe("FXFlow")
    })

    it("falls back to raw source when no metadata", async () => {
      const trade = makeTrade({ id: "1", metadata: null })
      mockTrade.findMany.mockResolvedValue([trade])

      const result = await getPerformanceBySource()

      expect(result[0]!.source).toBe("oanda")
      expect(result[0]!.sourceLabel).toBe("OANDA")
    })
  })

  describe("getMfeMaeDistribution", () => {
    it("returns MFE/MAE entries for each trade", async () => {
      mockTrade.findMany.mockResolvedValue([winTrade, lossTrade])

      const result = await getMfeMaeDistribution()

      expect(result).toHaveLength(2)
      expect(result[0]!.tradeId).toBe("t-1")
      expect(result[0]!.outcome).toBe("win")
      expect(result[0]!.mfePips).toBe(80)
      expect(result[0]!.maePips).toBe(-20)
      expect(result[1]!.outcome).toBe("loss")
    })

    it("labels zero PL trades as breakeven", async () => {
      mockTrade.findMany.mockResolvedValue([breakeven])

      const result = await getMfeMaeDistribution()

      expect(result[0]!.outcome).toBe("breakeven")
    })

    it("calculates hold time in minutes", async () => {
      // 2 hours = 120 minutes
      mockTrade.findMany.mockResolvedValue([winTrade])

      const result = await getMfeMaeDistribution()

      expect(result[0]!.holdTimeMinutes).toBe(120)
    })
  })

  describe("getEquityCurve", () => {
    it("returns empty array when no trades", async () => {
      mockTrade.findMany.mockResolvedValue([])

      const result = await getEquityCurve()

      expect(result).toEqual([])
    })

    it("builds cumulative PL curve grouped by day", async () => {
      const day1 = makeTrade({
        id: "1",
        realizedPL: 100,
        closedAt: new Date("2025-06-01T10:00:00Z"),
      })
      const day1b = makeTrade({
        id: "2",
        realizedPL: -30,
        closedAt: new Date("2025-06-01T14:00:00Z"),
      })
      const day2 = makeTrade({
        id: "3",
        realizedPL: 50,
        closedAt: new Date("2025-06-02T09:00:00Z"),
      })
      mockTrade.findMany.mockResolvedValue([day1, day1b, day2])

      const result = await getEquityCurve()

      expect(result).toHaveLength(2)
      expect(result[0]!.date).toBe("2025-06-01")
      expect(result[0]!.cumulativePL).toBe(70) // 100 - 30
      expect(result[0]!.tradeCount).toBe(2)
      expect(result[1]!.date).toBe("2025-06-02")
      expect(result[1]!.cumulativePL).toBe(120) // 70 + 50
      expect(result[1]!.tradeCount).toBe(3)
    })
  })
})
