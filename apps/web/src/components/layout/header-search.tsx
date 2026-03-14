"use client"

import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"

export function HeaderSearch() {
  return (
    <div className="relative hidden items-center md:flex">
      <Search className="text-muted-foreground absolute left-2.5 size-4" aria-hidden="true" />
      <Input
        type="search"
        placeholder="Search pairs..."
        className="h-8 w-48 pl-8 text-sm"
        aria-label="Search currency pairs"
      />
    </div>
  )
}
