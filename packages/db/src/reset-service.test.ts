import { describe, it, expect, vi, beforeEach } from "vitest"

const mockTrade = vi.hoisted(() => ({ count: vi.fn(), deleteMany: vi.fn() }))
const mockTradeEvent = vi.hoisted(() => ({ count: vi.fn(), deleteMany: vi.fn() }))
const mockTag = vi.hoisted(() => ({ count: vi.fn(), deleteMany: vi.fn() }))
const mockTradeTag = vi.hoisted(() => ({ count: vi.fn(), deleteMany: vi.fn() }))
const mockTVAlertSignal = vi.hoisted(() => ({ count: vi.fn(), deleteMany: vi.fn() }))
const mockSignalAuditEvent = vi.hoisted(() => ({ count: vi.fn(), deleteMany: vi.fn() }))
const mockAiAnalysis = vi.hoisted(() => ({ count: vi.fn(), deleteMany: vi.fn() }))
const mockTradeCondition = vi.hoisted(() => ({ count: vi.fn(), deleteMany: vi.fn() }))
const mockAiRecommendationOutcome = vi.hoisted(() => ({ count: vi.fn(), deleteMany: vi.fn() }))
const mockAiDigest = vi.hoisted(() => ({ count: vi.fn(), deleteMany: vi.fn() }))
const mockAiTraderOpportunity = vi.hoisted(() => ({ count: vi.fn(), deleteMany: vi.fn() }))
const mockAiTraderMarketData = vi.hoisted(() => ({ count: vi.fn(), deleteMany: vi.fn() }))
const mockAiTraderStrategyPerformance = vi.hoisted(() => ({ count: vi.fn(), deleteMany: vi.fn() }))
const mockTradeFinderSetup = vi.hoisted(() => ({ count: vi.fn(), deleteMany: vi.fn() }))
const mockSupplyDemandZone = vi.hoisted(() => ({ count: vi.fn(), deleteMany: vi.fn() }))
const mockDetectedTrend = vi.hoisted(() => ({ count: vi.fn(), deleteMany: vi.fn() }))
const mockCurveSnapshot = vi.hoisted(() => ({ count: vi.fn(), deleteMany: vi.fn() }))
const mockNotification = vi.hoisted(() => ({ count: vi.fn(), deleteMany: vi.fn() }))
const mockChartLayout = vi.hoisted(() => ({ count: vi.fn(), deleteMany: vi.fn() }))
const mockSettings = vi.hoisted(() => ({ deleteMany: vi.fn() }))
const mockTVAlertsConfig = vi.hoisted(() => ({ deleteMany: vi.fn(), findFirst: vi.fn() }))
const mockAiSettings = vi.hoisted(() => ({ deleteMany: vi.fn() }))
const mockTradeFinderConfig = vi.hoisted(() => ({ deleteMany: vi.fn(), findFirst: vi.fn() }))
const mockAiTraderConfig = vi.hoisted(() => ({ deleteMany: vi.fn(), findFirst: vi.fn() }))
const mockZoneSettings = vi.hoisted(() => ({ deleteMany: vi.fn() }))
const mockTrendSettings = vi.hoisted(() => ({ deleteMany: vi.fn() }))
const mock$transaction = vi.hoisted(() => vi.fn())
const mock$disconnect = vi.hoisted(() => vi.fn())

vi.mock("./client", () => ({
  db: {
    trade: mockTrade,
    tradeEvent: mockTradeEvent,
    tag: mockTag,
    tradeTag: mockTradeTag,
    tVAlertSignal: mockTVAlertSignal,
    signalAuditEvent: mockSignalAuditEvent,
    aiAnalysis: mockAiAnalysis,
    tradeCondition: mockTradeCondition,
    aiRecommendationOutcome: mockAiRecommendationOutcome,
    aiDigest: mockAiDigest,
    aiTraderOpportunity: mockAiTraderOpportunity,
    aiTraderMarketData: mockAiTraderMarketData,
    aiTraderStrategyPerformance: mockAiTraderStrategyPerformance,
    tradeFinderSetup: mockTradeFinderSetup,
    supplyDemandZone: mockSupplyDemandZone,
    detectedTrend: mockDetectedTrend,
    curveSnapshot: mockCurveSnapshot,
    notification: mockNotification,
    chartLayout: mockChartLayout,
    settings: mockSettings,
    tVAlertsConfig: mockTVAlertsConfig,
    aiSettings: mockAiSettings,
    tradeFinderConfig: mockTradeFinderConfig,
    aiTraderConfig: mockAiTraderConfig,
    zoneSettings: mockZoneSettings,
    trendSettings: mockTrendSettings,
    $transaction: mock$transaction,
    $disconnect: mock$disconnect,
  },
}))

import {
  getResetPreflightStatus,
  getModuleDataCounts,
  resetModule,
  resetTradingData,
  resetFactory,
  getDatabasePath,
} from "./reset-service"

describe("reset-service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("getModuleDataCounts", () => {
    it("returns counts for all modules", async () => {
      // trading_history
      mockTrade.count.mockResolvedValue(10)
      mockTradeEvent.count.mockResolvedValue(5)
      mockTag.count.mockResolvedValue(3)
      mockTradeTag.count.mockResolvedValue(7)
      // tv_alerts
      mockTVAlertSignal.count.mockResolvedValue(20)
      mockSignalAuditEvent.count.mockResolvedValue(15)
      // ai_analysis
      mockAiAnalysis.count.mockResolvedValue(4)
      mockTradeCondition.count.mockResolvedValue(2)
      mockAiRecommendationOutcome.count.mockResolvedValue(1)
      mockAiDigest.count.mockResolvedValue(3)
      // ai_trader
      mockAiTraderOpportunity.count.mockResolvedValue(8)
      mockAiTraderMarketData.count.mockResolvedValue(6)
      mockAiTraderStrategyPerformance.count.mockResolvedValue(2)
      // trade_finder
      mockTradeFinderSetup.count.mockResolvedValue(12)
      // technical_data
      mockSupplyDemandZone.count.mockResolvedValue(30)
      mockDetectedTrend.count.mockResolvedValue(10)
      mockCurveSnapshot.count.mockResolvedValue(5)
      // notifications
      mockNotification.count.mockResolvedValue(50)
      // chart_state
      mockChartLayout.count.mockResolvedValue(2)

      const counts = await getModuleDataCounts()

      expect(counts.trading_history).toBe(25) // 10+5+3+7
      expect(counts.tv_alerts).toBe(35) // 20+15
      expect(counts.ai_analysis).toBe(10) // 4+2+1+3
      expect(counts.ai_trader).toBe(16) // 8+6+2
      expect(counts.trade_finder).toBe(12)
      expect(counts.technical_data).toBe(45) // 30+10+5
      expect(counts.notifications).toBe(50)
      expect(counts.chart_state).toBe(2)
    })
  })

  describe("getResetPreflightStatus", () => {
    it("returns open trades, pending orders, running analyses, and module counts", async () => {
      mockTrade.count
        .mockResolvedValueOnce(3) // open trades
        .mockResolvedValueOnce(1) // pending orders
        // also called by getModuleDataCounts for trading_history
        .mockResolvedValueOnce(10)
      mockAiAnalysis.count
        .mockResolvedValueOnce(2) // running analyses
        .mockResolvedValueOnce(4) // ai_analysis count
      mockTradeCondition.count
        .mockResolvedValueOnce(1) // active conditions
        .mockResolvedValueOnce(2) // ai_analysis count
      // Remaining count mocks for module counts
      mockTradeEvent.count.mockResolvedValue(0)
      mockTag.count.mockResolvedValue(0)
      mockTradeTag.count.mockResolvedValue(0)
      mockTVAlertSignal.count.mockResolvedValue(0)
      mockSignalAuditEvent.count.mockResolvedValue(0)
      mockAiRecommendationOutcome.count.mockResolvedValue(0)
      mockAiDigest.count.mockResolvedValue(0)
      mockAiTraderOpportunity.count.mockResolvedValue(0)
      mockAiTraderMarketData.count.mockResolvedValue(0)
      mockAiTraderStrategyPerformance.count.mockResolvedValue(0)
      mockTradeFinderSetup.count.mockResolvedValue(0)
      mockSupplyDemandZone.count.mockResolvedValue(0)
      mockDetectedTrend.count.mockResolvedValue(0)
      mockCurveSnapshot.count.mockResolvedValue(0)
      mockNotification.count.mockResolvedValue(0)
      mockChartLayout.count.mockResolvedValue(0)
      mockTVAlertsConfig.findFirst.mockResolvedValue({ enabled: true })
      mockTradeFinderConfig.findFirst.mockResolvedValue({ autoTradeEnabled: false })
      mockAiTraderConfig.findFirst.mockResolvedValue({ enabled: true })

      const status = await getResetPreflightStatus()

      expect(status.openTrades).toBe(3)
      expect(status.pendingOrders).toBe(1)
      expect(status.runningAnalyses).toBe(2)
      expect(status.activeConditions).toBe(1)
      expect(status.automation).toEqual({
        tvAlertsEnabled: true,
        autoTradeEnabled: false,
        aiTraderEnabled: true,
      })
      expect(status.moduleCounts).toBeDefined()
    })
  })

  describe("resetModule", () => {
    it("resets trading_history via transaction", async () => {
      mock$transaction.mockResolvedValue([
        { count: 5 },
        { count: 10 },
        { count: 2 },
        { count: 1 },
        { count: 3 },
        { count: 20 },
        { count: 4 },
      ])

      const result = await resetModule("trading_history")

      expect(result.deleted).toBe(45) // 5+10+2+1+3+20+4
      expect(mock$transaction).toHaveBeenCalledOnce()
    })

    it("resets tv_alerts via transaction", async () => {
      mock$transaction.mockResolvedValue([{ count: 15 }, { count: 20 }])

      const result = await resetModule("tv_alerts")
      expect(result.deleted).toBe(35)
    })

    it("resets ai_analysis via transaction", async () => {
      mock$transaction.mockResolvedValue([{ count: 2 }, { count: 1 }, { count: 4 }, { count: 3 }])

      const result = await resetModule("ai_analysis")
      expect(result.deleted).toBe(10)
    })

    it("resets ai_trader via transaction", async () => {
      mock$transaction.mockResolvedValue([{ count: 8 }, { count: 6 }, { count: 2 }])

      const result = await resetModule("ai_trader")
      expect(result.deleted).toBe(16)
    })

    it("resets trade_finder directly", async () => {
      mockTradeFinderSetup.deleteMany.mockResolvedValue({ count: 12 })

      const result = await resetModule("trade_finder")
      expect(result.deleted).toBe(12)
    })

    it("resets technical_data via transaction", async () => {
      mock$transaction.mockResolvedValue([{ count: 30 }, { count: 10 }, { count: 5 }])

      const result = await resetModule("technical_data")
      expect(result.deleted).toBe(45)
    })

    it("resets notifications directly", async () => {
      mockNotification.deleteMany.mockResolvedValue({ count: 50 })

      const result = await resetModule("notifications")
      expect(result.deleted).toBe(50)
    })

    it("resets chart_state directly", async () => {
      mockChartLayout.deleteMany.mockResolvedValue({ count: 2 })

      const result = await resetModule("chart_state")
      expect(result.deleted).toBe(2)
    })
  })

  describe("resetTradingData", () => {
    it("resets all modules and reports success", async () => {
      // Each module reset call
      mock$transaction
        .mockResolvedValueOnce([
          { count: 1 },
          { count: 1 },
          { count: 1 },
          { count: 1 },
          { count: 1 },
          { count: 1 },
          { count: 1 },
        ]) // trading_history
        .mockResolvedValueOnce([{ count: 1 }, { count: 1 }]) // tv_alerts
        .mockResolvedValueOnce([{ count: 1 }, { count: 1 }, { count: 1 }, { count: 1 }]) // ai_analysis
        .mockResolvedValueOnce([{ count: 1 }, { count: 1 }, { count: 1 }]) // ai_trader
      mockTradeFinderSetup.deleteMany.mockResolvedValue({ count: 1 }) // trade_finder
      mock$transaction.mockResolvedValueOnce([{ count: 1 }, { count: 1 }, { count: 1 }]) // technical_data
      mockNotification.deleteMany.mockResolvedValue({ count: 1 }) // notifications
      mockChartLayout.deleteMany.mockResolvedValue({ count: 1 }) // chart_state

      const result = await resetTradingData()

      expect(result.success).toBe(true)
      expect(result.modulesReset).toHaveLength(8)
      expect(result.errors).toHaveLength(0)
      expect(result.recordsDeleted).toBeGreaterThan(0)
    })

    it("captures errors without stopping other modules", async () => {
      mock$transaction.mockRejectedValueOnce(new Error("DB locked"))
      // Remaining modules succeed
      mock$transaction
        .mockResolvedValueOnce([{ count: 1 }, { count: 1 }]) // tv_alerts
        .mockResolvedValueOnce([{ count: 1 }, { count: 1 }, { count: 1 }, { count: 1 }]) // ai_analysis
        .mockResolvedValueOnce([{ count: 1 }, { count: 1 }, { count: 1 }]) // ai_trader
      mockTradeFinderSetup.deleteMany.mockResolvedValue({ count: 1 })
      mock$transaction.mockResolvedValueOnce([{ count: 1 }, { count: 1 }, { count: 1 }]) // technical_data
      mockNotification.deleteMany.mockResolvedValue({ count: 1 })
      mockChartLayout.deleteMany.mockResolvedValue({ count: 1 })

      const result = await resetTradingData()

      expect(result.success).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain("trading_history")
      expect(result.modulesReset).toHaveLength(7)
    })
  })

  describe("resetFactory", () => {
    it("resets all data and config tables", async () => {
      // Data modules
      mock$transaction
        .mockResolvedValueOnce([
          { count: 0 },
          { count: 0 },
          { count: 0 },
          { count: 0 },
          { count: 0 },
          { count: 0 },
          { count: 0 },
        ])
        .mockResolvedValueOnce([{ count: 0 }, { count: 0 }])
        .mockResolvedValueOnce([{ count: 0 }, { count: 0 }, { count: 0 }, { count: 0 }])
        .mockResolvedValueOnce([{ count: 0 }, { count: 0 }, { count: 0 }])
      mockTradeFinderSetup.deleteMany.mockResolvedValue({ count: 0 })
      mock$transaction.mockResolvedValueOnce([{ count: 0 }, { count: 0 }, { count: 0 }])
      mockNotification.deleteMany.mockResolvedValue({ count: 0 })
      mockChartLayout.deleteMany.mockResolvedValue({ count: 0 })

      // Config tables
      mockSettings.deleteMany.mockResolvedValue({ count: 1 })
      mockTVAlertsConfig.deleteMany.mockResolvedValue({ count: 1 })
      mockAiSettings.deleteMany.mockResolvedValue({ count: 1 })
      mockTradeFinderConfig.deleteMany.mockResolvedValue({ count: 1 })
      mockAiTraderConfig.deleteMany.mockResolvedValue({ count: 1 })
      mockZoneSettings.deleteMany.mockResolvedValue({ count: 1 })
      mockTrendSettings.deleteMany.mockResolvedValue({ count: 1 })

      const result = await resetFactory()

      expect(result.success).toBe(true)
      expect(result.modulesReset).toHaveLength(8)
      expect(result.recordsDeleted).toBe(7) // 7 config tables
      expect(mockSettings.deleteMany).toHaveBeenCalledOnce()
      expect(mockAiTraderConfig.deleteMany).toHaveBeenCalledOnce()
    })
  })

  describe("getDatabasePath", () => {
    it("strips file: prefix from DATABASE_URL", () => {
      const original = process.env.DATABASE_URL
      process.env.DATABASE_URL = "file:./prisma/dev.db"

      expect(getDatabasePath()).toBe("./prisma/dev.db")

      process.env.DATABASE_URL = original
    })

    it("throws when DATABASE_URL is not set", () => {
      const original = process.env.DATABASE_URL
      delete process.env.DATABASE_URL

      expect(() => getDatabasePath()).toThrow("DATABASE_URL environment variable is required")

      process.env.DATABASE_URL = original
    })
  })
})
