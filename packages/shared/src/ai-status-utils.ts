/**
 * Shared utilities for AI analysis status display.
 * Consolidates duplicated status → color/label/icon mappings
 * used across analysis-history, ai-analyses-tab, and analysis-sheet.
 */

import type { AiAnalysisStatus } from "@fxflow/types"

export interface AnalysisStatusConfig {
  label: string
  colorClass: string
  iconName:
    | "check-circle-2"
    | "alert-circle"
    | "x-circle"
    | "clock"
    | "alert-triangle"
    | "pause-circle"
}

const STATUS_MAP: Record<AiAnalysisStatus, AnalysisStatusConfig> = {
  completed: {
    label: "Completed",
    colorClass: "text-emerald-500",
    iconName: "check-circle-2",
  },
  partial: {
    label: "Partial",
    colorClass: "text-amber-500",
    iconName: "alert-triangle",
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

const INTERRUPTED_CONFIG: AnalysisStatusConfig = {
  label: "Interrupted",
  colorClass: "text-orange-500",
  iconName: "pause-circle",
}

/**
 * Pattern-match an error message against known "interrupted" causes
 * (daemon restart, stream stall, user-abort-without-cancel-flag). These
 * deserve a distinct badge from a true analysis `failed` (model returned
 * malformed JSON, API key invalid, etc.) because the fix is "retry"
 * rather than "investigate".
 */
export function isInterruptedError(errorMessage: string | null | undefined): boolean {
  if (!errorMessage) return false
  return /interrupted|daemon restarted|stream.*(stall|drop|closed)|aborted/i.test(errorMessage)
}

/** Get display config for an analysis status. Handles stuck detection if age provided. */
export function getAnalysisStatusConfig(
  status: AiAnalysisStatus,
  opts?: { createdAt?: string; stuckThresholdMs?: number; errorMessage?: string | null },
): AnalysisStatusConfig {
  // "Interrupted" is a sub-classification of failed — show it distinctly so
  // users know it's transient (retry-worthy) vs a real analysis failure.
  if (status === "failed" && isInterruptedError(opts?.errorMessage)) {
    return INTERRUPTED_CONFIG
  }
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

/**
 * Returns true when an analysis has finished — regardless of whether it fully
 * succeeded, truncated, errored, or was cancelled. Useful for UI flows that
 * need to distinguish "still in flight" from "terminal state".
 */
export function isTerminalAnalysisStatus(status: AiAnalysisStatus): boolean {
  return (
    status === "completed" || status === "partial" || status === "failed" || status === "cancelled"
  )
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
