import type { Metadata } from "next"
import { AiAnalysisDashboard } from "@/components/ai/ai-analysis-dashboard"

export const metadata: Metadata = { title: "AI Analysis" }

export default function AiAnalysisPage() {
  return <AiAnalysisDashboard />
}
