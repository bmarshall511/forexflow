"use client"

import { useEffect } from "react"
import { Loader2, CheckCircle, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useNotificationContext } from "@/state/notification-context"
import type { ResetResult } from "@fxflow/db"

interface ResetProgressProps {
  isExecuting: boolean
  result: ResetResult | null
  freshInstallDone: boolean
  executeError: string | null
  onDone: () => void
}

export function ResetProgress({
  isExecuting,
  result,
  freshInstallDone,
  executeError,
  onDone,
}: ResetProgressProps) {
  const { refresh: refreshNotifications } = useNotificationContext()
  const isDone = result !== null || freshInstallDone

  // Refresh notification state after reset completes (DB was cleared but in-memory state is stale)
  useEffect(() => {
    if (isDone) {
      void refreshNotifications()
    }
  }, [isDone, refreshNotifications])
  const hasError = executeError !== null || (result !== null && !result.success)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">
          {isExecuting ? "Resetting..." : isDone ? "Reset Complete" : "Reset Failed"}
        </h2>
      </div>

      {isExecuting && (
        <div className="flex items-center gap-3 rounded-lg border p-4">
          <Loader2 className="size-5 animate-spin text-amber-500" aria-hidden="true" />
          <span className="text-sm">Processing reset, please wait...</span>
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {result.success ? (
              <CheckCircle className="size-5 text-emerald-500" aria-hidden="true" />
            ) : (
              <XCircle className="size-5 text-red-500" aria-hidden="true" />
            )}
            <span className="text-sm font-medium">
              {result.success ? "All modules reset successfully" : "Reset completed with errors"}
            </span>
          </div>

          <div className="rounded-lg border p-3 text-sm">
            <p>
              <span className="text-muted-foreground">Modules reset:</span>{" "}
              {result.modulesReset.length}
            </p>
            <p>
              <span className="text-muted-foreground">Records deleted:</span>{" "}
              {result.recordsDeleted.toLocaleString()}
            </p>
          </div>

          {result.errors.length > 0 && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
              <p className="mb-1 text-sm font-medium text-red-400">Errors:</p>
              <ul className="list-inside list-disc text-xs text-red-400">
                {result.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {freshInstallDone && (
        <div className="flex items-center gap-2">
          <CheckCircle className="size-5 text-emerald-500" aria-hidden="true" />
          <span className="text-sm font-medium">
            Database file deleted. Restart the app to recreate it.
          </span>
        </div>
      )}

      {executeError && !result && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
          <XCircle className="size-5 shrink-0 text-red-500" aria-hidden="true" />
          <span className="text-sm text-red-400">{executeError}</span>
        </div>
      )}

      {(isDone || hasError) && (
        <div className="pt-2">
          <Button onClick={onDone}>{freshInstallDone ? "Done" : "Return to Settings"}</Button>
        </div>
      )}
    </div>
  )
}
