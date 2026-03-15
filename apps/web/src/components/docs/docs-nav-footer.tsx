"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import type { DocEntry } from "./docs-types"

interface DocsNavFooterProps {
  prev: DocEntry | null
  next: DocEntry | null
  onSelect: (slug: string) => void
}

export function DocsNavFooter({ prev, next, onSelect }: DocsNavFooterProps) {
  if (!prev && !next) return null

  return (
    <nav
      aria-label="Page navigation"
      className="border-border mt-10 flex items-stretch gap-3 border-t pt-6"
    >
      {prev ? (
        <button
          onClick={() => onSelect(prev.slug)}
          className="border-border hover:border-primary/30 hover:bg-muted/50 group flex min-h-[56px] flex-1 flex-col items-start rounded-lg border p-3 text-left transition-colors"
        >
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            <ChevronLeft className="size-3" />
            Previous
          </span>
          <span className="text-foreground group-hover:text-primary text-sm font-medium">
            {prev.title}
          </span>
        </button>
      ) : (
        <div className="flex-1" />
      )}

      {next ? (
        <button
          onClick={() => onSelect(next.slug)}
          className="border-border hover:border-primary/30 hover:bg-muted/50 group flex min-h-[56px] flex-1 flex-col items-end rounded-lg border p-3 text-right transition-colors"
        >
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            Next
            <ChevronRight className="size-3" />
          </span>
          <span className="text-foreground group-hover:text-primary text-sm font-medium">
            {next.title}
          </span>
        </button>
      ) : (
        <div className="flex-1" />
      )}
    </nav>
  )
}
