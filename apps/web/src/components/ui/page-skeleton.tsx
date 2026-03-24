"use client"

/** Full-page loading skeleton with header, tile grid, and content placeholder. */
export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-6 p-4 md:p-6" role="status" aria-label="Loading page">
      {/* Header placeholder */}
      <div className="space-y-2">
        <div className="bg-muted h-8 w-48 rounded-lg" />
        <div className="bg-muted h-4 w-72 rounded-lg" />
      </div>

      {/* Tile grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-muted h-20 rounded-lg" />
        ))}
      </div>

      {/* Content placeholder */}
      <div className="bg-muted h-64 rounded-lg" />

      <span className="sr-only">Loading...</span>
    </div>
  )
}
