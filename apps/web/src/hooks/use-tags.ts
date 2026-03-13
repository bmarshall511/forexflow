"use client"

import { useState, useEffect, useCallback } from "react"
import type { TagData } from "@fxflow/types"

export interface UseTagsReturn {
  tags: TagData[]
  isLoading: boolean
  createTag: (name: string, color: string) => Promise<TagData | null>
  deleteTag: (id: string) => Promise<void>
  refetch: () => void
}

export function useTags(): UseTagsReturn {
  const [tags, setTags] = useState<TagData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [fetchKey, setFetchKey] = useState(0)

  const refetch = useCallback(() => setFetchKey((k) => k + 1), [])

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    fetch("/api/tags")
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        if (json.ok && json.data) {
          setTags(json.data)
        }
      })
      .catch(() => {
        if (!cancelled) setTags([])
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [fetchKey])

  const createTag = useCallback(
    async (name: string, color: string): Promise<TagData | null> => {
      try {
        const res = await fetch("/api/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, color }),
        })
        if (!res.ok) return null
        const json = await res.json()
        if (json.ok && json.data) {
          refetch()
          return json.data as TagData
        }
        return null
      } catch {
        return null
      }
    },
    [refetch],
  )

  const deleteTag = useCallback(
    async (id: string): Promise<void> => {
      try {
        await fetch(`/api/tags/${id}`, { method: "DELETE" })
        refetch()
      } catch {
        // silently fail
      }
    },
    [refetch],
  )

  return { tags, isLoading, createTag, deleteTag, refetch }
}
