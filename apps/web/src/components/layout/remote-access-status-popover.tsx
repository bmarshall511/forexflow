"use client"

import { useCallback, useEffect, useState } from "react"
import { Globe, Monitor, Copy, Check } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface TunnelData {
  installed: boolean
  running: boolean
  url: string | null
}

interface RemoteAccessStatusPopoverProps {
  isRemote: boolean
  hostname: string
}

export function RemoteAccessStatusPopover({ isRemote, hostname }: RemoteAccessStatusPopoverProps) {
  const [tunnel, setTunnel] = useState<TunnelData | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch("/api/settings/tunnel-status")
      .then((res) => res.json())
      .then((json: { ok: boolean; data?: TunnelData }) => {
        if (json.ok && json.data) setTunnel(json.data)
      })
      .catch(() => {})
  }, [])

  const copyUrl = useCallback(() => {
    if (!tunnel?.url) return
    navigator.clipboard.writeText(tunnel.url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [tunnel?.url])

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", "bg-status-connected")} aria-hidden="true" />
          <h4 className="text-sm font-semibold">Remote Access</h4>
        </div>
        <Badge variant="outline" className="gap-1 px-1.5 py-0 text-[10px]">
          {isRemote ? (
            <>
              <Globe className="size-2.5" aria-hidden="true" />
              Remote
            </>
          ) : (
            <>
              <Monitor className="size-2.5" aria-hidden="true" />
              Local
            </>
          )}
        </Badge>
      </div>

      {/* Connection details */}
      <div className="border-border space-y-1.5 border-t pt-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Hostname</span>
          <span className="max-w-[160px] truncate font-mono text-[11px]">{hostname}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">WebSocket</span>
          <span>{isRemote ? "Proxied via /ws" : "Direct to :4100"}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">REST API</span>
          <span>{isRemote ? "Proxied via /api/daemon" : "Direct to :4100"}</span>
        </div>
      </div>

      {/* Tunnel URL */}
      {tunnel?.running && tunnel.url && (
        <div className="border-border border-t pt-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Tunnel URL</span>
          </div>
          <button
            type="button"
            onClick={copyUrl}
            className="border-border/50 bg-muted/30 hover:bg-muted/50 mt-1 flex w-full items-center gap-1.5 rounded-md border px-2 py-1.5 text-left transition-colors"
            aria-label={copied ? "Copied tunnel URL" : "Copy tunnel URL to clipboard"}
          >
            <span className="flex-1 truncate font-mono text-[11px]">{tunnel.url}</span>
            {copied ? (
              <Check className="size-3 shrink-0 text-emerald-500" />
            ) : (
              <Copy className="text-muted-foreground size-3 shrink-0" />
            )}
          </button>
        </div>
      )}

      {/* Info */}
      {!isRemote && !tunnel?.url && (
        <div className="border-border border-t pt-2">
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            To access remotely, run{" "}
            <code className="bg-muted rounded px-1 py-0.5 text-[10px]">pnpm dev</code> — a tunnel
            URL will appear here automatically. See Settings &gt; Security for details.
          </p>
        </div>
      )}
    </div>
  )
}
