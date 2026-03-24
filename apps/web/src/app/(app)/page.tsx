import { Suspense } from "react"
import type { Metadata } from "next"
import { DashboardContent } from "@/components/dashboard/dashboard-content"
import { PageSkeleton } from "@/components/ui/page-skeleton"

export const metadata: Metadata = { title: "Dashboard" }

export default function DashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DashboardContent />
    </Suspense>
  )
}
