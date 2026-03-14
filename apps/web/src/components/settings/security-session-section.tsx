"use client"

import { useCallback, useEffect, useState } from "react"
import { Monitor, Smartphone, Globe, Loader2, LogOut } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

interface Session {
  id: string
  device: string | null
  createdAt: string
  expiresAt: string
}

const EXPIRY_OPTIONS = [
  { value: "3600", label: "1 hour" },
  { value: "28800", label: "8 hours" },
  { value: "86400", label: "24 hours" },
  { value: "604800", label: "7 days" },
  { value: "2592000", label: "30 days" },
]

function getDeviceIcon(device: string | null) {
  if (!device) return Globe
  const lower = device.toLowerCase()
  if (lower.includes("mobile") || lower.includes("iphone") || lower.includes("android")) {
    return Smartphone
  }
  return Monitor
}

function formatDevice(device: string | null): string {
  if (!device) return "Unknown device"
  // Extract a short description from user-agent
  if (device.includes("iPhone")) return "iPhone"
  if (device.includes("iPad")) return "iPad"
  if (device.includes("Android")) return "Android"
  if (device.includes("Mac")) return "Mac"
  if (device.includes("Windows")) return "Windows"
  if (device.includes("Linux")) return "Linux"
  return device.slice(0, 30)
}

export function SecuritySessionSection() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [expiry, setExpiry] = useState<string>("86400")
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [revokingAll, setRevokingAll] = useState(false)

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/sessions")
      const json = (await res.json()) as { ok: boolean; data?: Session[] }
      if (json.ok && json.data) setSessions(json.data)
    } catch {
      // ignore
    } finally {
      setLoadingSessions(false)
    }
  }, [])

  const fetchExpiry = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session-expiry")
      const json = (await res.json()) as { ok: boolean; data?: { sessionExpiry: number } }
      if (json.ok && json.data) setExpiry(String(json.data.sessionExpiry))
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    void fetchSessions()
    void fetchExpiry()
  }, [fetchSessions, fetchExpiry])

  const handleExpiryChange = async (value: string) => {
    setExpiry(value)
    try {
      const res = await fetch("/api/auth/session-expiry", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seconds: parseInt(value) }),
      })
      const json = (await res.json()) as { ok: boolean }
      if (json.ok) toast.success("Session expiry updated")
    } catch {
      toast.error("Failed to update expiry")
    }
  }

  const handleRevokeSession = async (sessionId: string) => {
    try {
      const res = await fetch("/api/auth/sessions/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      })
      const json = (await res.json()) as { ok: boolean }
      if (json.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId))
        toast.success("Session revoked")
      }
    } catch {
      toast.error("Failed to revoke session")
    }
  }

  const handleLogoutAll = async () => {
    setRevokingAll(true)
    try {
      const res = await fetch("/api/auth/sessions", { method: "DELETE" })
      const json = (await res.json()) as { ok: boolean }
      if (json.ok) {
        toast.success("All sessions revoked. Redirecting...")
        setTimeout(() => {
          window.location.href = "/login"
        }, 1000)
      }
    } catch {
      toast.error("Failed to revoke sessions")
    } finally {
      setRevokingAll(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="h-4 w-4" />
          Sessions
        </CardTitle>
        <CardDescription>Manage active sessions and session duration</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Session duration */}
        <div className="max-w-sm space-y-2">
          <Label htmlFor="session-expiry">Session Duration</Label>
          <Select value={expiry} onValueChange={handleExpiryChange}>
            <SelectTrigger id="session-expiry">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXPIRY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            How long before you need to re-enter your PIN
          </p>
        </div>

        {/* Active sessions list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Active Sessions</h4>
            {sessions.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={handleLogoutAll}
                disabled={revokingAll}
              >
                {revokingAll ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LogOut className="mr-1.5 h-3.5 w-3.5" />
                )}
                Log out all
              </Button>
            )}
          </div>

          {loadingSessions ? (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading sessions...
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-muted-foreground text-sm">No active sessions</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => {
                const Icon = getDeviceIcon(session.device)
                return (
                  <div
                    key={session.id}
                    className="border-border/50 flex items-center justify-between rounded-lg border px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="text-muted-foreground h-4 w-4" />
                      <div>
                        <p className="text-sm">{formatDevice(session.device)}</p>
                        <p className="text-muted-foreground text-xs">
                          Created {new Date(session.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="xs"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => handleRevokeSession(session.id)}
                    >
                      Revoke
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
