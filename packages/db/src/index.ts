// @fxflow/db — shared database client, encryption, and service layer

export { db } from "./client"

export {
  hasPin,
  createPin,
  verifyPin,
  changePin,
  getSessionExpiry,
  updateSessionExpiry,
  createSession,
  validateSession,
  deleteSession,
  deleteAllSessions,
  listActiveSessions,
  revokeSession,
  cleanupExpiredSessions,
} from "./auth-service"
export { encrypt, decrypt, reEncrypt } from "./encryption"
export { rotateEncryptionKeys } from "./key-rotation-service"
export {
  getSettings,
  setTradingMode,
  saveCredentials,
  deleteCredentials,
  revealToken,
  testConnection,
  getRiskPercent,
  setRiskPercent,
  getOnboardingCompleted,
  setOnboardingCompleted,
} from "./settings-service"

export {
  getDeploymentSettings,
  setDeploymentMode,
  setCloudDaemonUrl,
  type DeploymentSettings,
} from "./deployment-service"

export {
  createNotification,
  listNotifications,
  dismissNotification,
  dismissAllNotifications,
  deleteNotification,
  deleteAllDismissed,
  getUndismissedCount,
  cleanupOldNotifications,
  type CreateNotificationInput,
  type ListNotificationsOptions,
} from "./notification-service"

export {
  upsertTrade,
  closeTrade,
  migrateFilledPendingOrders,
  removeStalePendingOrders,
  closeOrphanedTrades,
  getTradeBySourceId,
  listTrades,
  getClosedTradesToday,
  updateTradePartialClose,
  updateTradeMfeMae,
  createTradeEvent,
  updateTradeNotes,
  updateTradeTimeframe,
  updateTradeMetadata,
  updateTradeSourceId,
  appendTradeNotes,
  deleteClosedTrades,
  deleteTrade,
  getTradeWithDetails,
  getOpenTradeIdsByPlacedVia,
  type UpsertTradeInput,
  type CloseTradeInput,
  type ListTradesOptions,
  type TradeListResponse,
  type CreateTradeEventInput,
} from "./trade-service"

export {
  listTags,
  createTag,
  findOrCreateTag,
  deleteTag,
  assignTagToTrade,
  removeTagFromTrade,
  getTagsForTrade,
  getTagsForTradeIds,
} from "./tag-service"

export { getChartLayout, saveChartLayout } from "./chart-layout-service"

export {
  getAiSettings,
  saveClaudeApiKey,
  saveFinnhubApiKey,
  deleteClaudeApiKey,
  deleteFinnhubApiKey,
  saveAiPreferences,
  getDecryptedClaudeKey,
  getDecryptedFinnhubKey,
  getAutoAnalysisSettings,
  validateClaudeApiKey,
  disableAutoAnalysis,
  clearAutoDisableReason,
} from "./ai-settings-service"

export {
  createAnalysis,
  updateAnalysisStatus,
  saveAnalysisResult,
  getAnalysis,
  getAnalysisHistory,
  getLatestCompletedAnalysis,
  cancelAnalysis,
  getRecentAnalysisForTrade,
  getUsageStats,
  cleanupOldAnalyses,
  calculateCost,
  getLatestAnalysisByTradeIds,
  getAnalysisCountsByTradeIds,
  getRecentAnalysesWithTrade,
  getAnalysesPaginated,
  resetStuckAnalyses,
  deleteAnalysis,
  clearAllAnalyses,
} from "./ai-analysis-service"
export type { RecentAnalysisSummary } from "./ai-analysis-service"

export {
  createCondition,
  updateCondition,
  updateConditionStatus,
  deleteCondition,
  listConditionsForTrade,
  listActiveConditions,
  expireOldConditions,
  cancelConditionsForTrade,
  cancelAllActiveConditions,
  expireConditionsForTrade,
  getAllConditionSummaries,
  recoverExecutingConditions,
  activateChildConditions,
  type CreateConditionInput,
  type ConditionSummary,
} from "./trade-condition-service"

export {
  createRecommendationOutcome,
  markActionFollowed,
  resolveOutcomes,
  getAccuracyStats,
} from "./ai-recommendation-service"

export {
  createDigest,
  saveDigestResult,
  getLatestDigest,
  listDigests,
  getDigest,
  deleteDigest,
  findExistingDigest,
} from "./ai-digest-service"

export {
  getTVAlertsConfig,
  updateTVAlertsConfig,
  generateWebhookToken,
  setTVAlertsKillSwitch,
} from "./tv-alerts-config-service"

export {
  createSignal,
  updateSignalStatus,
  getRecentSignal,
  listSignals,
  getSignalPerformanceStats,
  getActiveAutoTradeCount,
  getActiveAutoTradeIds,
  getTodayAutoTradePL,
  getTodaySignalCount,
  syncClosedSignalResults,
  cleanupOldSignals,
  clearAllSignals,
  markSignalAsTest,
  getSignalPeriodPnL,
  getAutoTradesSummary,
  getSignalPnLDistribution,
  getSignalRecentResults,
  getSignalsByPair,
  type CreateSignalInput,
  type ListSignalsOptions,
} from "./tv-alerts-signal-service"

export {
  logAuditEvent,
  getAuditTrail,
  cleanupOldAuditEvents,
  type SignalAuditEventData,
} from "./signal-audit-service"

export {
  upsertZones,
  getZones,
  getZonesByInstrument,
  invalidateZone,
  cleanupOldZones,
  type GetZonesOptions,
} from "./zone-service"

export { getZoneSettings, saveZoneSettings } from "./zone-settings-service"

export { upsertTrend, getTrend, getTrendHistory, cleanupOldTrends } from "./trend-service"

export { getTrendSettings, saveTrendSettings } from "./trend-settings-service"

export {
  upsertCurveSnapshot,
  getCurveSnapshot,
  cleanupOldCurveSnapshots,
} from "./curve-snapshot-service"

export { getTradeFinderConfig, updateTradeFinderConfig } from "./trade-finder-config-service"

export {
  getActiveSetups,
  getSetupsByInstrument,
  getSetupHistory,
  getSetup,
  createSetup,
  updateSetupStatus,
  updateSetupScores,
  pruneSetupHistory,
  findExistingSetup,
  countPendingAutoPlaced,
  countAutoPlacedToday,
  getPendingAutoPlacedSetups,
  getAutoPlacedTotalRiskPips,
  findSetupByResultSourceId,
  getPlacedAutoSetups,
  clearActiveSetups,
  clearSetupHistory,
  updateSetupSkipReason,
  type CreateSetupInput,
} from "./trade-finder-service"

export {
  getAiTraderConfig,
  updateAiTraderConfig,
  saveAiTraderApiKey,
  deleteAiTraderApiKey,
  getDecryptedAiTraderKey,
} from "./ai-trader-config-service"

export {
  createOpportunity,
  updateOpportunityStatus,
  getActiveOpportunities,
  getOpportunityHistory,
  getOpportunity,
  findOpportunityByResultTradeId,
  findOpportunityByResultSourceId,
  countOpenAiTrades,
  appendManagementAction,
  getTodayAiCost,
  getMonthlyAiCost,
  expireOldOpportunities,
  cleanupOldOpportunities,
  getOpportunitiesByProfile,
  type CreateOpportunityInput,
} from "./ai-trader-opportunity-service"

export {
  getCachedMarketData,
  setCachedMarketData,
  getAllCachedByType,
  cleanupExpiredData,
  clearAllMarketData,
} from "./ai-trader-market-data-service"

export {
  getPerformanceStats,
  upsertPerformanceStats,
  recalculatePerformance,
  getOverallStats,
  cleanupOldPerformance,
  type UpsertPerformanceInput,
  type TradeStatsInput,
} from "./ai-trader-performance-service"

export {
  createPriceAlert,
  listPriceAlerts,
  getPriceAlert,
  updatePriceAlert,
  deletePriceAlert,
  triggerPriceAlert,
  getActiveAlertsForInstrument,
  getActiveAlertInstruments,
  expireOldAlerts,
  cancelAllAlerts,
} from "./price-alert-service"

export {
  getResetPreflightStatus,
  getModuleDataCounts,
  resetModule,
  resetTradingData,
  resetFactory,
  getDatabasePath,
  deleteDatabaseFile,
  type ResetModule,
  type PreflightStatus,
  type ResetResult,
} from "./reset-service"

export {
  upsertEconomicEvents,
  getUpcomingEvents,
  getEventsInRange,
  cleanupOldEvents,
  type EconomicEventInput,
} from "./calendar-service"

export {
  getPerformanceSummary,
  getPerformanceByInstrument,
  getPerformanceBySession,
  getPerformanceByDayOfWeek,
  getPerformanceByHourOfDay,
  getPerformanceBySource,
  getMfeMaeDistribution,
  getEquityCurve,
  getSourceBreakdown,
} from "./analytics-service"
