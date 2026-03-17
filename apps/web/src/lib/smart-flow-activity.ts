/**
 * Fire-and-forget activity log entry via daemon proxy.
 *
 * Sends a POST to the daemon's `/smart-flow/log-activity` endpoint through the
 * Next.js API proxy so that config CRUD actions from the web UI appear in the
 * SmartFlow activity feed alongside daemon-originated events.
 */
export function logSmartFlowActivity(
  type: string,
  message: string,
  opts?: {
    instrument?: string
    detail?: string
    severity?: "info" | "success" | "warning" | "error"
    configId?: string
    tradeId?: string
  },
): void {
  fetch("/api/daemon/smart-flow/log-activity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, message, ...opts }),
  }).catch(() => {
    /* fire and forget */
  })
}
