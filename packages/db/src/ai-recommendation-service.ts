import { db } from "./client"
import type { AiAccuracyStats } from "@fxflow/types"

export async function createRecommendationOutcome(input: {
  analysisId: string
  tradeId: string
  recommendedAction: string
  winProbability: number
  qualityScore: number
}): Promise<string> {
  const record = await db.aiRecommendationOutcome.create({
    data: {
      analysisId: input.analysisId,
      tradeId: input.tradeId,
      recommendedAction: input.recommendedAction,
      winProbability: input.winProbability,
      qualityScore: input.qualityScore,
    },
  })
  return record.id
}

export async function markActionFollowed(analysisId: string): Promise<void> {
  await db.aiRecommendationOutcome.updateMany({
    where: { analysisId },
    data: { actionFollowed: true, actionFollowedAt: new Date() },
  })
}

export async function resolveOutcomes(
  tradeId: string,
  outcome: "win" | "loss" | "breakeven",
  pnl: number,
): Promise<void> {
  await db.aiRecommendationOutcome.updateMany({
    where: { tradeId, resolvedAt: null },
    data: {
      tradeOutcome: outcome,
      actualPnl: pnl,
      resolvedAt: new Date(),
    },
  })
}

export async function getAccuracyStats(): Promise<AiAccuracyStats> {
  const all = await db.aiRecommendationOutcome.findMany({
    where: { resolvedAt: { not: null } },
    select: {
      recommendedAction: true,
      winProbability: true,
      qualityScore: true,
      actionFollowed: true,
      tradeOutcome: true,
      actualPnl: true,
    },
  })

  const totalRecommendations = all.length
  const followed = all.filter((r) => r.actionFollowed)
  const ignored = all.filter((r) => !r.actionFollowed)
  const followedCount = followed.length
  const ignoredCount = ignored.length

  const winRate = (items: typeof all) => {
    const resolved = items.filter((r) => r.tradeOutcome)
    if (resolved.length === 0) return null
    return resolved.filter((r) => r.tradeOutcome === "win").length / resolved.length
  }

  const followedWinRate = winRate(followed)
  const ignoredWinRate = winRate(ignored)
  const overallActualWinRate = winRate(all)
  const overallPredictedWinRate =
    all.length > 0
      ? all.reduce((sum, r) => sum + r.winProbability, 0) / all.length
      : null

  // Calibration buckets: 0-20%, 20-40%, ..., 80-100%
  const buckets = [
    { label: "0-20%", min: 0, max: 0.2 },
    { label: "20-40%", min: 0.2, max: 0.4 },
    { label: "40-60%", min: 0.4, max: 0.6 },
    { label: "60-80%", min: 0.6, max: 0.8 },
    { label: "80-100%", min: 0.8, max: 1.01 },
  ]

  const calibration = buckets.map((b) => {
    const items = all.filter((r) => r.winProbability >= b.min && r.winProbability < b.max)
    const resolved = items.filter((r) => r.tradeOutcome)
    return {
      bucket: b.label,
      predictedAvg:
        items.length > 0
          ? items.reduce((s, r) => s + r.winProbability, 0) / items.length
          : (b.min + b.max) / 2,
      actualWinRate:
        resolved.length > 0
          ? resolved.filter((r) => r.tradeOutcome === "win").length / resolved.length
          : null,
      count: items.length,
    }
  })

  return {
    totalRecommendations,
    followedCount,
    ignoredCount,
    followedWinRate,
    ignoredWinRate,
    overallPredictedWinRate,
    overallActualWinRate,
    calibration,
  }
}
