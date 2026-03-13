"use client"

import { useState } from "react"
import { Wifi, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import type { TradingMode, ApiResponse, TestConnectionResponse } from "@fxflow/types"

interface TestConnectionButtonProps {
  mode: TradingMode
  disabled?: boolean
}

export function TestConnectionButton({ mode, disabled }: TestConnectionButtonProps) {
  const [isTesting, setIsTesting] = useState(false)

  const handleTest = async () => {
    setIsTesting(true)
    try {
      const res = await fetch("/api/settings/oanda/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      })
      const data = (await res.json()) as ApiResponse<TestConnectionResponse>

      if (data.ok && data.data?.success) {
        toast.success("Connection successful", {
          description: data.data.accountName
            ? `Connected to ${data.data.accountName}`
            : "OANDA API responded successfully",
        })
      } else {
        const errorMsg = data.data?.error ?? data.error ?? "Connection failed"
        toast.error("Connection failed", { description: errorMsg })
      }
    } catch {
      toast.error("Connection failed", {
        description: "Could not reach the server",
      })
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleTest}
      disabled={disabled || isTesting}
    >
      {isTesting ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Wifi className="size-4" />
      )}
      {isTesting ? "Testing..." : "Test Connection"}
    </Button>
  )
}
