"use client"

import { useState } from "react"
import { Menu, X, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CategoryGroup } from "./docs-types"

interface DocsMobileNavProps {
  categories: CategoryGroup[]
  activeSlug: string
  onSelect: (slug: string) => void
}

export function DocsMobileNav({ categories, activeSlug, onSelect }: DocsMobileNavProps) {
  const [open, setOpen] = useState(false)

  const activeDoc = categories.flatMap((c) => c.docs).find((d) => d.slug === activeSlug)
  const activeCategory = categories.find((c) => c.docs.some((d) => d.slug === activeSlug))

  return (
    <div className="lg:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="border-border bg-card flex min-h-[44px] w-full items-center justify-between rounded-lg border px-3 py-2"
        aria-expanded={open}
        aria-label="Documentation navigation"
      >
        <div className="flex items-center gap-2 text-sm">
          {activeCategory && (
            <span className="text-muted-foreground">{activeCategory.label} /</span>
          )}
          <span className="text-foreground font-medium">{activeDoc?.title ?? "Select a page"}</span>
        </div>
        <ChevronDown
          className={cn("text-muted-foreground size-4 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="border-border bg-card mt-1 max-h-[60vh] overflow-y-auto rounded-lg border">
          {categories.map((category) => (
            <div key={category.id}>
              <div className="text-muted-foreground px-3 pb-1 pt-3 text-[0.6875rem] font-semibold uppercase tracking-wider">
                {category.label}
              </div>
              {category.docs.map((doc) => (
                <button
                  key={doc.slug}
                  onClick={() => {
                    onSelect(doc.slug)
                    setOpen(false)
                  }}
                  className={cn(
                    "block min-h-[40px] w-full px-4 py-2 text-left text-sm transition-colors",
                    activeSlug === doc.slug
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  aria-current={activeSlug === doc.slug ? "page" : undefined}
                >
                  {doc.title}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
