# Trend Detection & Overlay — Implementation Plan

## Overview

Add a **trend detection and visualization** layer to FXFlow's chart system, following the same architectural patterns as the existing zone/curve overlay system. The feature identifies swing highs/lows, connects them into segments, determines trend direction (uptrend/downtrend/range), and renders the results as configurable overlays on the chart.

The implementation also adds **curve data persistence** to the DB (currently client-side only).

### Trading Methodology (from slides)

- **Swing Low**: Price stops falling, starts rising. Defined as the **low of the lowest closing candle** in the pivot area. Often a DBR formation.
- **Swing High**: Price stops rising, starts falling. Defined as the **high of the highest closing candle** in the pivot area. Often an RBD formation.
- **Segment**: Price movement between consecutive swing points (up segment = swing low → swing high, down segment = swing high → swing low).
- **Uptrend Formation**: 3 segments — up → down (doesn't cross below preceding swing low) → up (crosses above preceding swing high). Result: Higher Lows + Higher Highs.
- **Downtrend Formation**: Reverse — down → up (doesn't cross above preceding swing high) → down (crosses below preceding swing low). Result: Lower Highs + Lower Lows.
- **Trend Termination**: Price crosses the **controlling swing level** (the most recent swing low in an uptrend, or swing high in a downtrend).
- **Identification Process**: Scan right-to-left from current price, find swing points, draw segments, evaluate HH/HL or LH/LL pattern.

---

## Architecture Summary

```
packages/types          → New trend types (SwingPoint, Segment, TrendData, TrendSettings, etc.)
packages/shared         → trend-detector.ts (detection algorithm)
packages/db             → Prisma models (Trend, CurveSnapshot) + services
apps/web/api            → /api/trends/[instrument], /api/trends/settings
apps/web/hooks          → use-trends.ts, use-trend-settings.ts
apps/web/components     → trend-primitive.ts, trend-summary-bar.tsx
apps/web/components     → Rename ZoneControlsPopover → ChartOverlayControlsPopover (add trend section)
apps/web/components     → Wire trend data through chart-panel → all 3 chart components
```

---

## Phase 1 — Types (`packages/types/src/index.ts`)

### New Types to Add

```typescript
// ─── Trend Detection Types ─────────────────────────────────────────────

/** Direction of a trend */
export type TrendDirection = "up" | "down"

/** Current trend status */
export type TrendStatus = "forming" | "confirmed" | "terminated"

/** Swing point type */
export type SwingPointType = "high" | "low"

/** Swing point label for visual display */
export type SwingPointLabel = "H" | "HH" | "L" | "HL" | "LH" | "LL"

/** A detected swing point on the chart */
export interface SwingPoint {
  /** Unique identifier */
  id: string
  /** High or low */
  type: SwingPointType
  /** The price level (high of highest closing candle for swing high, low of lowest closing candle for swing low) */
  price: number
  /** Unix timestamp (seconds) of the candle at the swing point */
  time: number
  /** Label relative to the trend context (H, HH, HL, L, LL, LH) */
  label: SwingPointLabel
  /** Index into the candle array where this swing was detected */
  candleIndex: number
}

/** A segment connecting two consecutive swing points */
export interface TrendSegment {
  /** Unique identifier */
  id: string
  /** Starting swing point */
  from: SwingPoint
  /** Ending swing point */
  to: SwingPoint
  /** Direction of this segment */
  direction: TrendDirection
  /** Price range of the segment in pips */
  rangePips: number
  /** Number of candles in this segment */
  candleCount: number
  /** Whether this is the breakout segment that confirmed the trend */
  isBreakout: boolean
}

/** Complete trend detection result for a single timeframe */
export interface TrendData {
  /** Instrument analyzed */
  instrument: string
  /** Timeframe analyzed */
  timeframe: string
  /** Current trend direction (null = range/no trend) */
  direction: TrendDirection | null
  /** Trend status */
  status: TrendStatus
  /** All detected swing points (ordered chronologically, oldest first) */
  swingPoints: SwingPoint[]
  /** All segments connecting swing points */
  segments: TrendSegment[]
  /** The controlling swing level — breaking this terminates the trend */
  controllingSwing: SwingPoint | null
  /** Distance from current price to controlling swing (in pips) */
  controllingSwingDistancePips: number | null
  /** Current price used for analysis */
  currentPrice: number
  /** Number of candles analyzed */
  candlesAnalyzed: number
  /** ISO timestamp when computed */
  computedAt: string
}

/** Multi-timeframe trend result */
export interface MultiTimeframeTrendResult {
  /** Primary timeframe trend */
  primary: TrendData
  /** Higher timeframe trend (if enabled) */
  higher: TrendData | null
}

// ─── Trend Display Settings ────────────────────────────────────────────

/** What visual elements to show */
export interface TrendVisualSettings {
  /** Show colored rectangles over up/down segments */
  showBoxes: boolean
  /** Show diagonal lines connecting swing points */
  showLines: boolean
  /** Show circle markers at swing highs/lows */
  showMarkers: boolean
  /** Show labels (H, HH, HL, L, LL, LH) at swing points */
  showLabels: boolean
  /** Show the controlling swing as a horizontal price line */
  showControllingSwing: boolean
  /** Opacity for trend boxes (0.0–1.0) */
  boxOpacity: number
}

/** Trend detection algorithm configuration */
export interface TrendDetectionConfig {
  /** Number of candles on each side to confirm a swing point (3 for M1–M30, 5 for H1+) */
  swingStrength: number
  /** Minimum segment size as ATR multiple to qualify (filters noise) */
  minSegmentAtr: number
  /** Maximum number of swing points to detect (limits lookback depth) */
  maxSwingPoints: number
  /** How many candles to look back for swing detection */
  lookbackCandles: number
}

/** Complete trend display settings (persisted) */
export interface TrendDisplaySettings {
  /** Master toggle */
  enabled: boolean
  /** Visual element toggles */
  visuals: TrendVisualSettings
  /** Algorithm configuration */
  config: TrendDetectionConfig
  /** Show higher-timeframe trend overlay */
  showHigherTf: boolean
  /** Explicit higher timeframe (null = auto one level up) */
  higherTimeframe: string | null
}

/** Per-chart trend overrides */
export interface ChartPanelTrendOverrides {
  enabled?: boolean
  showBoxes?: boolean
  showLines?: boolean
  showMarkers?: boolean
  showLabels?: boolean
  showHigherTf?: boolean
}

/** Default trend display settings */
// (Defined in packages/shared as DEFAULT_TREND_DISPLAY_SETTINGS)
```

### Update Existing Types

```typescript
// In ChartPanelConfig — add trend overrides alongside zoneOverrides
export interface ChartPanelConfig {
  instrument: string
  timeframe: string
  zoneOverrides?: ChartPanelZoneOverrides
  trendOverrides?: ChartPanelTrendOverrides  // ← NEW
}
```

---

## Phase 2 — Shared Algorithm (`packages/shared/src/trend-detector.ts`)

### Algorithm Design

The algorithm follows the methodology from the slides exactly:

#### Step 1: Detect Swing Points (N-Bar Method)

```
For each candle at index i:
  Swing Low: candle[i].close is the lowest close in range [i-N, i+N]
             → price = candle[i].low (low of lowest closing candle)

  Swing High: candle[i].close is the highest close in range [i-N, i+N]
              → price = candle[i].high (high of highest closing candle)

  N = swingStrength (adaptive: 3 for M1–M30, 5 for H1+)
```

- Uses **closing prices** for comparison (per methodology), but records the **high/low wick** as the swing price level.
- Filters out insignificant swings where the segment range is below `minSegmentAtr × ATR`.
- Deduplicates: if two consecutive swings are the same type, keep the more extreme one.

#### Step 2: Build Segments

```
For each consecutive pair of swing points:
  Create a segment from swingPoints[i] to swingPoints[i+1]
  Direction: "up" if to.price > from.price, "down" otherwise
  Range: |to.price - from.price| in pips
```

#### Step 3: Identify Trend (Right-to-Left Scan)

```
Starting from the most recent swing points, scan backwards:

For Uptrend:
  1. Find most recent swing low (L) and preceding swing high (H)
  2. Check if there's a higher swing low (HL) after H
  3. Check if price crossed above H → creates higher high (HH)
  4. Verify HL > L (higher low) and HH > H (higher high)
  → If valid: direction = "up", status = "confirmed"
  → Controlling swing = HL (most recent higher low)

For Downtrend:
  1. Find most recent swing high (H) and preceding swing low (L)
  2. Check if there's a lower swing high (LH) after L
  3. Check if price crossed below L → creates lower low (LL)
  4. Verify LH < H (lower high) and LL < L (lower low)
  → If valid: direction = "down", status = "confirmed"
  → Controlling swing = LH (most recent lower high)

Trend Termination Check:
  If direction = "up" and currentPrice < controllingSwing.price → terminated
  If direction = "down" and currentPrice > controllingSwing.price → terminated
```

#### Step 4: Label Swing Points

Once trend direction is known, walk through swing points and assign labels:
- First swing low = "L", subsequent higher lows = "HL", lower lows = "LL"
- First swing high = "H", subsequent higher highs = "HH", lower highs = "LH"

### Adaptive Swing Strength

```typescript
export function getDefaultSwingStrength(timeframe: string): number {
  switch (timeframe) {
    case "M1":
    case "M5":
    case "M15":
    case "M30":
      return 3   // 3 candles each side for sub-hourly
    case "H1":
    case "H4":
    case "D":
    case "W":
    case "M":
    default:
      return 5   // 5 candles each side for hourly+
  }
}
```

### Exports

```typescript
export function detectTrend(
  candles: ZoneCandle[],
  instrument: string,
  timeframe: string,
  config: TrendDetectionConfig,
  currentPrice: number,
): TrendData

export function getDefaultSwingStrength(timeframe: string): number

export const DEFAULT_TREND_DETECTION_CONFIG: TrendDetectionConfig
export const DEFAULT_TREND_DISPLAY_SETTINGS: TrendDisplaySettings
```

### Performance

- Single-pass O(n) scan for swing detection.
- Segment building is O(s) where s = number of swings (typically < 50).
- Trend identification is O(1) — only examines the last 4–6 swing points.
- Total: O(n) where n = lookback candle count.

---

## Phase 3 — Database Models (`packages/db`)

### New Prisma Models

```prisma
model DetectedTrend {
  id               String   @id @default(uuid())
  instrument       String
  timeframe        String
  direction        String?              // "up" | "down" | null (range)
  status           String               // "forming" | "confirmed" | "terminated"
  swingPoints      String               // JSON: SwingPoint[]
  segments         String               // JSON: TrendSegment[]
  controllingSwing String?              // JSON: SwingPoint | null
  currentPrice     Float
  candlesAnalyzed  Int
  computedAt       DateTime @default(now())
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([instrument, timeframe, computedAt])
  @@index([instrument, timeframe, status])
}

model CurveSnapshot {
  id             String   @id @default(uuid())
  instrument     String
  timeframe      String
  supplyDistal   Float
  demandDistal   Float
  highThreshold  Float
  lowThreshold   Float
  position       String               // "high" | "middle" | "low" | "above" | "below"
  supplyZoneId   String?              // Reference to SupplyDemandZone if available
  demandZoneId   String?              // Reference to SupplyDemandZone if available
  currentPrice   Float
  computedAt     DateTime @default(now())
  createdAt      DateTime @default(now())

  @@index([instrument, timeframe, computedAt])
}

model TrendSettings {
  id       Int    @id @default(1)
  settings String @default("{}")        // JSON: TrendDisplaySettings
}
```

### New DB Services

#### `packages/db/src/trend-service.ts`

```typescript
export async function upsertTrend(data: TrendData): Promise<void>
  // Upsert by instrument+timeframe — keeps latest result

export async function getTrend(instrument: string, timeframe: string): Promise<DetectedTrend | null>
  // Get most recent trend for instrument+timeframe

export async function getTrendHistory(instrument: string, timeframe: string, limit?: number): Promise<DetectedTrend[]>
  // Get historical trend snapshots (for future analysis)

export async function cleanupOldTrends(olderThanDays?: number): Promise<number>
  // Cleanup old trend records (default 30 days)
```

#### `packages/db/src/trend-settings-service.ts`

```typescript
export async function getTrendSettings(): Promise<TrendDisplaySettings>
  // Reads from TrendSettings row (id=1), falls back to DEFAULT_TREND_DISPLAY_SETTINGS

export async function saveTrendSettings(settings: TrendDisplaySettings): Promise<void>
  // Upserts settings JSON to TrendSettings row
```

#### `packages/db/src/curve-snapshot-service.ts`

```typescript
export async function upsertCurveSnapshot(data: CurveData, instrument: string): Promise<void>
  // Persist curve computation result

export async function getCurveSnapshot(instrument: string, timeframe: string): Promise<CurveSnapshot | null>
  // Get most recent curve snapshot

export async function cleanupOldCurveSnapshots(olderThanDays?: number): Promise<number>
  // Cleanup old snapshots
```

### Update `packages/db/src/index.ts`

Add exports for all new services.

### Update `packages/db/prisma/schema.prisma`

Add the three new models above.

---

## Phase 4 — API Routes (`apps/web/src/app/api/`)

### `GET /api/trends/[instrument]`

**Query params**: `timeframe`, `lookback` (candle count), `currentPrice`

**Flow**:
1. Fetch candles from OANDA (via existing candle API logic)
2. Get trend settings from DB
3. Run `detectTrend()` from `@fxflow/shared`
4. Optionally compute HTF trend
5. Persist result to DB via `upsertTrend()`
6. If curve persistence is enabled, also persist curve snapshot
7. Return `MultiTimeframeTrendResult`

**Caching**: `Cache-Control: public, s-maxage=30, stale-while-revalidate=120` (same as zones)

### `GET /api/trends/settings`

Returns global `TrendDisplaySettings` from DB.

### `PUT /api/trends/settings`

Saves updated `TrendDisplaySettings` to DB.

---

## Phase 5 — Web Hooks (`apps/web/src/hooks/`)

### `use-trend-settings.ts`

Mirrors `use-zone-settings.ts` exactly:
- Fetches global settings from `/api/trends/settings`
- Merges with per-chart `trendOverrides`
- Provides `saveGlobal()` callback
- Returns merged `TrendDisplaySettings` + override setters

### `use-trends.ts`

Mirrors `use-zones.ts` orchestration pattern:

```typescript
interface UseTrendsOptions {
  instrument: string
  timeframe: string
  enabled: boolean
  currentPrice: number | null
  settings: TrendDisplaySettings
  chartCandleCount?: number
}

interface UseTrendsReturn {
  trendData: TrendData | null
  higherTfTrendData: TrendData | null
  isComputing: boolean
  lastComputedAt: string | null
  recompute: () => void
  error: string | null
}
```

**Key behaviors**:
- Self-fetches candles using `settings.config.lookbackCandles` (independent of chart candle count)
- Runs `detectTrend()` client-side for responsiveness
- Persists results to DB via `/api/trends/{instrument}` in background (fire-and-forget, same as zone persistence pattern)
- Recomputes when candle data changes, settings change, or manual recompute triggered
- Supports HTF trend detection (fetches HTF candles, runs separate detection)

---

## Phase 6 — Chart Primitive (`apps/web/src/components/charts/trend-primitive.ts`)

### `TrendPrimitive` Class

Follows the exact same `ISeriesPrimitive<Time>` pattern as `CurvePrimitive` and `ZonePrimitive`.

```typescript
export class TrendPrimitive implements ISeriesPrimitive<Time> {
  // Renders all visual elements:
  // 1. Trend boxes (colored rectangles over segments)
  // 2. Trend lines (diagonal lines connecting swing points)
  // 3. Swing markers (circles at swing highs/lows)
  // 4. Swing labels (H, HH, HL, L, LL, LH text)
  // 5. Controlling swing line (horizontal dashed price line)

  setTrend(data: TrendData | null, visuals: TrendVisualSettings, isDark: boolean): void
  setHigherTfTrend(data: TrendData | null): void
  clearTrend(): void
}
```

### Visual Design

**Color Scheme** (distinct from zones green/red and curve red/slate/green):

| Element | Uptrend | Downtrend |
|---------|---------|-----------|
| Trend boxes (up segments) | `rgba(59, 130, 246, opacity)` — blue | `rgba(249, 115, 22, opacity)` — orange |
| Trend boxes (down segments) | `rgba(249, 115, 22, opacity)` — orange | `rgba(59, 130, 246, opacity)` — blue |
| Trend lines | `#3b82f6` — blue solid | `#f97316` — orange solid |
| Swing markers | `#3b82f6` / `#f97316` filled circles | `#f97316` / `#3b82f6` filled circles |
| Swing labels | White text on blue/orange pill | White text on orange/blue pill |
| Controlling swing line | `#3b82f6` dashed horizontal | `#f97316` dashed horizontal |

**HTF trend**: Rendered with lower opacity (0.5x) and thinner lines, behind primary trend (zOrder: "bottom").

**Rendering Details**:

1. **Trend Boxes**: Filled rectangles from segment start time to end time, spanning the price range of the segment. Green-tinted for impulsion (with-trend), red-tinted for correction (counter-trend). Opacity controlled by `boxOpacity` setting.

2. **Trend Lines**: 2px solid diagonal lines connecting consecutive swing point prices at their respective candle times. Uses `series.priceToCoordinate()` and time-to-x coordinate conversion.

3. **Swing Markers**: 6px filled circles at swing high (top of candle area) and swing low (bottom of candle area). Border ring for emphasis.

4. **Swing Labels**: Small pill badges (like zone formation labels) positioned above swing highs and below swing lows. Show the label text (H, HH, HL, L, LL, LH).

5. **Controlling Swing Line**: Full-width horizontal dashed line at the controlling swing price. Color matches trend direction. Price axis label shows "CTRL" text.

---

## Phase 7 — Trend Summary Bar (`apps/web/src/components/charts/trend-summary-bar.tsx`)

Positioned below the chart, same pattern as `ZoneSummaryBar`.

### Layout

```
┌──────────────────────────────────────────────────────────────┐
│ ▲ Uptrend (H1)  │  Ctrl: 1.0845 (32 pips)  │  HTF: ▲ Up   │
└──────────────────────────────────────────────────────────────┘
```

**Sections**:
1. **Trend badge**: Arrow icon + "Uptrend" / "Downtrend" / "Range" + timeframe
2. **Controlling swing**: Price level + distance in pips from current price
3. **HTF trend** (if enabled): Arrow icon + direction

**Colors**:
- Uptrend: Blue background pill
- Downtrend: Orange background pill
- Range/No trend: Slate/gray pill
- Terminated: Red text overlay

---

## Phase 8 — Overlay Controls Update

### Rename `ZoneControlsPopover` → `ChartOverlayControlsPopover`

The popover currently manages zones + curve. Add a **Trend** section.

### New Popover Structure

```
┌─ Overlay Settings ─────────────────────┐
│                                         │
│ ── Zones ──────────────────────────── │
│ [Toggle] Show Zones                     │
│   (existing zone controls...)           │
│   [Toggle] Show Curve                   │
│     Curve Timeframe: [Auto ▾]           │
│                                         │
│ ── Trend ──────────────────────────── │
│ [Toggle] Show Trend                     │
│   [Toggle] Trend Boxes                  │
│   [Toggle] Trend Lines                  │
│   [Toggle] Swing Markers                │
│   [Toggle] Swing Labels                 │
│   [Toggle] Controlling Swing Line       │
│   [Toggle] Higher TF Trend              │
│     HTF Timeframe: [Auto ▾]            │
│                                         │
│ ── Advanced Tuning ─────────────────  │
│   (existing zone advanced...)           │
│   Swing Strength: [3───●─────5]         │
│   Min Segment ATR: [0.5──●───3.0]      │
│   Max Swing Points: [10──●───50]        │
│   Lookback Candles: [200──●──1000]      │
│                                         │
│ [Recompute]              Last: 2:30 PM  │
└─────────────────────────────────────────┘
```

### Toolbar Button Update

Change the `Layers` icon button in `chart-panel.tsx` to show active state for **either** zones or trend enabled (or both). Update the aria-label to "Chart overlay settings".

---

## Phase 9 — Chart Integration (Wiring)

### `chart-panel.tsx` Changes

1. Import and call `useTrendSettings()` (parallel to `useZoneSettings()`)
2. Import and call `useTrends()` (parallel to `useZones()`)
3. Pass `trendData`, `higherTfTrendData`, and `trendVisuals` to all three chart components
4. Add `TrendSummaryBar` below chart (alongside `ZoneSummaryBar`)
5. Pass trend settings + overrides to `ChartOverlayControlsPopover`

### `standalone-chart.tsx` Changes

1. Accept new props: `trendData?: TrendData | null`, `higherTfTrendData?: TrendData | null`, `trendVisuals?: TrendVisualSettings`
2. Create and attach `TrendPrimitive` (same pattern as zone/curve primitives)
3. Add `useEffect` to sync trend data into primitive when props change
4. Clean up refs on unmount

### `tradingview-chart.tsx` Changes

Same as standalone-chart — accept trend props, attach primitive, sync data.

### `draggable-trade-chart.tsx` Changes

Same as standalone-chart — accept trend props, attach primitive, sync data.

---

## Phase 10 — Curve Persistence Integration

### Update `use-zones.ts`

In the `buildCurveData()` flow, after computing curve data, fire a background persist call:

```typescript
// After setCurveData(computed)
persistCurveSnapshot(instrument, computed)
```

```typescript
function persistCurveSnapshot(instrument: string, curve: CurveData): void {
  fetch(`/api/curves/${instrument}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(curve),
  }).catch(() => {})
}
```

### New API Route: `POST /api/curves/[instrument]`

Receives `CurveData`, persists via `upsertCurveSnapshot()`.

### New API Route: `GET /api/curves/[instrument]`

Returns latest `CurveSnapshot` for instrument+timeframe (for future analysis use).

---

## File Change Summary

### New Files (16)

| File | Description |
|------|-------------|
| `packages/shared/src/trend-detector.ts` | Core swing detection + trend identification algorithm |
| `packages/shared/src/trend-defaults.ts` | Default settings constants |
| `packages/db/src/trend-service.ts` | Trend DB persistence service |
| `packages/db/src/trend-settings-service.ts` | Trend settings DB service |
| `packages/db/src/curve-snapshot-service.ts` | Curve snapshot DB service |
| `apps/web/src/hooks/use-trends.ts` | Trend detection orchestration hook |
| `apps/web/src/hooks/use-trend-settings.ts` | Trend settings hook with per-chart overrides |
| `apps/web/src/components/charts/trend-primitive.ts` | TrendPrimitive canvas renderer |
| `apps/web/src/components/charts/trend-summary-bar.tsx` | Trend status bar below chart |
| `apps/web/src/app/api/trends/[instrument]/route.ts` | Trend detection + persistence API |
| `apps/web/src/app/api/trends/settings/route.ts` | Trend settings GET/PUT API |
| `apps/web/src/app/api/curves/[instrument]/route.ts` | Curve persistence API |

### Modified Files (12)

| File | Changes |
|------|---------|
| `packages/types/src/index.ts` | Add all trend types, update `ChartPanelConfig` |
| `packages/shared/src/index.ts` | Export trend-detector, trend-defaults |
| `packages/db/prisma/schema.prisma` | Add `DetectedTrend`, `CurveSnapshot`, `TrendSettings` models |
| `packages/db/src/index.ts` | Export new services |
| `apps/web/src/components/charts/chart-panel.tsx` | Wire trend hooks, pass trend data to charts, add summary bar |
| `apps/web/src/components/charts/standalone-chart.tsx` | Accept trend props, attach TrendPrimitive |
| `apps/web/src/components/charts/tradingview-chart.tsx` | Accept trend props, attach TrendPrimitive |
| `apps/web/src/components/charts/draggable-trade-chart.tsx` | Accept trend props, attach TrendPrimitive |
| `apps/web/src/components/charts/zone-controls-popover.tsx` | Rename → `ChartOverlayControlsPopover`, add trend section |
| `apps/web/src/hooks/use-zones.ts` | Add curve persistence call |
| `apps/web/src/hooks/use-zone-settings.ts` | Minor — pass through to renamed popover |
| `apps/web/src/components/charts/zone-summary-bar.tsx` | Adjust layout to coexist with trend summary bar |

---

## Implementation Order

The phases should be implemented in this order to maintain a working build at each step:

1. **Types** — Define all interfaces first (no runtime impact)
2. **Shared algorithm** — Implement and unit test `detectTrend()` in isolation
3. **DB schema + services** — Prisma migration + service layer (including curve persistence)
4. **API routes** — REST endpoints for trends + curve
5. **Hooks** — `use-trend-settings.ts` then `use-trends.ts`
6. **Primitive** — `trend-primitive.ts` canvas rendering
7. **UI components** — `trend-summary-bar.tsx` + popover update
8. **Chart integration** — Wire everything through chart-panel → chart components
9. **Curve persistence** — Update `use-zones.ts` to persist curve data
10. **Testing** — Unit tests for algorithm, integration verification

---

## Default Settings

```typescript
export const DEFAULT_TREND_VISUAL_SETTINGS: TrendVisualSettings = {
  showBoxes: false,        // Off by default — clean look
  showLines: true,         // On — primary visual
  showMarkers: true,       // On — swing point circles
  showLabels: true,        // On — H, HH, HL, L, LL, LH
  showControllingSwing: true, // On — critical level
  boxOpacity: 0.06,        // Subtle when enabled
}

export const DEFAULT_TREND_DETECTION_CONFIG: TrendDetectionConfig = {
  swingStrength: 5,        // Will be overridden by adaptive logic per timeframe
  minSegmentAtr: 0.5,      // Minimum half-ATR segment to filter noise
  maxSwingPoints: 20,      // Last 20 swing points (~10 segments)
  lookbackCandles: 500,    // Match zone lookback
}

export const DEFAULT_TREND_DISPLAY_SETTINGS: TrendDisplaySettings = {
  enabled: false,          // Off by default (like zones)
  visuals: DEFAULT_TREND_VISUAL_SETTINGS,
  config: DEFAULT_TREND_DETECTION_CONFIG,
  showHigherTf: false,
  higherTimeframe: null,   // Auto (one level up)
}
```

---

## Key Design Decisions

1. **Client-side detection, background persistence** — Same pattern as zones. Detection runs in the browser for responsiveness; results are persisted to DB asynchronously for historical analysis.

2. **Closing-price swing detection** — Per the methodology, swings are identified by comparing **closing prices** (not highs/lows). The recorded swing price level uses the wick (high for swing highs, low for swing lows) since that's the actual price extreme.

3. **Adaptive swing strength** — Automatically adjusts confirmation candles by timeframe. Users can override in advanced settings.

4. **Controlling swing as price line** — The most important level on the chart. A persistent horizontal line makes it impossible to miss.

5. **Separate color scheme** — Blue/orange for trends vs green/red for zones prevents visual confusion when both overlays are active simultaneously.

6. **Reusable across chart types** — The same `TrendPrimitive` attaches to all three chart components (standalone, closed-trade, draggable) via the same prop-passing pattern used by zones and curve.

7. **Settings parallel to zones** — Separate DB table, separate API routes, separate hook, but identical architectural pattern. This keeps concerns cleanly separated while maintaining consistency.

8. **Curve persistence added** — New `CurveSnapshot` model captures curve computation results that were previously ephemeral. Same fire-and-forget pattern as zone persistence.
