# Supply & Demand Zones — Complete Implementation Plan

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture Summary](#2-architecture-summary)
3. [Phase 1: Shared Types (packages/types)](#3-phase-1-shared-types)
4. [Phase 2: Zone Detection Algorithm (packages/shared)](#4-phase-2-zone-detection-algorithm)
5. [Phase 3: Database Schema & Service (packages/db)](#5-phase-3-database-schema--service)
6. [Phase 4: API Routes (apps/web)](#6-phase-4-api-routes)
7. [Phase 5: Chart Rendering Primitive (apps/web)](#7-phase-5-chart-rendering-primitive)
8. [Phase 6: React Hooks (apps/web)](#8-phase-6-react-hooks)
9. [Phase 7: UI Components (apps/web)](#9-phase-7-ui-components)
10. [Phase 8: Chart Integration](#10-phase-8-chart-integration)
11. [Phase 9: Multi-Timeframe Support](#11-phase-9-multi-timeframe-support)
12. [File Manifest](#12-file-manifest)
13. [Verification Checklist](#13-verification-checklist)

---

## 1. Overview

### What This Feature Does

Detects supply and demand zones on forex candlestick charts using the **Base Isolation Technique**, scores each zone using three **Odds Enhancers** (Strength, Time, Freshness), and renders them as interactive overlays on all candlestick charts in the app.

### Key Principles

- **Algorithm in `packages/shared`** — Pure TypeScript, zero dependencies on React/Node/DB. Accepts an array of OHLC candles + config, returns detected zones. Reusable by both frontend and daemon.
- **Persistence in `packages/db`** — Zones stored in SQLite via Prisma. Soft-update strategy: existing zones are updated, gone zones are marked invalidated, new zones are inserted.
- **Rendering via `ISeriesPrimitive`** — Custom Lightweight Charts primitive draws zone rectangles, labels, and score indicators on the canvas. Same pattern as existing `TradeLevelPrimitive`.
- **Settings: global + per-chart** — Global defaults in DB (`ZoneSettings` model), per-chart overrides in `ChartLayout.panels` JSON. Both configurable via a popover UI.

### Core Terminology (referenced throughout)

| Term | Definition |
|------|-----------|
| **Leg-in** | Price action before the base. Made of leg candle(s). Can be a rally (up) or drop (down). |
| **Base** | Candles between leg-in and leg-out. Small-bodied, overlapping. Where unfilled orders reside. |
| **Leg-out** | Explosive price action after the base. Leg candle(s). Rally = demand zone. Drop = supply zone. |
| **Leg candle** | Large body relative to range and ATR. Closes outside range of preceding candle. Represents imbalance. |
| **Base candle** | Small body relative to range. Overlaps with adjacent base candles. Represents equilibrium. |
| **Proximal line** | Zone boundary closest to current price. Entry level for a trade. |
| **Distal line** | Zone boundary farthest from current price. Stop loss level. |
| **DBR** | Drop-Base-Rally. Demand zone formation. |
| **RBR** | Rally-Base-Rally. Demand zone formation (continuation). |
| **RBD** | Rally-Base-Drop. Supply zone formation. |
| **DBD** | Drop-Base-Drop. Supply zone formation (continuation). |

---

## 2. Architecture Summary

```
┌──────────────────────────────────────────────────────────────────┐
│                        packages/types                            │
│   ZoneData, ZoneConfig, ZoneScores, ZoneFormationType,           │
│   ZoneType, ZoneStatus, CandleClassification, etc.               │
└─────────────────────────────┬────────────────────────────────────┘
                              │ imported by all layers
┌─────────────────────────────▼────────────────────────────────────┐
│                       packages/shared                            │
│   zone-detector.ts — Pure algorithm: candles + config → zones    │
│   zone-scorer.ts   — Odds Enhancers scoring engine               │
│   zone-utils.ts    — ATR calc, candle classification, helpers    │
└───────────┬──────────────────────────────────┬───────────────────┘
            │ FE imports                        │ Daemon imports (future)
┌───────────▼──────────────┐     ┌─────────────▼───────────────────┐
│      apps/web            │     │        apps/daemons              │
│  hooks/use-zones.ts      │     │  (future: auto zone detection,  │
│  components/charts/      │     │   condition triggers, etc.)      │
│    zone-primitive.ts     │     └─────────────────────────────────┘
│    zone-controls.tsx     │
│    zone-score-popover.tsx│
│    zone-summary-bar.tsx  │
│  api/zones/              │
└───────────┬──────────────┘
            │ persists via
┌───────────▼──────────────┐
│      packages/db         │
│  zone-service.ts         │
│  zone-settings-service.ts│
│  prisma/schema.prisma    │
│    + SupplyDemandZone    │
│    + ZoneSettings        │
└──────────────────────────┘
```

---

## 3. Phase 1: Shared Types

### File: `packages/types/src/index.ts` (append to existing)

Add the following type definitions at the end of the existing file, under a new section header:

```typescript
// ─── Supply & Demand Zones ──────────────────────────────────────────────────

/** Zone type: demand (buy setup) or supply (sell setup) */
export type ZoneType = "demand" | "supply"

/** Formation type determines distal line placement */
export type ZoneFormationType = "DBR" | "RBR" | "RBD" | "DBD"

/** Zone lifecycle status */
export type ZoneStatus = "active" | "tested" | "invalidated"

/** Candle classification for the algorithm */
export type CandleClassification = "leg" | "base" | "neutral"

/** Algorithm tuning preset */
export type ZonePreset = "conservative" | "standard" | "aggressive" | "custom"

/** Raw OHLC candle input for the zone detection algorithm */
export interface ZoneCandle {
  time: number    // Unix seconds
  open: number
  high: number
  low: number
  close: number
}

/** Classified candle with algorithm metadata */
export interface ClassifiedCandle extends ZoneCandle {
  classification: CandleClassification
  bodySize: number        // |close - open|
  range: number           // high - low
  bodyRatio: number       // bodySize / range (0-1)
  isBullish: boolean
  bodyVsAtr: number       // bodySize / ATR(14) ratio
}

/** Individual score for one Odds Enhancer */
export interface OddsEnhancerScore {
  value: number           // Numeric score
  max: number             // Maximum possible score
  label: string           // "Best" | "Good" | "Poor"
  explanation: string     // Plain English, e.g. "3 basing candles — minimal time at zone"
}

/** Complete zone score breakdown */
export interface ZoneScores {
  strength: OddsEnhancerScore   // 0, 1, or 2
  time: OddsEnhancerScore       // 0, 0.5, or 1
  freshness: OddsEnhancerScore  // 0, 1, or 2
  total: number                 // Sum: 0 to 5
}

/** Implied risk/reward from a zone to the nearest opposing zone */
export interface ZoneRiskReward {
  entryPrice: number            // Proximal line
  stopLossPrice: number         // Distal line (+ buffer)
  takeProfitPrice: number | null // Nearest opposing zone's proximal, or null if none found
  riskPips: number
  rewardPips: number | null
  ratio: string | null          // e.g. "3.2:1" or null if no TP
}

/** A detected supply or demand zone — output of the algorithm */
export interface ZoneData {
  /** Unique identifier (client-generated UUID for new zones, DB id for persisted) */
  id: string
  /** "demand" or "supply" */
  type: ZoneType
  /** Formation pattern: DBR, RBR, RBD, DBD */
  formation: ZoneFormationType
  /** Instrument in OANDA format, e.g. "EUR_USD" */
  instrument: string
  /** OANDA granularity, e.g. "H1" */
  timeframe: string
  /** Proximal line price — closest to current price (entry level) */
  proximalLine: number
  /** Distal line price — farthest from current price (SL level) */
  distalLine: number
  /** Zone width in price units (|proximal - distal|) */
  width: number
  /** Zone width in pips */
  widthPips: number
  /** Unix timestamp of the first candle in the base */
  baseStartTime: number
  /** Unix timestamp of the last candle in the base */
  baseEndTime: number
  /** Number of basing candles in the zone */
  baseCandles: number
  /** Index of the first base candle in the input array */
  baseStartIndex: number
  /** Index of the last base candle in the input array */
  baseEndIndex: number
  /** Score breakdown */
  scores: ZoneScores
  /** Implied R:R to nearest opposing zone */
  riskReward: ZoneRiskReward
  /** Zone lifecycle: active, tested, or invalidated */
  status: ZoneStatus
  /** How far price has penetrated into the zone (0 = fresh, 1 = fully breached) */
  penetrationPercent: number
  /** Number of times price has returned to this zone */
  testCount: number
  /** How many candles ago this zone was formed */
  ageInCandles: number
  /** Distance from current price to proximal line in pips */
  distanceFromPricePips: number
}

/** The higher-timeframe "curve" alignment status */
export type CurveAlignment = "aligned" | "conflicting" | "neutral"

/** Result of zone detection for a single instrument/timeframe combination */
export interface ZoneDetectionResult {
  instrument: string
  timeframe: string
  zones: ZoneData[]
  /** Nearest demand zone below current price */
  nearestDemand: ZoneData | null
  /** Nearest supply zone above current price */
  nearestSupply: ZoneData | null
  /** Current price used for calculations */
  currentPrice: number
  /** Total candles analyzed */
  candlesAnalyzed: number
  /** Timestamp of computation */
  computedAt: string // ISO 8601
}

/** Higher-TF zone overlay result */
export interface MultiTimeframeZoneResult {
  /** Primary timeframe zones */
  primary: ZoneDetectionResult
  /** One-level-up timeframe zones (e.g. H4 zones when viewing H1) */
  higher: ZoneDetectionResult | null
  /** Additional user-selected timeframe zones */
  additional: ZoneDetectionResult[]
  /** Overall curve alignment */
  curveAlignment: CurveAlignment
}

/** Algorithm configuration — tunable parameters */
export interface ZoneDetectionConfig {
  /** Preset name for quick selection */
  preset: ZonePreset
  /** Minimum candle body-to-range ratio to classify as a leg candle (0-1) */
  minLegBodyRatio: number
  /** Minimum candle body size relative to ATR(14) to classify as leg */
  minLegBodyAtr: number
  /** Maximum candle body-to-range ratio to classify as a base candle (0-1) */
  maxBaseBodyRatio: number
  /** Maximum number of consecutive base candles before the zone is too wide */
  maxBaseCandles: number
  /** Minimum move-out distance as a multiple of zone width */
  minMoveOutMultiple: number
  /** ATR period for normalization */
  atrPeriod: number
  /** Freshness: penetration % threshold for "tested" (0.5 = 50%) */
  freshTestedThreshold: number
  /** Freshness: penetration % threshold for "invalidated" */
  freshInvalidatedThreshold: number
  /** Minimum number of leg candles required for leg-in and leg-out */
  minLegCandles: number
}

/** User-facing zone display settings (stored in DB + per-chart overrides) */
export interface ZoneDisplaySettings {
  /** Master toggle */
  enabled: boolean
  /** Maximum zones to show per type (demand + supply separately) */
  maxZonesPerType: number
  /** Minimum total score to display a zone (0-5) */
  minScore: number
  /** Override timeframe (null = use chart's current TF) */
  timeframeOverride: string | null
  /** Number of candles to analyze (lookback) */
  lookbackCandles: number
  /** Show zones that have been tested/invalidated */
  showInvalidated: boolean
  /** Show zones from one-level-up timeframe */
  showHigherTf: boolean
  /** Additional timeframes to show zones from */
  additionalTimeframes: string[]
  /** Algorithm tuning config */
  algorithmConfig: ZoneDetectionConfig
}

/** Persisted zone record — extends ZoneData with DB fields */
export interface PersistedZoneData extends ZoneData {
  /** DB row ID */
  dbId: string
  /** First time this zone was detected */
  firstDetectedAt: string
  /** Last time this zone was confirmed still valid */
  lastConfirmedAt: string
  /** Last time scores were recomputed */
  lastScoredAt: string
}

/** Zone settings response from the API */
export interface ZoneSettingsResponse {
  global: ZoneDisplaySettings
}

/** Chart panel config extension — add zone overrides */
export interface ChartPanelZoneOverrides {
  enabled?: boolean
  maxZonesPerType?: number
  minScore?: number
  showInvalidated?: boolean
  showHigherTf?: boolean
}
```

### Preset Configurations (will live in `packages/shared/src/zone-presets.ts`)

These are the three presets + their numeric configurations:

```typescript
export const ZONE_PRESETS: Record<ZonePreset, ZoneDetectionConfig> = {
  conservative: {
    preset: "conservative",
    minLegBodyRatio: 0.65,
    minLegBodyAtr: 1.8,
    maxBaseBodyRatio: 0.40,
    maxBaseCandles: 4,
    minMoveOutMultiple: 3.0,
    atrPeriod: 14,
    freshTestedThreshold: 0.30,
    freshInvalidatedThreshold: 1.0,
    minLegCandles: 1,
  },
  standard: {
    preset: "standard",
    minLegBodyRatio: 0.55,
    minLegBodyAtr: 1.4,
    maxBaseBodyRatio: 0.50,
    maxBaseCandles: 6,
    minMoveOutMultiple: 2.0,
    atrPeriod: 14,
    freshTestedThreshold: 0.50,
    freshInvalidatedThreshold: 1.0,
    minLegCandles: 1,
  },
  aggressive: {
    preset: "aggressive",
    minLegBodyRatio: 0.45,
    minLegBodyAtr: 1.0,
    maxBaseBodyRatio: 0.55,
    maxBaseCandles: 8,
    minMoveOutMultiple: 1.5,
    atrPeriod: 14,
    freshTestedThreshold: 0.50,
    freshInvalidatedThreshold: 1.0,
    minLegCandles: 1,
  },
  custom: {
    // Same as standard initially; user modifies individual fields
    preset: "custom",
    minLegBodyRatio: 0.55,
    minLegBodyAtr: 1.4,
    maxBaseBodyRatio: 0.50,
    maxBaseCandles: 6,
    minMoveOutMultiple: 2.0,
    atrPeriod: 14,
    freshTestedThreshold: 0.50,
    freshInvalidatedThreshold: 1.0,
    minLegCandles: 1,
  },
}
```

---

## 4. Phase 2: Zone Detection Algorithm

This is the heart of the feature. Three new files in `packages/shared/src/`:

### File 1: `packages/shared/src/zone-utils.ts`

**Purpose:** Low-level helpers used by the detector and scorer.

```
Functions to implement:
```

#### `computeATR(candles: ZoneCandle[], period: number): number[]`
- Computes Average True Range for each candle.
- True Range = max(high-low, |high-prevClose|, |low-prevClose|).
- Returns array of ATR values (first `period` entries are partial averages).
- Uses Simple Moving Average (SMA) for the initial ATR, then Wilder's smoothing: `ATR_new = ((ATR_prev * (period-1)) + TR) / period`.

#### `classifyCandles(candles: ZoneCandle[], config: ZoneDetectionConfig): ClassifiedCandle[]`
- For each candle, compute:
  - `bodySize = Math.abs(close - open)`
  - `range = high - low` (if range === 0, treat as base)
  - `bodyRatio = range > 0 ? bodySize / range : 0`
  - `isBullish = close >= open`
  - `bodyVsAtr = atr[i] > 0 ? bodySize / atr[i] : 0`
- Classification logic:
  - **Leg candle:** `bodyRatio >= config.minLegBodyRatio AND bodyVsAtr >= config.minLegBodyAtr`
  - **Base candle:** `bodyRatio <= config.maxBaseBodyRatio OR bodyVsAtr < config.minLegBodyAtr * 0.6`
  - **Neutral:** Everything else (neither clearly leg nor base). Treated as base for zone detection purposes but noted separately for scoring accuracy.

#### `isExplosiveMove(candles: ClassifiedCandle[], startIdx: number, direction: "up" | "down"): { endIdx: number; isExplosive: boolean; consecutiveLegs: number }`
- Starting at `startIdx`, walk forward (or backward) looking for consecutive leg candles in the same direction.
- For "up": each candle must have `close > prevClose` and be classified as "leg".
- For "down": each candle must have `close < prevClose` and be classified as "leg".
- Returns how far the explosive move extends and how many consecutive legs.
- A move is "explosive" if it has at least `config.minLegCandles` consecutive leg candle(s).

#### `findBaseCluster(candles: ClassifiedCandle[], legOutIdx: number, direction: "left"): { startIdx: number; endIdx: number; baseCandles: ClassifiedCandle[] }`
- Starting from `legOutIdx`, walk left (decreasing index) to find the cluster of base/neutral candles.
- Base cluster ends when a leg candle is encountered (this becomes the leg-in).
- Returns the indices bounding the base and the candles within it.
- Validates: cluster length must be >= 1 and <= `config.maxBaseCandles`.

#### `getHigherTimeframe(timeframe: string): string | null`
- Maps each timeframe to one level up:
  - M1 → M5, M5 → M15, M15 → M30, M30 → H1, H1 → H4, H4 → D, D → W, W → M, M → null
- Used for multi-TF zone detection.

#### `computeZoneWidth(proximal: number, distal: number, instrument: string): { width: number; widthPips: number }`
- Uses `getPipSize()` from existing `pip-utils.ts`.

### File 2: `packages/shared/src/zone-detector.ts`

**Purpose:** Main detection engine. Pure function: candles in → zones out.

```
Primary export:
```

#### `detectZones(candles: ZoneCandle[], instrument: string, timeframe: string, config: ZoneDetectionConfig, currentPrice: number): ZoneDetectionResult`

**Algorithm — step by step:**

This follows the exact Base Isolation Technique from the instructional material:

```
STEP 1: Classify all candles
  - Run classifyCandles() to tag each candle as leg/base/neutral

STEP 2: Find all explosive moves (leg-outs)
  - Scan right-to-left from the most recent candle
  - For each position, check if an explosive rally (demand) or drop (supply) starts here
  - An explosive rally: sequence of bullish leg candles with consecutive higher closes
  - An explosive drop: sequence of bearish leg candles with consecutive lower closes

STEP 3: Base Isolation (for each explosive move found)
  - STEP 3a: Identify the first leg-out candle
    - Going right-to-left from current price, the first leg candle of the explosive move
    - Draw conceptual "vertical line 1" here (this is baseEndIndex + 1)

  - STEP 3b: Walk left through the base
    - From the leg-out, move left through base/neutral candles
    - These are the basing candles (small bodies, overlapping)
    - Stop when you hit a leg candle (this is the leg-in)
    - Draw conceptual "vertical line 2" here (this is baseStartIndex - 1)

  - STEP 3c: Validate the base
    - Base must have 1+ candles and <= config.maxBaseCandles
    - The leg-in must exist (at least one leg candle before the base)

  - STEP 3d: Determine formation type
    - Look at leg-in direction + leg-out direction:
      - Drop (leg-in) + Rally (leg-out) = DBR (demand)
      - Rally (leg-in) + Rally (leg-out) = RBR (demand)
      - Rally (leg-in) + Drop (leg-out) = RBD (supply)
      - Drop (leg-in) + Drop (leg-out) = DBD (supply)

STEP 4: Place Proximal and Distal Lines

  FOR DEMAND ZONES (DBR and RBR):
    - Proximal line = highest candle BODY (max of open, close) among all base candles
    - Distal line depends on formation:
      - DBR: lowest PRICE (low) of the ENTIRE Drop-Base-Rally sequence
              (includes leg-in drop candles + base + first leg-out candle)
      - RBR: lowest PRICE (low) of the Base-Rally portion only
              (base candles + leg-out candles, NOT the leg-in rally)

  FOR SUPPLY ZONES (RBD and DBD):
    - Proximal line = lowest candle BODY (min of open, close) among all base candles
    - Distal line depends on formation:
      - RBD: highest PRICE (high) of the ENTIRE Rally-Base-Drop sequence
              (includes leg-in rally candles + base + first leg-out candle)
      - DBD: highest PRICE (high) of the Base-Drop portion only
              (base candles + leg-out candles, NOT the leg-in drop)

STEP 5: Validate zone
  - Zone width must be > 0
  - Proximal and distal must not be equal
  - For demand: proximal > distal
  - For supply: proximal < distal

STEP 6: Score the zone (delegate to zone-scorer.ts)

STEP 7: Compute metadata
  - Zone status (active/tested/invalidated based on current price penetration)
  - Distance from current price in pips
  - Age in candles
  - R:R to nearest opposing zone

STEP 8: Filter and rank
  - Zones are ranked by total score descending, then by distance from current price ascending
  - De-duplicate overlapping zones (if two zones overlap > 50%, keep the higher-scored one)
```

**Key implementation details:**

```typescript
// Scanning direction:
// - For DEMAND zones: scan right-to-left, looking DOWN and LEFT for explosive RALLIES
//   (rally = leg-out going up, we trace back left to find the base and leg-in)
// - For SUPPLY zones: scan right-to-left, looking UP and LEFT for explosive DROPS
//   (drop = leg-out going down, we trace back left to find the base and leg-in)

// "Without cutting through candles" rule:
// When scanning for demand zones, only consider rallies where the zone's proximal line
// is BELOW the current price (price hasn't already passed through it from above).
// When scanning for supply zones, only consider drops where the zone's proximal line
// is ABOVE the current price.
// This ensures we only find zones that are still relevant to current price action.

// Zone status based on current price:
// - DEMAND zone:
//   - active: currentPrice > proximalLine (price is above the zone)
//   - tested: currentPrice <= proximalLine AND currentPrice > distalLine
//   - invalidated: currentPrice <= distalLine (price broke through entirely)
// - SUPPLY zone:
//   - active: currentPrice < proximalLine (price is below the zone)
//   - tested: currentPrice >= proximalLine AND currentPrice < distalLine
//   - invalidated: currentPrice >= distalLine (price broke through entirely)
```

### File 3: `packages/shared/src/zone-scorer.ts`

**Purpose:** Computes the three Odds Enhancer scores for a zone.

#### `scoreZone(zone: RawZoneCandidate, allCandles: ClassifiedCandle[], opposingZones: RawZoneCandidate[], config: ZoneDetectionConfig): ZoneScores`

**Strength Score (0, 1, or 2):**

Two sub-components, each worth 1 point:

**Sub-component A: Move-out distance (0 or 1)**
- Measure the distance from proximal line to the most extreme price of the leg-out candle(s).
- Compare to zone width: `moveOutDistance / zoneWidth`
- Score 1 if ratio >= `config.minMoveOutMultiple` (default 2.0)
- Score 0 if ratio < `config.minMoveOutMultiple`
- This means: a strong move-out should be at least 2x the zone width.

**Sub-component B: Breakout past opposing zone (0 or 1)**
- For demand: did the rally (leg-out) break ABOVE a preceding supply zone's proximal line?
- For supply: did the drop (leg-out) break BELOW a preceding demand zone's proximal line?
- Score 1 if yes (the move-out crossed an opposing zone)
- Score 0 if no opposing zone was broken
- To check: compare the extreme price of leg-out candles against all detected opposing zones that existed before this zone formed.

**Strength total: 0 (Poor), 1 (Good), 2 (Best)**

```
Plain English explanations:
- 2: "Strong move out (X pips, Y.Zx zone width) + broke past opposing [supply/demand] zone"
- 1 (move only): "Strong move out (X pips, Y.Zx zone width), no opposing zone breakout"
- 1 (breakout only): "Moderate move out but broke past opposing [supply/demand] zone"
- 0: "Weak move out (X pips, Y.Zx zone width), no opposing zone breakout"
```

**Time Score (0, 0.5, or 1):**

Based on the number of basing candles:
- 1-3 basing candles → **1** (Best) — "X basing candles — minimal time at zone"
- 4-6 basing candles → **0.5** (Good) — "X basing candles — moderate time at zone"
- More than 6 basing candles → **0** (Poor) — "X basing candles — extended time at zone"

The less time price spends basing, the more unfilled orders remain.

**Freshness Score (0, 1, or 2):**

Based on how much price has returned to and penetrated the zone since it formed:

- **Not tested** (price never returned to the zone after leg-out) → **2** (Best)
  - "Zone never tested — maximum unfilled orders remain"
- **Tested <= 50%** (price re-entered the zone but only penetrated up to 50% of zone width from proximal toward distal) → **1** (Good)
  - "Zone tested once, ~X% penetration — some orders filled"
- **Tested > 50%** (price penetrated more than 50% of zone width, approaching or reaching the distal line) → **0** (Poor)
  - "Zone deeply tested (~X% penetration) — most orders likely filled"

Penetration calculation:
```typescript
// For demand zone (proximal > distal):
//   penetration = (proximalLine - lowestPriceInZoneAfterFormation) / (proximalLine - distalLine)
// For supply zone (distal > proximal):
//   penetration = (highestPriceInZoneAfterFormation - proximalLine) / (distalLine - proximalLine)
// Clamp to 0-1 range
```

To compute freshness, scan all candles AFTER the zone's leg-out to see if/how far price returned:
```typescript
function computeFreshness(
  zone: { proximalLine: number; distalLine: number; type: ZoneType; baseEndIndex: number },
  candles: ZoneCandle[],
): { testCount: number; penetrationPercent: number }
```

**Total Score = Strength + Time + Freshness → range 0 to 5**

### File 4: `packages/shared/src/zone-presets.ts`

Contains `ZONE_PRESETS` record (shown in Phase 1 above), the `DEFAULT_ZONE_DISPLAY_SETTINGS` constant, and `getDefaultZoneConfig()` helper.

```typescript
export const DEFAULT_ZONE_DISPLAY_SETTINGS: ZoneDisplaySettings = {
  enabled: false, // Off by default until user explicitly enables
  maxZonesPerType: 3,
  minScore: 2.0,
  timeframeOverride: null,
  lookbackCandles: 500,
  showInvalidated: false,
  showHigherTf: false,
  additionalTimeframes: [],
  algorithmConfig: ZONE_PRESETS.standard,
}
```

### Exports Update: `packages/shared/src/index.ts`

Add to existing barrel export:
```typescript
export { detectZones } from "./zone-detector"
export { scoreZone } from "./zone-scorer"
export { computeATR, classifyCandles, getHigherTimeframe, computeZoneWidth } from "./zone-utils"
export { ZONE_PRESETS, DEFAULT_ZONE_DISPLAY_SETTINGS } from "./zone-presets"
```

---

## 5. Phase 3: Database Schema & Service

### Schema Addition: `packages/db/prisma/schema.prisma`

Add two new models:

```prisma
model SupplyDemandZone {
  id                String   @id @default(uuid())
  instrument        String   // "EUR_USD"
  timeframe         String   // "H1"
  type              String   // "demand" | "supply"
  formation         String   // "DBR" | "RBR" | "RBD" | "DBD"
  proximalLine      Float
  distalLine        Float
  width             Float
  widthPips         Float
  baseStartTime     Int      // Unix seconds
  baseEndTime       Int      // Unix seconds
  baseCandles       Int
  baseStartIndex    Int
  baseEndIndex      Int
  scoreStrength     Float    @default(0)
  scoreTime         Float    @default(0)
  scoreFreshness    Float    @default(0)
  scoreTotal        Float    @default(0)
  scoresJson        String   @default("{}") // Full ZoneScores JSON for explanations
  riskRewardJson    String   @default("{}") // ZoneRiskReward JSON
  status            String   @default("active") // "active" | "tested" | "invalidated"
  penetrationPct    Float    @default(0)
  testCount         Int      @default(0)
  firstDetectedAt   DateTime @default(now())
  lastConfirmedAt   DateTime @default(now())
  lastScoredAt      DateTime @default(now())
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([instrument, timeframe, baseStartTime, baseEndTime, type])
  @@index([instrument, timeframe, status])
  @@index([instrument, timeframe, scoreTotal])
  @@index([status])
}

model ZoneSettings {
  id           Int      @id @default(1)
  settingsJson String   @default("{}") // JSON: ZoneDisplaySettings
  updatedAt    DateTime @updatedAt
}
```

### Service: `packages/db/src/zone-service.ts`

```
Functions to implement:
```

#### `upsertZones(instrument: string, timeframe: string, zones: ZoneData[]): Promise<void>`
- Soft-update strategy:
  1. Fetch all existing zones for this instrument+timeframe
  2. For each incoming zone, match by unique key: `(instrument, timeframe, baseStartTime, baseEndTime, type)`
  3. **Match found:** Update scores, status, penetration, lastConfirmedAt, lastScoredAt
  4. **No match (new zone):** Insert with firstDetectedAt = now
  5. **Existing zone not in incoming set:** Mark as `status: "invalidated"`, set lastConfirmedAt to now
- All done in a transaction for consistency.

#### `getZones(instrument: string, timeframe: string, options?: { status?: ZoneStatus[]; minScore?: number; limit?: number }): Promise<PersistedZoneData[]>`
- Query with optional filters.
- Default: returns active zones ordered by scoreTotal DESC.

#### `getZonesByInstrument(instrument: string): Promise<PersistedZoneData[]>`
- All zones across all timeframes for an instrument (useful for multi-TF).

#### `invalidateZone(id: string): Promise<void>`
- Set status = "invalidated".

#### `cleanupOldZones(olderThanDays: number): Promise<number>`
- Delete invalidated zones older than N days.

### Service: `packages/db/src/zone-settings-service.ts`

#### `getZoneSettings(): Promise<ZoneDisplaySettings>`
- Returns global settings, falling back to `DEFAULT_ZONE_DISPLAY_SETTINGS`.

#### `saveZoneSettings(settings: ZoneDisplaySettings): Promise<void>`
- Upserts the single settings row.

### Barrel Export: `packages/db/src/index.ts`

Add:
```typescript
export {
  upsertZones,
  getZones,
  getZonesByInstrument,
  invalidateZone,
  cleanupOldZones,
} from "./zone-service"

export {
  getZoneSettings,
  saveZoneSettings,
} from "./zone-settings-service"
```

---

## 6. Phase 4: API Routes

### Route 1: `apps/web/src/app/api/zones/[instrument]/route.ts`

**GET** `/api/zones/[instrument]?timeframe=H1&lookback=500&minScore=2&maxPerType=3&showInvalidated=false`

1. Fetch candle data from OANDA (reuse existing candle fetching logic from `/api/candles/[instrument]`)
2. Run `detectZones()` from `@fxflow/shared`
3. Persist results via `upsertZones()` from `@fxflow/db`
4. Return `ZoneDetectionResult` as JSON

Query params:
- `timeframe` (required) — granularity
- `lookback` (optional, default 500) — candle count
- `minScore` (optional, default 0) — filter
- `maxPerType` (optional, default 10) — limit per demand/supply
- `showInvalidated` (optional, default false) — include invalidated zones
- `higherTf` (optional, default false) — also compute one-level-up zones
- `additionalTfs` (optional) — comma-separated list of extra timeframes

Response: `ApiResponse<MultiTimeframeZoneResult>`

Cache-Control: `public, s-maxage=30, stale-while-revalidate=120`

### Route 2: `apps/web/src/app/api/zones/settings/route.ts`

**GET** `/api/zones/settings`
- Returns `ZoneSettingsResponse` from DB

**PUT** `/api/zones/settings`
- Body: `ZoneDisplaySettings`
- Saves to DB via `saveZoneSettings()`

---

## 7. Phase 5: Chart Rendering Primitive

### File: `apps/web/src/components/charts/zone-primitive.ts`

A new `ISeriesPrimitive` implementation following the exact same pattern as the existing `trade-level-primitive.ts`.

**Class: `ZonePrimitive implements ISeriesPrimitive<Time>`**

Renders on the chart canvas:
- **Filled rectangles** between proximal and distal lines for each zone
- **Color coding:**
  - Demand: `#22c55e` (green) with opacity based on score (6%-15%)
  - Supply: `#ef4444` (red) with opacity based on score (6%-15%)
  - Higher-TF zones: Use dashed borders + slightly different shade
  - Invalidated zones (when shown): Hatched/striped pattern at 4% opacity, gray labels
- **Proximal line:** Solid, 1.5px thick
- **Distal line:** Dashed, 1px thick
- **Label pill** in the upper-right corner of each zone rectangle:
  - Format: `"DBR 4.5"` (formation + total score)
  - Background matches zone color at 20% opacity
  - Font: bold 9px (same as trade-level-primitive)
  - If R:R is available, second line: `"3.2:1"`
- **Score-based opacity mapping:**
  - Score 4.5-5.0: fill opacity 15%, label fully opaque
  - Score 3.0-4.4: fill opacity 10%, label 90% opaque
  - Score 1.5-2.9: fill opacity 7%, label 70% opaque
  - Score 0-1.4: fill opacity 5%, label 50% opaque
- **"Nearest zone" highlight:** The single nearest demand below price and nearest supply above price get an extra 1px solid border in their zone color

**Rendering approach:**

For each zone:
1. Convert `baseStartTime` and `baseEndTime` to x-coordinates via `timeScale.timeToCoordinate()`
2. Convert `proximalLine` and `distalLine` to y-coordinates via `series.priceToCoordinate()`
3. Extend the zone rectangle from the base start to the right edge of the visible chart (zones extend forward in time)
4. Draw the filled rectangle, borders, and label

**Public API:**
```typescript
class ZonePrimitive implements ISeriesPrimitive<Time> {
  setZones(zones: ZoneData[], currentPrice: number, isDark: boolean): void
  setHigherTfZones(zones: ZoneData[]): void
  clearAll(): void
}
```

The primitive handles its own `attached()`, `detached()`, `paneViews()`, `updateAllViews()` lifecycle — identical pattern to `TradeLevelPrimitive`.

---

## 8. Phase 6: React Hooks

### Hook 1: `apps/web/src/hooks/use-zones.ts`

**Purpose:** Main hook that orchestrates zone detection, persistence, and state for a single chart.

```typescript
interface UseZonesOptions {
  instrument: string
  timeframe: string
  enabled: boolean
  /** Candle data already loaded in the chart (avoids re-fetching) */
  candles: ZoneCandle[] | null
  /** Current mid-price for distance/status calculations */
  currentPrice: number | null
  /** Display settings (merged global + per-chart overrides) */
  settings: ZoneDisplaySettings
}

interface UseZonesReturn {
  /** Filtered, ranked zones ready for rendering */
  zones: ZoneData[]
  /** Higher-TF zones (if enabled) */
  higherTfZones: ZoneData[]
  /** Nearest demand below price */
  nearestDemand: ZoneData | null
  /** Nearest supply above price */
  nearestSupply: ZoneData | null
  /** Curve alignment status */
  curveAlignment: CurveAlignment
  /** Whether zones are currently being computed */
  isComputing: boolean
  /** Last computation timestamp */
  lastComputedAt: string | null
  /** Force recompute */
  recompute: () => void
  /** Error message if computation failed */
  error: string | null
}
```

**Behavior:**
1. When `enabled` is true and `candles` array changes (new candle close detected), run `detectZones()` from `@fxflow/shared` **in a Web Worker** to avoid blocking the main thread.
2. After detection, persist results via `POST /api/zones/[instrument]` (or direct API call).
3. For higher-TF zones: fetch additional candles via `fetchCandles()` from `chart-utils.ts`, then detect zones on those too.
4. Memoize results to avoid re-rendering on every tick.
5. Re-detect when: candles array length changes (new candle closed), timeframe changes, instrument changes, or `recompute()` is called manually.
6. **Does NOT re-detect on every price tick** — only on new candle close (detected by comparing candle array length).

### Hook 2: `apps/web/src/hooks/use-zone-settings.ts`

**Purpose:** Fetch/save global zone settings + merge with per-chart overrides.

```typescript
interface UseZoneSettingsReturn {
  /** Merged settings (global defaults + per-chart overrides) */
  settings: ZoneDisplaySettings
  /** Global settings only */
  globalSettings: ZoneDisplaySettings
  /** Save global settings */
  saveGlobal: (settings: ZoneDisplaySettings) => Promise<void>
  /** Per-chart overrides for the current panel */
  overrides: ChartPanelZoneOverrides
  /** Update per-chart overrides */
  setOverrides: (overrides: ChartPanelZoneOverrides) => void
  /** Loading state */
  isLoading: boolean
}
```

**Behavior:**
- Fetches global settings from `/api/zones/settings` on mount.
- Merges with per-chart overrides from `ChartLayout.panels[index]` (stored in the existing `ChartPanelConfig` JSON — we extend it with an optional `zoneOverrides` field).
- `saveGlobal()` PUTs to `/api/zones/settings` and invalidates the SWR cache.
- `setOverrides()` updates the local panel config via the existing `onConfigChange` pattern.

---

## 9. Phase 7: UI Components

### Component 1: `apps/web/src/components/charts/zone-controls-popover.tsx`

**Purpose:** Popover (desktop) / bottom sheet (mobile) for zone configuration.

**Trigger:** New button in the chart panel toolbar (between the signal eye toggle and the bid/ask display). Uses a `Layers` icon from Lucide.

**Content layout:**
```
┌─────────────────────────────────────┐
│  Supply & Demand Zones          [X] │
│  ─────────────────────────────────  │
│  ● Enabled                    [ON]  │
│  ─────────────────────────────────  │
│  Preset   [Standard          ▼]    │
│  ─────────────────────────────────  │
│  Max zones per type    [3  ▼]      │
│  Min score             [2.0 ▼]     │
│  ─────────────────────────────────  │
│  Timeframe    [Current chart ▼]    │
│  Lookback     [500 candles   ▼]    │
│  ─────────────────────────────────  │
│  ☐ Show invalidated zones          │
│  ☐ Show higher-TF zones            │
│  ─────────────────────────────────  │
│  ▸ Advanced (Algorithm Tuning)      │
│  ─────────────────────────────────  │
│  Last computed: 3s ago    [↻]      │
└─────────────────────────────────────┘
```

**"Advanced" expandable section** (only visible when preset = "Custom"):
```
│  ▾ Advanced (Algorithm Tuning)      │
│    Leg body ratio      [0.55]      │
│    Leg body vs ATR     [1.4 ]      │
│    Base body ratio     [0.50]      │
│    Max base candles    [6   ]      │
│    Move-out multiple   [2.0 ]      │
│    ATR period          [14  ]      │
│    Tested threshold    [50% ]      │
```

Each input is a small numeric input field with +/- steppers.

**Implementation:**
- Uses existing `Popover` component from `apps/web/src/components/ui/popover.tsx`
- On mobile (`useIsMobile()` hook), renders as a Sheet/bottom-sheet instead
- All changes immediately update the settings (debounced 300ms for numeric inputs)
- The "Preset" dropdown: selecting Conservative/Standard/Aggressive auto-fills the algorithm config. Selecting Custom enables manual editing.
- Toggle switches use the existing toggle/switch patterns in the app (native `<input type="checkbox">` styled as toggles, since the app uses native `<select>` and doesn't have a shadcn Switch component)

### Component 2: `apps/web/src/components/charts/zone-score-popover.tsx`

**Purpose:** Score breakdown shown when user interacts with a zone on the chart.

**Trigger:** Clicking/tapping a zone rectangle on the chart. The `ZonePrimitive` detects clicks by hit-testing mouse coordinates against zone rectangles and emits a callback.

**Content layout:**
```
┌─────────────────────────────────────┐
│  Demand Zone (DBR)        4.5 / 5  │
│  ─────────────────────────────────  │
│  Strength   ██████████░░  2 / 2    │
│  Strong move out (47 pips, 3.2x    │
│  zone) + broke past supply zone    │
│  ─────────────────────────────────  │
│  Time       █████████████  1 / 1   │
│  2 basing candles — minimal time   │
│  ─────────────────────────────────  │
│  Freshness  ████████░░░░  1.5 / 2  │
│  Tested once (~30% penetration)    │
│  ─────────────────────────────────  │
│  Proximal: 1.08540  Distal: 1.08420│
│  Width: 12 pips     Age: 14 candles│
│  R:R: 3.2:1 to nearest supply      │
│  Formed: Mar 8, 2026 14:00         │
└─────────────────────────────────────┘
```

**Score color coding:**
- Score value / max shown as mini progress bar
- Green bar for 80-100% of max, amber for 40-79%, red for 0-39%

**Mobile:** Renders as a bottom sheet (half-screen height) instead of a popover.

**Implementation:**
- Receives `ZoneData` as prop
- Computes all display values from the zone data
- Uses `formatPips()` from `@fxflow/shared` for pip formatting
- Uses `getDecimalPlaces()` for price precision
- Progress bars are simple `<div>` elements with width% and background color

### Component 3: `apps/web/src/components/charts/zone-summary-bar.tsx`

**Purpose:** Thin bar showing nearest DZ below + nearest SZ above current price.

**Position:** Between the chart panel toolbar and the chart canvas. Only visible when zones are enabled and at least one zone exists.

**Desktop layout:**
```
┌──────────────────────────────────────────────────────────────────┐
│ ▼ DZ: 1.08420 (DBR 4.5) 23 pips  │  ▲ SZ: 1.09180 (RBD 3.5) 52 pips │
└──────────────────────────────────────────────────────────────────┘
```

**Mobile layout:**
```
┌──────────────────────────┐
│ ▼ 1.0842 23p │ ▲ 1.0918 52p │
└──────────────────────────┘
```

**Features:**
- Down arrow (green) + demand zone info on the left
- Up arrow (red) + supply zone info on the right
- Distance updates in real-time as price moves (derived from `currentPrice` prop)
- Clicking either side scrolls the chart to center that zone and opens the score popover
- If no demand/supply zone exists, that side shows "—"
- Height: 24px (compact, minimal visual footprint)

**Implementation:**
- Simple flex row with two halves
- Receives `nearestDemand`, `nearestSupply`, `currentPrice` as props
- Uses `priceToPips()` from `@fxflow/shared` for distance calculation
- On click, calls a callback to scroll chart and open score popover

### Component 4: `apps/web/src/components/charts/zone-legend.tsx`

**Purpose:** Small, collapsible legend showing what the zone colors mean. Appears as a floating badge in the bottom-left corner of the chart.

**Layout:**
```
┌────────────────────────┐
│ ■ Demand  ■ Supply     │
│ ◻ Higher-TF  ▤ Tested  │
└────────────────────────┘
```

Collapses to just `"SZ/DZ"` text when not hovered. Expands on hover/tap.

---

## 10. Phase 8: Chart Integration

This phase wires everything together by modifying existing chart components.

### Modification 1: Extend `ChartPanelConfig` type

In `packages/types/src/index.ts`, find the existing `ChartPanelConfig` interface and add:

```typescript
export interface ChartPanelConfig {
  instrument: string
  timeframe: string
  /** Per-chart zone display overrides (optional) */
  zoneOverrides?: ChartPanelZoneOverrides
}
```

### Modification 2: `chart-panel.tsx`

Add zone support to the existing `ChartPanel` component:

1. **Import** new components and hooks:
   ```typescript
   import { ZoneControlsPopover } from "./zone-controls-popover"
   import { ZoneSummaryBar } from "./zone-summary-bar"
   import { useZoneSettings } from "@/hooks/use-zone-settings"
   ```

2. **Add zone controls button** to the toolbar (after the existing signal eye toggle):
   ```tsx
   <ZoneControlsPopover
     settings={zoneSettings.settings}
     onSettingsChange={...}
     lastComputedAt={zones.lastComputedAt}
     onRecompute={zones.recompute}
   />
   ```

3. **Add summary bar** between toolbar and chart area:
   ```tsx
   {zoneSettings.settings.enabled && (
     <ZoneSummaryBar
       nearestDemand={zones.nearestDemand}
       nearestSupply={zones.nearestSupply}
       currentPrice={currentMidPrice}
       instrument={displayInstrument}
       onZoneClick={handleZoneClick}
     />
   )}
   ```

4. **Pass zone data** to child chart components (see Modification 3-5).

### Modification 3: `standalone-chart.tsx`

Add zone primitive support:

1. Add new ref: `const zonePrimRef = useRef<ZonePrimitive | null>(null)`
2. After series creation, attach the primitive:
   ```typescript
   const zonePrim = new ZonePrimitive()
   series.attachPrimitive(zonePrim)
   zonePrimRef.current = zonePrim
   ```
3. Add new prop: `zones?: ZoneData[]`, `higherTfZones?: ZoneData[]`, `currentPrice?: number`
4. Add effect to sync zones to the primitive:
   ```typescript
   useEffect(() => {
     if (zonePrimRef.current) {
       zonePrimRef.current.setZones(zones ?? [], currentPrice ?? 0, isDark)
       zonePrimRef.current.setHigherTfZones(higherTfZones ?? [])
     }
   }, [zones, higherTfZones, currentPrice, isDark])
   ```
5. Add cleanup in the dispose function.
6. Add click handler for zone interaction (hit-test mouse position against zone rectangles).

### Modification 4: `tradingview-chart.tsx`

Same changes as standalone-chart.tsx:
1. Add `zonePrimRef`, attach `ZonePrimitive` after series creation
2. Accept `zones`, `higherTfZones`, `currentPrice` props
3. Sync zones to primitive via effect
4. Cleanup on dispose

### Modification 5: `draggable-trade-chart.tsx`

Same changes as tradingview-chart.tsx. The zone primitive coexists with the existing trade-level primitive and draggable price lines — they render on different z-layers.

### Modification 6: `chart-panel.tsx` — Wire the `useZones` hook

Inside `ChartPanelInner`, add the zone detection hook:

```typescript
const { settings: zoneSettings, overrides, setOverrides, saveGlobal } = useZoneSettings(panelIndex)

// Get candle data from the chart (via a new ref callback or shared state)
const { zones, higherTfZones, nearestDemand, nearestSupply, curveAlignment, isComputing, lastComputedAt, recompute } = useZones({
  instrument: displayInstrument,
  timeframe: effectiveTimeframe,
  enabled: zoneSettings.enabled,
  candles: candlesRef.current,  // Shared from dynamic candles hook
  currentPrice: currentMidPrice,
  settings: zoneSettings,
})
```

Then pass `zones` and `higherTfZones` down to the chart components:
```tsx
<StandaloneChart
  instrument={config.instrument}
  timeframe={config.timeframe}
  lastTick={lastTick}
  loadDelay={loadDelay}
  orderOverlay={orderOverlay}
  markers={chartMarkers}
  zones={zoneSettings.enabled ? zones : undefined}
  higherTfZones={zoneSettings.enabled ? higherTfZones : undefined}
  currentPrice={currentMidPrice}
/>
```

### Candle Data Sharing

The `useZones` hook needs access to the candle data already loaded by the chart. Currently, candles live inside each chart component's local state. To share them:

**Option: Candle callback prop**

Add an `onCandlesLoaded` callback prop to all three chart components (`StandaloneChart`, `TradingViewChart`, `DraggableTradeChart`):

```typescript
interface StandaloneChartProps {
  // ... existing props
  onCandlesLoaded?: (candles: ZoneCandle[]) => void
}
```

Call it after initial load and after dynamic candle loading:
```typescript
// In the load function:
series.setData(candles as CandlestickData<Time>[])
setInitialData(candles)
onCandlesLoaded?.(candles) // NEW
```

In `chart-panel.tsx`, store the candles in a ref:
```typescript
const candlesRef = useRef<ZoneCandle[] | null>(null)
const handleCandlesLoaded = useCallback((candles: ZoneCandle[]) => {
  candlesRef.current = candles
}, [])
```

---

## 11. Phase 9: Multi-Timeframe Support

### How It Works

When "Show higher-TF zones" is enabled:

1. `useZones` hook determines the higher timeframe via `getHigherTimeframe(currentTf)` (e.g., H1 → H4)
2. Fetches higher-TF candles via `fetchCandles(instrument, higherTf, lookbackCandles)`
3. Runs `detectZones()` on those candles
4. Passes results as `higherTfZones` to the chart primitive
5. `ZonePrimitive` renders higher-TF zones with:
   - Dashed borders (instead of solid)
   - Slightly darker/muted color shade
   - Label suffix: `"DBR 4.5 (H4)"` — shows the source timeframe
   - Rendered behind primary-TF zones (lower z-order)

### Curve Alignment

Computed in `useZones`:
```typescript
function computeCurveAlignment(
  primaryZones: ZoneData[],
  higherTfZones: ZoneData[],
  currentPrice: number,
): CurveAlignment {
  // Find nearest higher-TF demand and supply
  const htfDemand = higherTfZones.find(z => z.type === "demand" && z.status === "active")
  const htfSupply = higherTfZones.find(z => z.type === "supply" && z.status === "active")

  // If price is in or near a higher-TF demand zone, and primary TF also shows demand = aligned (bullish)
  // If price is in or near a higher-TF supply zone, and primary TF also shows supply = aligned (bearish)
  // If higher-TF suggests demand but primary shows supply (or vice versa) = conflicting
  // If no clear signal = neutral
}
```

Displayed on the summary bar as a small badge: `"Curve: ▲ Aligned"` (green) or `"Curve: ⚠ Conflicting"` (amber) or nothing (neutral).

### Additional Timeframes

If user selects additional timeframes in the "Advanced" section of zone controls:
- Each additional TF is fetched and processed independently
- All additional TF zones are passed to the primitive alongside higher-TF zones
- Labels show source timeframe: `"RBD 3.0 (D)"`, `"DBR 4.0 (W)"`

---

## 12. File Manifest

### New Files (22 files)

| # | File | Purpose |
|---|------|---------|
| 1 | `packages/types/src/index.ts` | MODIFY — add Zone types section (~180 lines) |
| 2 | `packages/shared/src/zone-utils.ts` | NEW — ATR, candle classification, helpers |
| 3 | `packages/shared/src/zone-detector.ts` | NEW — Main detection algorithm |
| 4 | `packages/shared/src/zone-scorer.ts` | NEW — Odds Enhancers scoring engine |
| 5 | `packages/shared/src/zone-presets.ts` | NEW — Preset configs + defaults |
| 6 | `packages/shared/src/index.ts` | MODIFY — add zone exports |
| 7 | `packages/db/prisma/schema.prisma` | MODIFY — add SupplyDemandZone + ZoneSettings models |
| 8 | `packages/db/src/zone-service.ts` | NEW — Zone CRUD with soft-update |
| 9 | `packages/db/src/zone-settings-service.ts` | NEW — Zone settings persistence |
| 10 | `packages/db/src/index.ts` | MODIFY — add zone exports |
| 11 | `apps/web/src/app/api/zones/[instrument]/route.ts` | NEW — Zone detection API |
| 12 | `apps/web/src/app/api/zones/settings/route.ts` | NEW — Zone settings API |
| 13 | `apps/web/src/components/charts/zone-primitive.ts` | NEW — Canvas rendering primitive |
| 14 | `apps/web/src/components/charts/zone-controls-popover.tsx` | NEW — Settings popover/sheet |
| 15 | `apps/web/src/components/charts/zone-score-popover.tsx` | NEW — Score breakdown popover |
| 16 | `apps/web/src/components/charts/zone-summary-bar.tsx` | NEW — Nearest DZ/SZ bar |
| 17 | `apps/web/src/components/charts/zone-legend.tsx` | NEW — Color legend badge |
| 18 | `apps/web/src/hooks/use-zones.ts` | NEW — Zone detection orchestration hook |
| 19 | `apps/web/src/hooks/use-zone-settings.ts` | NEW — Zone settings hook |
| 20 | `apps/web/src/components/charts/standalone-chart.tsx` | MODIFY — add zone primitive + props |
| 21 | `apps/web/src/components/charts/tradingview-chart.tsx` | MODIFY — add zone primitive + props |
| 22 | `apps/web/src/components/charts/draggable-trade-chart.tsx` | MODIFY — add zone primitive + props |
| 23 | `apps/web/src/components/charts/chart-panel.tsx` | MODIFY — wire hooks + UI components |
| 24 | `apps/web/src/components/charts/chart-utils.ts` | MODIFY — export candle type for zone reuse |

### Prisma Migration

After modifying `schema.prisma`, run:
```bash
cd packages/db && npx prisma migrate dev --name add-supply-demand-zones
```

---

## 13. Verification Checklist

### Algorithm Correctness
- [ ] ATR(14) computes correctly for varying candle counts
- [ ] Leg candles identified correctly: large body, close outside previous range
- [ ] Base candles identified correctly: small body, overlapping
- [ ] DBR formation: drop (leg-in) → base → rally (leg-out) → demand zone
- [ ] RBR formation: rally (leg-in) → base → rally (leg-out) → demand zone
- [ ] RBD formation: rally (leg-in) → base → drop (leg-out) → supply zone
- [ ] DBD formation: drop (leg-in) → base → drop (leg-out) → supply zone
- [ ] Demand proximal = highest body in base
- [ ] Demand DBR distal = lowest price of entire DBR
- [ ] Demand RBR distal = lowest price of Base-Rally only
- [ ] Supply proximal = lowest body in base
- [ ] Supply RBD distal = highest price of entire RBD
- [ ] Supply DBD distal = highest price of Base-Drop only
- [ ] Strength scored correctly: move-out distance + opposing zone breakout
- [ ] Time scored correctly: 1-3 = Best(1), 4-6 = Good(0.5), >6 = Poor(0)
- [ ] Freshness scored correctly: untested = 2, ≤50% = 1, >50% = 0
- [ ] Zones ranked by score DESC then distance ASC
- [ ] Overlapping zones de-duplicated (keep higher score)

### Chart Rendering
- [ ] Zone rectangles render between proximal/distal with correct fill color
- [ ] Labels show formation + score
- [ ] Higher-TF zones render with dashed borders
- [ ] Invalidated zones render with hatched pattern (when enabled)
- [ ] Nearest DZ/SZ highlighted with border
- [ ] Dark/light theme colors correct
- [ ] Zones extend from base start to right edge of visible chart
- [ ] Score popover opens on click/tap
- [ ] Mobile: bottom sheet instead of popover

### UI/UX
- [ ] Zone controls popover opens from toolbar icon
- [ ] All settings persist (global to DB, per-chart to layout)
- [ ] Preset dropdown auto-fills algorithm config
- [ ] Custom mode enables individual parameter editing
- [ ] Summary bar shows nearest DZ/SZ with real-time distance
- [ ] Zones auto-recompute on new candle close
- [ ] Higher-TF toggle fetches and displays additional zones
- [ ] Curve alignment badge shows on summary bar
- [ ] All charts (standalone, tradingview, draggable) support zones
- [ ] Trade detail drawer chart supports zones

### Database
- [ ] Zones persisted with soft-update (new = insert, existing = update, gone = invalidate)
- [ ] Settings persisted as single row
- [ ] Migration runs cleanly
- [ ] Old invalidated zones cleaned up

### Performance
- [ ] Zone detection doesn't block main thread (Web Worker or debounced)
- [ ] Chart rendering smooth with 6+ zones visible
- [ ] Multiple panels don't cause excessive API calls (staggered like candle loading)
- [ ] Settings changes debounced to avoid rapid recomputation

### Accessibility
- [ ] Zone controls popover keyboard-navigable
- [ ] All toggles have aria-labels
- [ ] Score popover accessible via keyboard
- [ ] Color is not the only differentiator (labels + position also distinguish demand/supply)
- [ ] Summary bar readable by screen readers

---

## Implementation Order

Recommended build sequence:

1. **Types** (Phase 1) — Foundation everything else imports
2. **Algorithm** (Phase 2) — Core logic, testable in isolation
3. **Database** (Phase 3) — Schema + services + migration
4. **API Routes** (Phase 4) — Wire algorithm to persistence
5. **Chart Primitive** (Phase 5) — Visual rendering
6. **Hooks** (Phase 6) — React state management
7. **UI Components** (Phase 7) — Controls, popovers, bars
8. **Chart Integration** (Phase 8) — Wire everything into existing charts
9. **Multi-TF** (Phase 9) — Higher timeframe + curve alignment

Each phase is independently testable before moving to the next.
