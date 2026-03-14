export interface ChartTheme {
  background: string
  text: string
  grid: string
  crosshair: string
  border: string
  // Candle colors
  upCandle: string
  downCandle: string
  upWick: string
  downWick: string
  // Level colors
  entryLine: string
  slLine: string
  tpLine: string
  // Zone colors
  supplyZone: string
  demandZone: string
  htfSupplyZone: string
  htfDemandZone: string
  invalidatedZone: string
  // Trend colors
  upTrend: string
  downTrend: string
  rangeTrend: string
  trendImpulse: string
  trendCorrection: string
}

export const darkTheme: ChartTheme = {
  background: "transparent",
  text: "rgba(255,255,255,0.5)",
  grid: "rgba(255,255,255,0.04)",
  crosshair: "#374151",
  border: "#27272a",
  upCandle: "#22c55e",
  downCandle: "#ef4444",
  upWick: "#22c55e",
  downWick: "#ef4444",
  entryLine: "#f59e0b",
  slLine: "#ef4444",
  tpLine: "#22c55e",
  supplyZone: "#ef4444",
  demandZone: "#22c55e",
  htfSupplyZone: "#dc2626",
  htfDemandZone: "#16a34a",
  invalidatedZone: "#6b7280",
  upTrend: "#3b82f6",
  downTrend: "#f97316",
  rangeTrend: "#94a3b8",
  trendImpulse: "#3b82f6",
  trendCorrection: "#f97316",
}

export const lightTheme: ChartTheme = {
  background: "transparent",
  text: "rgba(0,0,0,0.5)",
  grid: "rgba(0,0,0,0.06)",
  crosshair: "#e5e7eb",
  border: "#e4e4e7",
  upCandle: "#16a34a",
  downCandle: "#dc2626",
  upWick: "#16a34a",
  downWick: "#dc2626",
  entryLine: "#d97706",
  slLine: "#dc2626",
  tpLine: "#16a34a",
  supplyZone: "#dc2626",
  demandZone: "#16a34a",
  htfSupplyZone: "#b91c1c",
  htfDemandZone: "#15803d",
  invalidatedZone: "#9ca3af",
  upTrend: "#2563eb",
  downTrend: "#ea580c",
  rangeTrend: "#64748b",
  trendImpulse: "#2563eb",
  trendCorrection: "#ea580c",
}

export function getChartTheme(isDark: boolean): ChartTheme {
  return isDark ? darkTheme : lightTheme
}

// ─── Recharts Theme ──────────────────────────────────────────────────────────

export interface RechartsTheme {
  profit: string
  loss: string
  neutral: string
  accent: string
  grid: string
  axis: string
  tooltip: {
    bg: string
    border: string
    text: string
  }
  funnel: [string, string, string]
  sessionColors: [string, string, string]
}

const rechartsLight: RechartsTheme = {
  profit: "#16a34a",
  loss: "#dc2626",
  neutral: "#6b7280",
  accent: "#6366f1",
  grid: "rgba(0,0,0,0.06)",
  axis: "rgba(0,0,0,0.4)",
  tooltip: { bg: "#ffffff", border: "#e4e4e7", text: "#18181b" },
  funnel: ["#6366f1", "#3b82f6", "#22c55e"],
  sessionColors: ["#f59e0b", "#3b82f6", "#22c55e"],
}

const rechartsDark: RechartsTheme = {
  profit: "#22c55e",
  loss: "#ef4444",
  neutral: "#6b7280",
  accent: "#818cf8",
  grid: "rgba(255,255,255,0.04)",
  axis: "rgba(255,255,255,0.4)",
  tooltip: { bg: "#18181b", border: "#27272a", text: "#fafafa" },
  funnel: ["#818cf8", "#60a5fa", "#34d399"],
  sessionColors: ["#fbbf24", "#60a5fa", "#34d399"],
}

export function getRechartsTheme(isDark: boolean): RechartsTheme {
  return isDark ? rechartsDark : rechartsLight
}
