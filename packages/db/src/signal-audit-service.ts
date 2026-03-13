import { db } from "./client"

export interface SignalAuditEventData {
  id: string
  signalId: string
  stage: string
  detail: Record<string, unknown>
  timestamp: string
}

/** Log an audit event for a signal pipeline stage. */
export async function logAuditEvent(
  signalId: string,
  stage: string,
  detail: Record<string, unknown>,
): Promise<void> {
  try {
    await db.signalAuditEvent.create({
      data: {
        signalId,
        stage,
        detail: JSON.stringify(detail),
      },
    })
  } catch (err) {
    // Best-effort: don't let audit logging break signal processing
    console.error("[signal-audit] Failed to log audit event:", err)
  }
}

/** Get the full audit trail for a signal, ordered by timestamp. */
export async function getAuditTrail(signalId: string): Promise<SignalAuditEventData[]> {
  const rows = await db.signalAuditEvent.findMany({
    where: { signalId },
    orderBy: { timestamp: "asc" },
  })

  return rows.map((row) => ({
    id: row.id,
    signalId: row.signalId,
    stage: row.stage,
    detail: JSON.parse(row.detail) as Record<string, unknown>,
    timestamp: row.timestamp.toISOString(),
  }))
}

/** Cleanup audit events older than the given number of days. */
export async function cleanupOldAuditEvents(days: number): Promise<number> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  const result = await db.signalAuditEvent.deleteMany({
    where: { timestamp: { lt: cutoff } },
  })

  return result.count
}
