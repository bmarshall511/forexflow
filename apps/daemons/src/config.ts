export interface DaemonConfig {
  port: number
  healthCheckIntervalMs: number
  dbPollIntervalMs: number
  streamReconnectDelayMs: number
  streamReconnectMaxMs: number
  todayPnlIntervalMs: number
  shortPnlIntervalMs: number
  longPnlIntervalMs: number
  tradeReconcileIntervalMs: number
  tradeBackfillDays: number
  priceThrottleMs: number
  cfWorkerWsUrl: string
  cfWorkerDaemonSecret: string
}

export function getConfig(): DaemonConfig {
  return {
    port: parseInt(process.env.DAEMON_PORT ?? "4100", 10),
    healthCheckIntervalMs: parseInt(process.env.DAEMON_HEALTH_INTERVAL ?? "5000", 10),
    dbPollIntervalMs: parseInt(process.env.DAEMON_DB_POLL_INTERVAL ?? "5000", 10),
    streamReconnectDelayMs: parseInt(process.env.DAEMON_STREAM_RECONNECT_DELAY ?? "5000", 10),
    streamReconnectMaxMs: parseInt(process.env.DAEMON_STREAM_RECONNECT_MAX ?? "60000", 10),
    todayPnlIntervalMs: parseInt(process.env.DAEMON_TODAY_PNL_INTERVAL ?? "30000", 10),
    shortPnlIntervalMs: parseInt(process.env.DAEMON_SHORT_PNL_INTERVAL ?? "60000", 10),
    longPnlIntervalMs: parseInt(process.env.DAEMON_LONG_PNL_INTERVAL ?? "300000", 10),
    tradeReconcileIntervalMs: parseInt(process.env.DAEMON_TRADE_RECONCILE_INTERVAL ?? "120000", 10),
    tradeBackfillDays: parseInt(process.env.DAEMON_TRADE_BACKFILL_DAYS ?? "30", 10),
    priceThrottleMs: parseInt(process.env.DAEMON_PRICE_THROTTLE ?? "500", 10),
    cfWorkerWsUrl: process.env.CF_WORKER_WS_URL ?? "",
    cfWorkerDaemonSecret: process.env.CF_WORKER_DAEMON_SECRET ?? "",
  }
}
