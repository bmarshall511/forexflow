/**
 * Dashboard redesign — shared primitives barrel.
 *
 * Kept under `components/dashboard/shared/` while the redesign is in flight.
 * Primitives that prove useful outside the dashboard can graduate to
 * `components/ui/` later.
 */
export { ConnectionHealthIndicator } from "./connection-health-indicator"
export { DeltaBadge } from "./delta-badge"
export { LivePulse } from "./live-pulse"
export { MetricTile, type MetricTileProps } from "./metric-tile"
export { PeriodPicker } from "./period-picker"
export { PrivacyToggle } from "./privacy-toggle"
export { SetupPanel } from "./setup-panel"
export { Sparkline } from "./sparkline"
export type { DashboardTone, SparkPoint } from "./types"
