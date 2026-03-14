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
