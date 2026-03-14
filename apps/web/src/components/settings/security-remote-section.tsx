"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Globe, Monitor, CheckCircle2, XCircle, Loader2, Copy, Check } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface TunnelStatus {
  installed: boolean
  configured: boolean
  running: boolean
  url: string | null
}

function StatusRow({ label, ok, loading }: { label: string; ok: boolean; loading: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      {loading ? (
        <Loader2 className="text-muted-foreground h-3.5 w-3.5 animate-spin" />
      ) : ok ? (
        <div className="flex items-center gap-1 text-emerald-500">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Yes</span>
        </div>
      ) : (
        <div className="text-muted-foreground flex items-center gap-1">
          <XCircle className="h-3.5 w-3.5" />
          <span>No</span>
        </div>
      )}
    </div>
  )
}

export function SecurityRemoteSection() {
  const [tunnel, setTunnel] = useState<TunnelStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const { isRemote, hostname, protocol } = useMemo(() => {
    if (typeof window === "undefined") {
      return { isRemote: false, hostname: "localhost", protocol: "http:" }
    }
    const h = window.location.hostname
    const local = h === "localhost" || h === "127.0.0.1" || h === "::1"
    return { isRemote: !local, hostname: h, protocol: window.location.protocol }
  }, [])

  useEffect(() => {
    fetch("/api/settings/tunnel-status")
      .then((res) => res.json())
      .then((json: { ok: boolean; data?: TunnelStatus }) => {
        if (json.ok && json.data) setTunnel(json.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const copyUrl = useCallback(() => {
    if (!tunnel?.url) return
    navigator.clipboard.writeText(tunnel.url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [tunnel?.url])

  const allReady = tunnel?.installed && tunnel?.running

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          Remote Access
        </CardTitle>
        <CardDescription>Access FXFlow from your phone or any device</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current connection */}
        <div className="border-border/50 bg-muted/30 flex items-center justify-between rounded-lg border px-3 py-2.5">
          <div className="flex items-center gap-2 text-sm">
            {isRemote ? (
              <Globe className="text-primary h-4 w-4" />
            ) : (
              <Monitor className="text-muted-foreground h-4 w-4" />
            )}
            <span>Current connection</span>
          </div>
          <Badge variant={isRemote ? "default" : "secondary"}>
            {isRemote ? "Remote" : "Local"}
          </Badge>
        </div>

        {/* Connection details */}
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Hostname</span>
            <span className="font-mono">{hostname}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Protocol</span>
            <span className="font-mono">{protocol.replace(":", "")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">WebSocket</span>
            <span>{isRemote ? "Proxied (/ws)" : "Direct (:4100)"}</span>
          </div>
        </div>

        {/* Tunnel status */}
        <div className="border-border space-y-3 border-t pt-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Cloudflare Tunnel</h4>
            {!loading && (
              <Badge variant={allReady ? "default" : "secondary"} className="text-[10px]">
                {allReady ? "Active" : "Inactive"}
              </Badge>
            )}
          </div>

          <div className="space-y-1.5">
            <StatusRow label="cloudflared installed" ok={!!tunnel?.installed} loading={loading} />
            <StatusRow label="Tunnel running" ok={!!tunnel?.running} loading={loading} />
          </div>

          {/* Tunnel URL with copy */}
          {!loading && allReady && tunnel?.url && (
            <div className="space-y-1.5">
              <span className="text-muted-foreground text-xs">Remote URL</span>
              <button
                type="button"
                onClick={copyUrl}
                className="border-border/50 bg-muted/30 hover:bg-muted/50 flex w-full items-center gap-2 rounded-md border px-3 py-2.5 text-left transition-colors"
                aria-label={copied ? "Copied tunnel URL" : "Copy tunnel URL to clipboard"}
              >
                <span className="flex-1 truncate font-mono text-sm">{tunnel.url}</span>
                {copied ? (
                  <Check className="size-4 shrink-0 text-emerald-500" />
                ) : (
                  <Copy className="text-muted-foreground size-4 shrink-0" />
                )}
              </button>
              <p className="text-muted-foreground text-[11px]">
                Open this URL on your phone to access FXFlow. The URL changes each restart.
              </p>
            </div>
          )}

          {!loading && !tunnel?.installed && (
            <div className="border-border/50 bg-muted/30 rounded-md border px-3 py-2.5">
              <p className="text-muted-foreground text-xs leading-relaxed">
                Run <code className="bg-muted rounded px-1 py-0.5 text-[11px]">pnpm dev</code> — it
                will offer to install cloudflared automatically. No Cloudflare account or domain
                needed.
              </p>
            </div>
          )}

          {!loading && tunnel?.installed && !tunnel?.running && (
            <div className="border-border/50 bg-muted/30 rounded-md border px-3 py-2.5">
              <p className="text-muted-foreground text-xs leading-relaxed">
                cloudflared is installed but the tunnel isn&apos;t running. Start the app with{" "}
                <code className="bg-muted rounded px-1 py-0.5 text-[11px]">pnpm dev</code> to get a
                remote access URL automatically.
              </p>
            </div>
          )}

          {!loading && allReady && !tunnel?.url && (
            <div className="border-border/50 bg-muted/30 rounded-md border px-3 py-2.5">
              <p className="text-muted-foreground text-xs leading-relaxed">
                Tunnel is running but the URL hasn&apos;t been captured yet. Check the terminal
                output for the URL.
              </p>
            </div>
          )}
        </div>

        {/* How it works */}
        <div className="border-border space-y-2 border-t pt-3">
          <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
            How It Works
          </span>
          <p className="text-muted-foreground text-xs leading-relaxed">
            <code className="bg-muted rounded px-1 py-0.5 text-[11px]">pnpm dev</code> starts a
            Cloudflare Quick Tunnel alongside the app. No account, no domain, no configuration —
            just a public HTTPS URL. The URL changes each restart.
          </p>
        </div>

        {/* Security layers */}
        <div className="border-border space-y-2 border-t pt-3">
          <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
            Security Layers
          </span>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="bg-status-connected size-1.5 shrink-0 rounded-full" />
              <span className="text-muted-foreground">
                PIN authentication — required for all access
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-status-connected size-1.5 shrink-0 rounded-full" />
              <span className="text-muted-foreground">
                HTTPS encryption — via Cloudflare tunnel
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-status-connected size-1.5 shrink-0 rounded-full" />
              <span className="text-muted-foreground">
                Unguessable URL — random subdomain on each start
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
