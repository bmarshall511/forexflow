"use client"

import { useCallback, useState } from "react"
import { TIMEFRAME_OPTIONS } from "@fxflow/shared"
import { cn } from "@/lib/utils"

interface TimeframeSelectProps {
  value: string | null
  onChange: (value: string | null) => Promise<void>
  className?: string
}

export function TimeframeSelect({ value, onChange, className }: TimeframeSelectProps) {
  const [saving, setSaving] = useState(false)

  const handleChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newValue = e.target.value || null
      setSaving(true)
      try {
        await onChange(newValue)
      } finally {
        setSaving(false)
      }
    },
    [onChange],
  )

  const label = TIMEFRAME_OPTIONS.find((o) => o.value === value)?.label

  return (
    <select
      value={value ?? ""}
      onChange={handleChange}
      disabled={saving}
      aria-label="Timeframe"
      className={cn(
        "bg-transparent border-0 text-xs font-mono tabular-nums cursor-pointer",
        "hover:bg-muted focus:bg-muted rounded px-1 py-0.5 outline-none",
        "appearance-none text-center min-w-[3rem]",
        saving && "opacity-50",
        !value && "text-muted-foreground",
        className,
      )}
    >
      <option value="">—</option>
      {TIMEFRAME_OPTIONS.map(({ value: v, label: l }) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  )
}
