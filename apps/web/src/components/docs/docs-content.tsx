"use client"

import { useEffect, useMemo } from "react"
import { parseMarkdown, type DocHeading } from "@/lib/markdown"
import { DocsBreadcrumbs } from "./docs-breadcrumbs"
import { DocsNavFooter } from "./docs-nav-footer"
import type { DocEntry } from "./docs-types"

interface DocsContentProps {
  content: string
  title: string
  categoryLabel: string
  prev: DocEntry | null
  next: DocEntry | null
  onSelect: (slug: string) => void
  onHeadings: (headings: DocHeading[]) => void
}

export function DocsContent({
  content,
  title,
  categoryLabel,
  prev,
  next,
  onSelect,
  onHeadings,
}: DocsContentProps) {
  const parsed = useMemo(() => parseMarkdown(content), [content])

  useEffect(() => {
    onHeadings(parsed.headings)
  }, [parsed, onHeadings])

  return (
    <article aria-label={title}>
      <DocsBreadcrumbs categoryLabel={categoryLabel} docTitle={title} />
      <div className="prose-fxflow" dangerouslySetInnerHTML={{ __html: parsed.html }} />
      <DocsNavFooter prev={prev} next={next} onSelect={onSelect} />
    </article>
  )
}
