"use client"

import { useState, useEffect } from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { DocsSearch } from "./docs-search"
import type { CategoryGroup } from "./docs-types"

interface DocsSidebarProps {
  categories: CategoryGroup[]
  activeSlug: string
  onSelect: (slug: string) => void
}

export function DocsSidebar({ categories, activeSlug, onSelect }: DocsSidebarProps) {
  // Track which categories are expanded
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const active = categories.find((c) => c.docs.some((d) => d.slug === activeSlug))
    return new Set(active ? [active.id] : categories.length > 0 ? [categories[0]!.id] : [])
  })

  // Auto-expand active category when activeSlug changes
  useEffect(() => {
    const active = categories.find((c) => c.docs.some((d) => d.slug === activeSlug))
    if (active) {
      setExpanded((prev) => {
        if (prev.has(active.id)) return prev
        return new Set([...prev, active.id])
      })
    }
  }, [activeSlug, categories])

  const toggleCategory = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <nav aria-label="Documentation sections" className="space-y-3">
      <DocsSearch categories={categories} onSelect={onSelect} />

      <div className="space-y-0.5">
        {categories.map((category) => {
          const isExpanded = expanded.has(category.id)
          const hasActive = category.docs.some((d) => d.slug === activeSlug)

          return (
            <div key={category.id}>
              <button
                onClick={() => toggleCategory(category.id)}
                className={cn(
                  "flex min-h-[36px] w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                  hasActive
                    ? "text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
                aria-expanded={isExpanded}
              >
                <ChevronRight
                  className={cn(
                    "size-3.5 shrink-0 transition-transform duration-200",
                    isExpanded && "rotate-90",
                  )}
                />
                <span className="truncate">{category.label}</span>
                <span className="bg-muted text-muted-foreground ml-auto shrink-0 rounded px-1.5 py-0.5 text-[0.625rem] font-medium">
                  {category.docs.length}
                </span>
              </button>

              {isExpanded && (
                <ul className="border-border ml-3 space-y-0.5 border-l py-1 pl-2.5">
                  {category.docs.map((doc) => (
                    <li key={doc.slug}>
                      <button
                        onClick={() => onSelect(doc.slug)}
                        className={cn(
                          "min-h-[32px] w-full rounded-md px-2.5 py-1 text-left text-[0.8125rem] transition-colors",
                          activeSlug === doc.slug
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                        aria-current={activeSlug === doc.slug ? "page" : undefined}
                      >
                        {doc.title}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </nav>
  )
}
