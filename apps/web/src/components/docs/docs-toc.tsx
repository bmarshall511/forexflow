"use client"

import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import type { DocHeading } from "@/lib/markdown"

interface DocsTocProps {
  headings: DocHeading[]
}

export function DocsToc({ headings }: DocsTocProps) {
  const [activeId, setActiveId] = useState("")
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Only show h2 and h3 headings in TOC
  const tocItems = headings.filter((h) => h.level === 2 || h.level === 3)

  useEffect(() => {
    if (tocItems.length === 0) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 },
    )

    for (const item of tocItems) {
      const el = document.getElementById(item.id)
      if (el) observerRef.current.observe(el)
    }

    return () => observerRef.current?.disconnect()
  }, [tocItems])

  if (tocItems.length < 2) return null

  return (
    <nav aria-label="Table of contents" className="space-y-2">
      <h4 className="text-muted-foreground text-[0.6875rem] font-semibold uppercase tracking-wider">
        On This Page
      </h4>
      <ul className="space-y-0.5">
        {tocItems.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth" })
                setActiveId(item.id)
              }}
              className={cn(
                "block py-1 text-xs leading-relaxed transition-colors",
                item.level === 3 && "pl-3",
                activeId === item.id
                  ? "text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
