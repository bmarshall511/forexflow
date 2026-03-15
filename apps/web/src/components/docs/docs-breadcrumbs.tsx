"use client"

import { ChevronRight } from "lucide-react"

interface DocsBreadcrumbsProps {
  categoryLabel: string
  docTitle: string
}

export function DocsBreadcrumbs({ categoryLabel, docTitle }: DocsBreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="text-muted-foreground flex items-center gap-1 text-xs">
        <li>Documentation</li>
        <li aria-hidden="true">
          <ChevronRight className="size-3" />
        </li>
        <li>{categoryLabel}</li>
        <li aria-hidden="true">
          <ChevronRight className="size-3" />
        </li>
        <li className="text-foreground font-medium">{docTitle}</li>
      </ol>
    </nav>
  )
}
