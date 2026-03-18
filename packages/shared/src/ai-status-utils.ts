/**
 * Shared utilities for AI analysis status display.
 * Consolidates duplicated status → color/label/icon mappings
 * used across analysis-history, ai-analyses-tab, and analysis-sheet.
 */

import type { AiAnalysisStatus } from "@fxflow/types"

export interface AnalysisStatusConfig {
  label: string
  colorClass: string
  iconName: "check-circle-2" | "alert-circle" | "x-circle" | "clock" | "alert-triangle"
}

const STATUS_MAP: Record<AiAnalysisStatus, AnalysisStatusConfig> = {
  completed: {
    label: "Completed",
    colorClass: "text-emerald-500",
    iconName: "check-circle-2",
  },
  failed: {
    label: "Failed",
    colorClass: "text-red-500",
    iconName: "alert-circle",
  },
  cancelled: {
    label: "Cancelled",
    colorClass: "text-muted-foreground",
    iconName: "x-circle",
  },
  running: {
    label: "Running",
    colorClass: "text-blue-500",
    iconName: "clock",
  },
  pending: {
    label: "Pending",
    colorClass: "text-blue-500",
    iconName: "clock",
  },
}

const STUCK_CONFIG: AnalysisStatusConfig = {
  label: "Stuck",
  colorClass: "text-amber-500",
  iconName: "alert-triangle",
}

/** Get display config for an analysis status. Handles stuck detection if age provided. */
export function getAnalysisStatusConfig(
  status: AiAnalysisStatus,
  opts?: { createdAt?: string; stuckThresholdMs?: number },
): AnalysisStatusConfig {
  if (opts?.createdAt && isStuckAnalysis(opts.createdAt, status, opts.stuckThresholdMs)) {
    return STUCK_CONFIG
  }
  return STATUS_MAP[status]
}

/** Default stuck threshold: 2 minutes (matches ANALYSIS_STUCK_THRESHOLD_MS in types) */
const DEFAULT_STUCK_THRESHOLD_MS = 2 * 60 * 1000

/** Check if an analysis is stuck (pending/running for too long). */
export function isStuckAnalysis(
  createdAt: string,
  status: AiAnalysisStatus,
  thresholdMs = DEFAULT_STUCK_THRESHOLD_MS,
): boolean {
  if (status !== "pending" && status !== "running") return false
  const age = Date.now() - new Date(createdAt).getTime()
  return age > thresholdMs
}

/** Model ID to human-readable label. */
export const MODEL_LABELS: Record<string, string> = {
  "claude-haiku-4-5-20251001": "Haiku",
  "claude-sonnet-4-6": "Sonnet",
  "claude-opus-4-6": "Opus",
}

/** Depth to human-readable label. */
export const DEPTH_LABELS: Record<string, string> = {
  quick: "Quick",
  standard: "Standard",
  deep: "Deep",
}
