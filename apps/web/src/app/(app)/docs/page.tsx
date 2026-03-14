import type { Metadata } from "next"
import { DocsViewer } from "@/components/docs/docs-viewer"

export const metadata: Metadata = { title: "Documentation" }

export default function DocsPage() {
  return <DocsViewer />
}
