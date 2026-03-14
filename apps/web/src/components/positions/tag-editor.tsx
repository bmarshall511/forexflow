"use client"

import { useState } from "react"
import type { TagData, TradeTagData } from "@fxflow/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"

const TAG_COLORS = [
  { label: "Blue", hex: "#3B82F6" },
  { label: "Green", hex: "#22C55E" },
  { label: "Red", hex: "#EF4444" },
  { label: "Yellow", hex: "#EAB308" },
  { label: "Purple", hex: "#A855F7" },
  { label: "Pink", hex: "#EC4899" },
  { label: "Orange", hex: "#F97316" },
  { label: "Teal", hex: "#14B8A6" },
  { label: "Indigo", hex: "#6366F1" },
  { label: "Slate", hex: "#64748B" },
]

interface TagEditorProps {
  assignedTags: TradeTagData[]
  allTags: TagData[]
  onAssign: (tagId: string) => void
  onRemove: (tagId: string) => void
  onCreate: (name: string, color: string) => Promise<TagData | null>
}

export function TagEditor({ assignedTags, allTags, onAssign, onRemove, onCreate }: TagEditorProps) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0]?.hex ?? "#3B82F6")
  const [isCreating, setIsCreating] = useState(false)

  const assignedIds = new Set(assignedTags.map((t) => t.tagId))

  const filteredTags = allTags.filter(
    (tag) => !assignedIds.has(tag.id) && tag.name.toLowerCase().includes(search.toLowerCase()),
  )

  const exactMatch = allTags.some((tag) => tag.name.toLowerCase() === search.trim().toLowerCase())

  const handleCreate = async () => {
    if (!search.trim() || isCreating) return
    setIsCreating(true)
    const tag = await onCreate(search.trim(), selectedColor)
    if (tag) {
      onAssign(tag.id)
      setSearch("")
    }
    setIsCreating(false)
    setPopoverOpen(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {assignedTags.map((tt) => (
          <Badge
            key={tt.tagId}
            variant="outline"
            className="gap-1 pr-1"
            style={{
              borderColor: `${tt.tag.color}40`,
              backgroundColor: `${tt.tag.color}15`,
              color: tt.tag.color,
            }}
          >
            {tt.tag.name}
            <button
              type="button"
              onClick={() => onRemove(tt.tagId)}
              className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
              aria-label={`Remove tag ${tt.tag.name}`}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}

        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs">
              <Plus className="size-3" />
              Add Tag
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <Input
              placeholder="Search or create..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-2 h-8 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && search.trim() && !exactMatch) {
                  handleCreate()
                }
              }}
            />

            <div className="max-h-36 space-y-0.5 overflow-y-auto">
              {filteredTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => {
                    onAssign(tag.id)
                    setSearch("")
                    setPopoverOpen(false)
                  }}
                  className="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors"
                >
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </button>
              ))}
            </div>

            {search.trim() && !exactMatch && (
              <div className="mt-1 border-t pt-1">
                <div className="mb-2 flex flex-wrap gap-1 px-1">
                  {TAG_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setSelectedColor(c.hex)}
                      className={cn(
                        "size-5 rounded-full transition-all",
                        selectedColor === c.hex
                          ? "ring-offset-background ring-2 ring-offset-2"
                          : "hover:scale-110",
                      )}
                      style={
                        {
                          backgroundColor: c.hex,
                          "--tw-ring-color": c.hex,
                        } as React.CSSProperties
                      }
                      aria-label={c.label}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={isCreating}
                  className="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors"
                >
                  <Plus className="size-3" />
                  Create &ldquo;{search.trim()}&rdquo;
                </button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
