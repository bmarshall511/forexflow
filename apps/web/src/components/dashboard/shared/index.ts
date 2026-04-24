/**
 * Dashboard redesign — shared primitives barrel.
 *
 * Kept under `components/dashboard/shared/` while the redesign is in flight.
 * Primitives that prove useful outside the dashboard can graduate to
 * `components/ui/` later.
 */
export { CalendarHeatmap } from "./calendar-heatmap"
export { ConnectionHealthIndicator } from "./connection-health-indicator"
export { DeltaBadge } from "./delta-badge"
export { InstrumentBars } from "./instrument-bars"
export { LivePulse } from "./live-pulse"
export { MetricDrawer, type MetricDrawerPeriod } from "./metric-drawer"
export { MetricTile, type MetricTileProps } from "./metric-tile"
export { MfeMaeScatter } from "./mfe-mae-scatter"
export { PeriodPicker } from "./period-picker"
export { PrivacyToggle } from "./privacy-toggle"
export { SessionClock } from "./session-clock"
export { SetupPanel } from "./setup-panel"
export { SourceWaterfall } from "./source-waterfall"
export { Sparkline } from "./sparkline"
export { comparePeriods, vsPriorLabel, type NarrativeDelta } from "./narrative"
export type { DashboardTone, SparkPoint } from "./types"
