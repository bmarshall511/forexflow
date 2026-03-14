import type { PositionManager } from "./positions/position-manager.js"

interface LockEntry {
  source: string
  acquiredAt: number
}

type AcquireResult = { allowed: true } | { allowed: false; reason: string }

/**
 * Centralized gate that prevents concurrent automated placements on the same instrument.
 *
 * Checks:
 * 1. No existing pending order or open trade on the instrument (via PositionManager).
 * 2. No other automation system holds an in-flight placement lock on the instrument.
 *
 * Locks are short-lived (released after placement completes) with a TTL safety net
 * so a crash never leaves a permanent lock.
 */
export class PlacementGate {
  private locks = new Map<string, LockEntry>()
  private readonly lockTtlMs = 10_000 // 10s stale lock cleanup

  constructor(private positionManager: PositionManager) {}

  /**
   * Try to acquire a placement lock for an instrument.
   * Call release() when the placement attempt finishes (success or failure).
   */
  acquire(instrument: string, source: string): AcquireResult {
    this.pruneExpired()

    // 1. Check for existing positions on this instrument
    const positions = this.positionManager.getPositions()
    const hasOpen = positions.open.some((t) => t.instrument === instrument)
    const hasPending = positions.pending.some((o) => o.instrument === instrument)

    if (hasOpen) {
      return { allowed: false, reason: `Existing open trade on ${instrument}` }
    }
    if (hasPending) {
      return { allowed: false, reason: `Existing pending order on ${instrument}` }
    }

    // 2. Check for in-flight placement lock from another source
    const existing = this.locks.get(instrument)
    if (existing && existing.source !== source) {
      return {
        allowed: false,
        reason: `${existing.source} is already placing on ${instrument}`,
      }
    }

    // 3. Acquire lock
    this.locks.set(instrument, { source, acquiredAt: Date.now() })
    return { allowed: true }
  }

  /** Release the lock after placement completes (success or failure). */
  release(instrument: string, source: string): void {
    const entry = this.locks.get(instrument)
    if (entry && entry.source === source) {
      this.locks.delete(instrument)
    }
  }

  /** Number of active locks (for diagnostics). */
  get activeLockCount(): number {
    return this.locks.size
  }

  private pruneExpired(): void {
    const now = Date.now()
    for (const [instrument, entry] of this.locks) {
      if (now - entry.acquiredAt > this.lockTtlMs) {
        console.warn(
          `[placement-gate] Pruning stale lock: ${instrument} held by ${entry.source} for ${now - entry.acquiredAt}ms`,
        )
        this.locks.delete(instrument)
      }
    }
  }
}
