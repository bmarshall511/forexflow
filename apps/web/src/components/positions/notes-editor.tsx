"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Textarea } from "@/components/ui/textarea"

interface NotesEditorProps {
  initialNotes: string
  onSave: (notes: string) => Promise<void>
}

export function NotesEditor({ initialNotes, onSave }: NotesEditorProps) {
  const [notes, setNotes] = useState(initialNotes)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  // Sync initial notes when trade changes
  useEffect(() => {
    setNotes(initialNotes)
    setSaveStatus("idle")
  }, [initialNotes])

  const handleChange = useCallback((value: string) => {
    setNotes(value)
    setSaveStatus("idle")

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSaveStatus("saving")
      try {
        await onSaveRef.current(value)
        setSaveStatus("saved")
        setTimeout(() => setSaveStatus("idle"), 1500)
      } catch {
        setSaveStatus("idle")
      }
    }, 500)
  }, [])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <div className="space-y-1">
      {saveStatus !== "idle" && (
        <div className="flex justify-end">
          <span className="text-[10px] text-muted-foreground animate-in fade-in">
            {saveStatus === "saving" ? "Saving..." : "Saved"}
          </span>
        </div>
      )}
      <Textarea
        placeholder="Add notes about this trade..."
        value={notes}
        onChange={(e) => handleChange(e.target.value)}
        className="min-h-20 resize-none text-xs"
      />
    </div>
  )
}
