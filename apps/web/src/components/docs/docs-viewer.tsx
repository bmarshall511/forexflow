"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { BookOpen, ExternalLink } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { DocsSidebar } from "./docs-sidebar"
import { DocsContent } from "./docs-content"
import { DocsToc } from "./docs-toc"
import { DocsMobileNav } from "./docs-mobile-nav"
import type { CategoryGroup, DocEntry } from "./docs-types"
import type { DocHeading } from "@/lib/markdown"

export function DocsViewer() {
  const [categories, setCategories] = useState<CategoryGroup[]>([])
  const [activeSlug, setActiveSlug] = useState("")
  const [headings, setHeadings] = useState<DocHeading[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Flatten all docs for prev/next navigation
  const allDocs = useMemo(() => categories.flatMap((c) => c.docs), [categories])

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/docs")
        if (!res.ok) throw new Error("Failed to load docs")
        const data = await res.json()
        setCategories(data.categories ?? [])

        // Check URL params for deep-link
        const params = new URLSearchParams(window.location.search)
        const docParam = params.get("doc")
        const allDocsList: DocEntry[] = (data.categories ?? []).flatMap(
          (c: CategoryGroup) => c.docs,
        )

        if (docParam && allDocsList.some((d: DocEntry) => d.slug === docParam)) {
          setActiveSlug(docParam)
        } else if (allDocsList.length > 0) {
          setActiveSlug(allDocsList[0]!.slug)
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
    // Update URL without full navigation
    const url = new URL(window.location.href)
    url.searchParams.set("doc", slug)
    window.history.replaceState({}, "", url.toString())
    // Scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  const handleHeadings = useCallback((h: DocHeading[]) => setHeadings(h), [])

  const activeDoc = allDocs.find((d) => d.slug === activeSlug)
  const activeIdx = allDocs.findIndex((d) => d.slug === activeSlug)
  const prevDoc = activeIdx > 0 ? allDocs[activeIdx - 1]! : null
  const nextDoc = activeIdx < allDocs.length - 1 ? allDocs[activeIdx + 1]! : null
  const activeCategory = categories.find((c) => c.docs.some((d) => d.slug === activeSlug))

  return (
    <div className="h-full w-full">
      <PageHeader
        title="Documentation"
        subtitle="Platform guides, trading reference, and configuration"
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

      <div className="px-4 pb-6 md:px-6">
        {/* Mobile nav dropdown */}
        {!loading && categories.length > 0 && (
          <div className="mb-4 lg:hidden">
            <DocsMobileNav
              categories={categories}
              activeSlug={activeSlug}
              onSelect={handleSelect}
            />
          </div>
        )}

        <div className="flex gap-6">
          {/* Desktop sidebar */}
          <aside className="hidden w-56 shrink-0 lg:block xl:w-60">
            <div className="sticky top-[calc(var(--header-height)+1rem)] max-h-[calc(100vh-var(--header-height)-2rem)] overflow-y-auto">
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="bg-muted h-8 animate-pulse rounded-md" />
                  ))}
                </div>
              ) : (
                <DocsSidebar
                  categories={categories}
                  activeSlug={activeSlug}
                  onSelect={handleSelect}
                />
              )}
            </div>
          </aside>

          {/* Content */}
          <div className="min-w-0 flex-1">
            {loading && (
              <div className="space-y-4">
                <div className="bg-muted h-4 w-48 animate-pulse rounded" />
                <div className="bg-muted h-8 w-64 animate-pulse rounded" />
                <div className="bg-muted h-4 w-full animate-pulse rounded" />
                <div className="bg-muted h-4 w-3/4 animate-pulse rounded" />
                <div className="bg-muted h-4 w-5/6 animate-pulse rounded" />
              </div>
            )}

            {error && (
              <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">
                {error}
              </div>
            )}

            {activeDoc && activeCategory && (
              <div className="bg-card rounded-xl border p-6 md:p-8">
                <DocsContent
                  content={activeDoc.content}
                  title={activeDoc.title}
                  categoryLabel={activeCategory.label}
                  prev={prevDoc}
                  next={nextDoc}
                  onSelect={handleSelect}
                  onHeadings={handleHeadings}
                />
              </div>
            )}
          </div>

          {/* Desktop TOC */}
          <aside className="hidden w-48 shrink-0 xl:block">
            <div className="sticky top-[calc(var(--header-height)+1rem)] max-h-[calc(100vh-var(--header-height)-2rem)] overflow-y-auto">
              {activeDoc && <DocsToc headings={headings} />}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
