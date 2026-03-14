/**
 * Chart layout service — persists the user's chart panel arrangement.
 *
 * Stores the layout mode (single, dual, quad) and per-panel instrument/timeframe
 * configuration. Uses a singleton row (id=1) with JSON-serialized panel data.
 *
 * @module chart-layout-service
 */
import { db } from "./client"
import type { ChartLayoutData, ChartPanelConfig } from "@fxflow/types"

/** Default panel configuration used when no saved layout exists. */
const DEFAULT_PANEL: ChartPanelConfig = { instrument: "EUR_USD", timeframe: "H1" }

/** Get the saved chart layout, or return defaults if none exists. */
export async function getChartLayout(): Promise<ChartLayoutData> {
  const row = await db.chartLayout.findUnique({ where: { id: 1 } })

  if (!row) {
    return { layout: "single", panels: [DEFAULT_PANEL] }
  }

  let panels: ChartPanelConfig[]
  try {
    panels = JSON.parse(row.panels) as ChartPanelConfig[]
  } catch {
    panels = [DEFAULT_PANEL]
  }

  return {
    layout: row.layout as ChartLayoutData["layout"],
    panels: panels.length > 0 ? panels : [DEFAULT_PANEL],
  }
}

/** Save the chart layout (upserts single row). */
export async function saveChartLayout(data: ChartLayoutData): Promise<void> {
  await db.chartLayout.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      layout: data.layout,
      panels: JSON.stringify(data.panels),
    },
    update: {
      layout: data.layout,
      panels: JSON.stringify(data.panels),
    },
  })
}
