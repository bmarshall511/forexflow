"use client"

import { useMemo } from "react"
import { markdownToHtml } from "@/lib/markdown"

interface DocsContentProps {
  content: string
  title: string
}

export function DocsContent({ content, title }: DocsContentProps) {
  const html = useMemo(() => markdownToHtml(content), [content])

  return (
    <article aria-label={title}>
      <div className="prose-fxflow" dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  )
}
