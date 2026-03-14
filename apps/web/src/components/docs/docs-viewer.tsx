"use client"

import { useState, useEffect, useCallback } from "react"
import { BookOpen, ExternalLink } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { DocsNav } from "./docs-nav"
import { DocsContent } from "./docs-content"

interface DocEntry {
  slug: string
  title: string
  content: string
}

export function DocsViewer() {
  const [docs, setDocs] = useState<DocEntry[]>([])
  const [activeSlug, setActiveSlug] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/docs")
        if (!res.ok) throw new Error("Failed to load docs")
        const data = await res.json()
        setDocs(data.docs)
        if (data.docs.length > 0) {
          setActiveSlug(data.docs[0].slug)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load documentation")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSelect = useCallback((slug: string) => {
    setActiveSlug(slug)
    // Scroll to top of content on mobile
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  const activeDoc = docs.find((d) => d.slug === activeSlug)

  return (
    <div className="h-full w-full">
      <PageHeader
        title="Documentation"
        subtitle="Platform guides, architecture reference, and configuration"
        icon={BookOpen}
        actions={
          <a
            href="https://bmarshall511.github.io/forexflow/docs/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
          >
            <ExternalLink className="size-3.5" />
            <span className="hidden sm:inline">Full Docs Site</span>
          </a>
        }
      />

      <div className="flex flex-col gap-6 px-4 pb-6 md:flex-row md:px-6">
        {/* Sidebar nav */}
        <aside className="w-full shrink-0 md:sticky md:top-[calc(var(--header-height)+1rem)] md:max-h-[calc(100vh-var(--header-height)-2rem)] md:w-48 md:self-start md:overflow-y-auto lg:w-56">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-muted h-8 animate-pulse rounded-md" />
              ))}
            </div>
          ) : (
            <DocsNav docs={docs} activeSlug={activeSlug} onSelect={handleSelect} />
          )}
        </aside>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {loading && (
            <div className="space-y-4">
              <div className="bg-muted h-8 w-48 animate-pulse rounded" />
              <div className="bg-muted h-4 w-full animate-pulse rounded" />
              <div className="bg-muted h-4 w-3/4 animate-pulse rounded" />
              <div className="bg-muted h-4 w-5/6 animate-pulse rounded" />
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">{error}</div>
          )}

          {activeDoc && (
            <div className="bg-card rounded-xl border p-6 md:p-8">
              <DocsContent content={activeDoc.content} title={activeDoc.title} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
