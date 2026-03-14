"use client"

import { useState } from "react"
import { KeyRound, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

export function SecurityPinSection() {
  const [changing, setChanging] = useState(false)
  const [currentPin, setCurrentPin] = useState("")
  const [newPin, setNewPin] = useState("")
  const [confirmPin, setConfirmPin] = useState("")
  const [loading, setLoading] = useState(false)

  const handleChangePin = async () => {
    if (newPin !== confirmPin) {
      toast.error("New PINs don't match")
      return
    }
    if (newPin.length < 4 || newPin.length > 8 || !/^\d+$/.test(newPin)) {
      toast.error("PIN must be 4-8 digits")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/auth/change-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin, newPin }),
      })
      const json = (await res.json()) as { ok: boolean; error?: string }
      if (json.ok) {
        toast.success("PIN changed successfully")
        setChanging(false)
        setCurrentPin("")
        setNewPin("")
        setConfirmPin("")
      } else {
        toast.error(json.error ?? "Failed to change PIN")
      }
    } catch {
      toast.error("Connection error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          PIN
        </CardTitle>
        <CardDescription>Change your login PIN</CardDescription>
      </CardHeader>
      <CardContent>
        {!changing ? (
          <Button variant="outline" size="sm" onClick={() => setChanging(true)}>
            Change PIN
          </Button>
        ) : (
          <div className="max-w-sm space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-pin">Current PIN</Label>
              <Input
                id="current-pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter current PIN"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-pin">New PIN</Label>
              <Input
                id="new-pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                placeholder="4-8 digits"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-pin">Confirm New PIN</Label>
              <Input
                id="confirm-pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                placeholder="Re-enter new PIN"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleChangePin} disabled={loading}>
                {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Save
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setChanging(false)
                  setCurrentPin("")
                  setNewPin("")
                  setConfirmPin("")
                }}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
