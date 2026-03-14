"use client"

import type { TradeTagData } from "@fxflow/types"

interface TagBadgesProps {
  tags: TradeTagData[]
  maxVisible?: number
}

export function TagBadges({ tags, maxVisible = 3 }: TagBadgesProps) {
  // Defensive: filter out tags with missing nested tag data
  const validTags = tags.filter((tt) => tt.tag?.name && tt.tag?.color)

  if (validTags.length === 0) {
    return <span className="text-muted-foreground text-xs">—</span>
  }

  const visible = validTags.slice(0, maxVisible)
  const overflow = validTags.length - maxVisible

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible.map((tt) => (
        <span
          key={tt.tagId}
          className="bg-muted inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
        >
          <span
            className="size-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: tt.tag.color }}
          />
          {tt.tag.name}
        </span>
      ))}
      {overflow > 0 && <span className="text-muted-foreground text-[10px]">+{overflow}</span>}
    </div>
  )
}
