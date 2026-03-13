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
    return <span className="text-xs text-muted-foreground">—</span>
  }

  const visible = validTags.slice(0, maxVisible)
  const overflow = validTags.length - maxVisible

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {visible.map((tt) => (
        <span
          key={tt.tagId}
          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-muted"
        >
          <span
            className="size-1.5 rounded-full shrink-0"
            style={{ backgroundColor: tt.tag.color }}
          />
          {tt.tag.name}
        </span>
      ))}
      {overflow > 0 && (
        <span className="text-[10px] text-muted-foreground">+{overflow}</span>
      )}
    </div>
  )
}
