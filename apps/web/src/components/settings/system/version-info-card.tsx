"use client"

import { Info } from "lucide-react"
import { SectionCard, DetailRow } from "@/components/ui/section-card"
import { APP_VERSION, BUILD_SHA, BUILD_DATE, formatVersion } from "@/lib/version"

export function VersionInfoCard() {
  const buildDate = new Date(BUILD_DATE).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  const isProduction = process.env.NODE_ENV === "production"

  return (
    <SectionCard icon={Info} title="Version Info">
      <div className="space-y-0.5">
        <DetailRow label="App Version" value={formatVersion()} />
        <DetailRow
          label="Build SHA"
          value={
            BUILD_SHA === "local" ? (
              "local"
            ) : (
              <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">{BUILD_SHA}</code>
            )
          }
        />
        <DetailRow label="Build Date" value={buildDate} />
        <DetailRow
          label="Environment"
          value={
            <span className="flex items-center gap-1.5">
              <span
                className={`inline-block size-2 rounded-full ${isProduction ? "bg-emerald-500" : "bg-amber-500"}`}
                aria-hidden="true"
              />
              {isProduction ? "Production" : "Development"}
            </span>
          }
        />
        <DetailRow label="Next.js" value={APP_VERSION === "dev" ? "—" : "15"} />
      </div>
      {APP_VERSION.startsWith("0.") && (
        <p className="text-muted-foreground/60 pt-2 text-[10px]">
          Pre-release version — breaking changes may occur between minor versions.
        </p>
      )}
    </SectionCard>
  )
}
