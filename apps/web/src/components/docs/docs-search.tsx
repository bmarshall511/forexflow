"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SearchResult, CategoryGroup } from "./docs-types"

interface DocsSearchProps {
  categories: CategoryGroup[]
  onSelect: (slug: string) => void
}

export function DocsSearch({ categories, onSelect }: DocsSearchProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/docs/search?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data.results ?? [])
      }
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(query), 300)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [query, search])

  const handleSelect = (slug: string) => {
    onSelect(slug)
    setQuery("")
    setOpen(false)
    setResults([])
  }

  const getCategoryLabel = (catId: string) => categories.find((c) => c.id === catId)?.label ?? catId

  return (
    <div className="relative">
      <div className="relative">
        <Search className="text-muted-foreground absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search docs..."
          className="bg-muted/50 border-border placeholder:text-muted-foreground focus:border-primary/50 focus:ring-primary/20 h-9 w-full rounded-lg border pl-8 pr-8 text-sm outline-none focus:ring-1"
          aria-label="Search documentation"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("")
              setResults([])
              inputRef.current?.focus()
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5"
            aria-label="Clear search"
          >
            <X className="text-muted-foreground size-3.5" />
          </button>
        )}
      </div>

      {open && query.length >= 2 && (
        <div className="bg-popover border-border absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border shadow-lg">
          {loading && (
            <div className="text-muted-foreground p-3 text-center text-xs">Searching...</div>
          )}
          {!loading && results.length === 0 && (
            <div className="text-muted-foreground p-3 text-center text-xs">No results found</div>
          )}
          {!loading &&
            results.map((r) => (
              <button
                key={`${r.category}-${r.slug}`}
                onClick={() => handleSelect(r.slug)}
                className="hover:bg-accent block w-full px-3 py-2 text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-foreground text-sm font-medium">{r.title}</span>
                  <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[0.625rem] font-medium">
                    {getCategoryLabel(r.category)}
                  </span>
                </div>
                <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">{r.snippet}</p>
              </button>
            ))}
        </div>
      )}

      {/* Click-outside handler */}
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
      )}
    </div>
  )
}
