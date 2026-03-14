"use client"

import { cn } from "@/lib/utils"

interface DocEntry {
  slug: string
  title: string
}

interface DocsNavProps {
  docs: DocEntry[]
  activeSlug: string
  onSelect: (slug: string) => void
}

export function DocsNav({ docs, activeSlug, onSelect }: DocsNavProps) {
  return (
    <nav aria-label="Documentation sections">
      {/* Desktop: vertical sidebar */}
      <div className="hidden md:block">
        <div className="bg-card rounded-xl border p-3">
          <h3 className="text-muted-foreground mb-2 px-2 text-[0.6875rem] font-semibold uppercase tracking-wider">
            Pages
          </h3>
          <ul className="space-y-0.5">
            {docs.map((doc) => (
              <li key={doc.slug}>
                <button
                  onClick={() => onSelect(doc.slug)}
                  className={cn(
                    "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
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
        </div>
      </div>

      {/* Mobile: horizontal scrollable tabs */}
      <div className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto px-4 md:hidden">
        {docs.map((doc) => (
          <button
            key={doc.slug}
            onClick={() => onSelect(doc.slug)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              activeSlug === doc.slug
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground bg-muted/50 hover:bg-muted",
            )}
            aria-current={activeSlug === doc.slug ? "page" : undefined}
          >
            {doc.title}
          </button>
        ))}
      </div>
    </nav>
  )
}
